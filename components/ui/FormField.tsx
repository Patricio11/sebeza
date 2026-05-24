import * as React from "react";
import { cn } from "@/lib/utils";
import { CustomSelect, type CustomSelectOption } from "@/components/ui/CustomSelect";

interface FieldShellProps {
  id: string;
  label: string;
  /** Right-aligned chip-style helper (e.g. "Encrypted on save", "Required"). */
  badge?: React.ReactNode;
  /** Optional helper text under the field. */
  hint?: string;
  /** Optional error message  overrides hint visual treatment. */
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}

/** Editorial form field  hairline-divided composition with optional chip badge. */
export function FieldShell({
  id,
  label,
  badge,
  hint,
  error,
  optional,
  children,
  className,
}: FieldShellProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={id}
          className="text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]"
        >
          {label}
          {optional && (
            <span className="ml-1 text-[color:var(--color-ink-soft)]">
              (optional)
            </span>
          )}
        </label>
        {badge}
      </div>
      {children}
      {error ? (
        <p className="text-xs text-[color:var(--color-danger)]">{error}</p>
      ) : hint ? (
        <p className="text-xs text-[color:var(--color-ink-soft)]">{hint}</p>
      ) : null}
    </div>
  );
}

interface TextProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  hint?: string;
  badge?: React.ReactNode;
  error?: string;
  optional?: boolean;
}

export function TextField({
  id,
  label,
  hint,
  badge,
  error,
  optional,
  className,
  ...props
}: TextProps) {
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      badge={badge}
      error={error}
      optional={optional}
    >
      <input
        id={id}
        className={cn(
          "h-12 w-full rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 text-[color:var(--color-ink)] outline-none transition-colors placeholder:text-[color:var(--color-ink-soft)] focus:border-[color:var(--color-ink)]",
          error && "border-[color:var(--color-danger)]",
          className,
        )}
        {...props}
      />
    </FieldShell>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  id: string;
  label: string;
  hint?: string;
  badge?: React.ReactNode;
  optional?: boolean;
  children: React.ReactNode;
}

/**
 * `SelectField` API mirrors native `<select>` for backwards compatibility:
 * every call site still passes `<option>` children + the standard
 * `onChange={(e) => …}` event handler. Internally we extract the options
 * and hand the data to `<CustomSelect>` so every dropdown in Sebenza uses
 * the same Mzansi National popover / mobile bottom sheet  never a native
 * OS dropdown.
 *
 * Note: `CustomSelect`'s `onChange` is `(value: string) => void`. We
 * synthesise a minimal `ChangeEvent`-shaped object so consumers can keep
 * writing `onChange={(e) => setX(e.target.value)}` exactly as they would
 * for a native select.
 */
export function SelectField({
  id,
  label,
  hint,
  badge,
  optional,
  className,
  children,
  name,
  defaultValue,
  value,
  required,
  disabled,
  onChange,
}: SelectProps) {
  const { options, placeholder } = extractOptions(children);
  return (
    <FieldShell id={id} label={label} hint={hint} badge={badge} optional={optional}>
      <CustomSelect
        id={id}
        name={typeof name === "string" ? name : undefined}
        defaultValue={
          typeof defaultValue === "string" ? defaultValue : undefined
        }
        value={typeof value === "string" ? value : undefined}
        onChange={(nextValue) => {
          if (!onChange) return;
          // Synthesize a ChangeEvent shape so existing call-sites can write
          // `onChange={(e) => setX((e.target as HTMLSelectElement).value)}`
          // and have it Just Work, the same as they would with a native select.
          const fakeTarget = {
            value: nextValue,
            name: typeof name === "string" ? name : "",
            id,
          } as unknown as HTMLSelectElement;
          onChange({
            target: fakeTarget,
            currentTarget: fakeTarget,
          } as unknown as React.ChangeEvent<HTMLSelectElement>);
        }}
        options={options}
        placeholder={placeholder ?? "Select…"}
        required={required}
        disabled={disabled}
        ariaLabel={label}
        className={className}
      />
    </FieldShell>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  id: string;
  label: string;
  hint?: string;
  optional?: boolean;
}

export function TextareaField({
  id,
  label,
  hint,
  optional,
  className,
  ...props
}: TextareaProps) {
  return (
    <FieldShell id={id} label={label} hint={hint} optional={optional}>
      <textarea
        id={id}
        className={cn(
          "min-h-[120px] w-full rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 py-2 text-[color:var(--color-ink)] outline-none transition-colors placeholder:text-[color:var(--color-ink-soft)] focus:border-[color:var(--color-ink)]",
          className,
        )}
        {...props}
      />
    </FieldShell>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Internals
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Walks the `<option>` children passed to <SelectField> and turns them into
 * the `{value,label,disabled}` data CustomSelect expects. The first option
 * with an empty `value` is treated as the placeholder rather than a real
 * option  matches the convention every call site already uses.
 */
function extractOptions(children: React.ReactNode): {
  options: CustomSelectOption[];
  placeholder?: string;
} {
  const out: CustomSelectOption[] = [];
  let placeholder: string | undefined;

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (typeof child.type !== "string") return;
    if (child.type !== "option") return;
    const props = child.props as {
      value?: string | number | readonly string[];
      children?: React.ReactNode;
      disabled?: boolean;
    };
    const label = nodeToString(props.children);
    // Native <select> behaviour: if <option> has no explicit value attribute,
    // the option's text content IS the value. Without this fallback every
    // option with just `<option>X</option>` (no value=) submitted as empty,
    // which made every CustomSelect look like "click doesn't do anything".
    const hasExplicitValue = props.value !== undefined;
    const value = hasExplicitValue ? String(props.value) : label;
    // The very first option whose value is explicitly empty is the
    // placeholder ("Select…") rather than a real option.
    if (
      hasExplicitValue &&
      value === "" &&
      out.length === 0 &&
      placeholder === undefined
    ) {
      placeholder = label;
      return;
    }
    out.push({ value, label, disabled: props.disabled });
  });

  return { options: out, placeholder };
}

function nodeToString(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToString).join("");
  if (React.isValidElement(node)) {
    const children = (node.props as { children?: React.ReactNode }).children;
    return nodeToString(children);
  }
  return "";
}

export function EncryptedBadge({ children = "Encrypted on save" }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] text-[color:var(--color-brand-strong)]">
      <span
        aria-hidden="true"
        className="inline-block size-1.5 rounded-full bg-[color:var(--color-brand)]"
      />
      {children}
    </span>
  );
}
