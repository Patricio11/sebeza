import { cn } from "@/lib/utils";

interface Props {
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
  /** Optional icon node (e.g. a Lucide icon). Keep it small + non-decorative. */
  icon?: React.ReactNode;
}

export function EmptyState({ title, body, action, className, icon }: Props) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-8 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mb-3 inline-flex size-10 items-center justify-center rounded-full bg-[color:var(--color-surface-sunk)] text-[color:var(--color-ink-soft)]">
          {icon}
        </div>
      )}
      <h3 className="font-display text-xl text-[color:var(--color-ink)]">{title}</h3>
      {body && <p className="mx-auto mt-2 max-w-md text-[color:var(--color-ink-soft)]">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
