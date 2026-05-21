import { cn } from "@/lib/utils";

interface DataSpineItem {
  label: string;
  value: React.ReactNode;
}

interface Props {
  items: DataSpineItem[];
  className?: string;
}

/**
 * Left-aligned vertical meta rail used on results + profile for an editorial feel.
 * See UX_UI_SPEC §1.5. Renders as a definition list (semantic, screen-reader friendly).
 */
export function DataSpine({ items, className }: Props) {
  return (
    <dl
      className={cn(
        "flex flex-col gap-3 border-l border-[color:var(--color-hairline)] pl-4 text-sm",
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs uppercase tracking-wider text-[color:var(--color-ink-soft)]">
            {item.label}
          </dt>
          <dd className="text-[color:var(--color-ink)]">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
