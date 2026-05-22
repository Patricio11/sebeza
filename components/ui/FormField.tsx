import { cn } from "@/lib/utils";

interface FieldShellProps {
  id: string;
  label: string;
  /** Right-aligned chip-style helper (e.g. "Encrypted on save", "Required"). */
  badge?: React.ReactNode;
  /** Optional helper text under the field. */
  hint?: string;
  /** Optional error message — overrides hint visual treatment. */
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
  className?: string;
}

/** Editorial form field — hairline-divided composition with optional chip badge. */
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

export function SelectField({
  id,
  label,
  hint,
  badge,
  optional,
  className,
  children,
  ...props
}: SelectProps) {
  return (
    <FieldShell id={id} label={label} hint={hint} badge={badge} optional={optional}>
      <select
        id={id}
        className={cn(
          "h-12 w-full appearance-none rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 text-[color:var(--color-ink)] outline-none transition-colors focus:border-[color:var(--color-ink)]",
          className,
        )}
        {...props}
      >
        {children}
      </select>
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
