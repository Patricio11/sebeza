import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

/**
 * Loading placeholders. Always prefer a skeleton over a spinner  UX_UI_SPEC §2.8.
 * Pulse uses CSS only; respects `prefers-reduced-motion` via globals.css.
 */
export function Skeleton({ className }: Props) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-[var(--radius-sm)] bg-[color:var(--color-surface-sunk)]",
        className,
      )}
    />
  );
}

export function RosterSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-[auto_1fr] gap-4 border-b border-[color:var(--color-hairline)] py-5"
        >
          <Skeleton className="size-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-6 w-44" />
          </div>
        </div>
      ))}
    </div>
  );
}
