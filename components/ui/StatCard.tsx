import { cn } from "@/lib/utils";

interface Props {
  label: string;
  /** Number, already formatted with locale separators if appropriate. */
  value: string | number;
  /** Optional eyebrow / unit suffix. */
  hint?: string;
  /** Tiny sparkline values (0..1 normalised)  drawn as a pure SVG polyline. */
  spark?: number[];
  /** Optional 0..1 confidence indicator. Renders as a thin meter under the label. */
  confidence?: number;
  className?: string;
}

/**
 * Editorial stat block. Fraunces numeral, tabular, optional sparkline.
 * Always cheap: no chart library used  just an inline SVG polyline.
 */
export function StatCard({ label, value, hint, spark, confidence, className }: Props) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm uppercase tracking-wider text-[color:var(--color-ink-soft)]">
          {label}
        </div>
        {hint && (
          <div className="text-xs text-[color:var(--color-ink-soft)]">{hint}</div>
        )}
      </div>
      <div className="mt-1 flex items-end justify-between gap-4">
        <div className="font-display tabular text-[2.25rem] leading-none text-[color:var(--color-ink)]">
          {value}
        </div>
        {spark && spark.length > 1 && <Sparkline values={spark} />}
      </div>
      {typeof confidence === "number" && (
        <ConfidenceMeter value={confidence} />
      )}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 84;
  const h = 28;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} aria-hidden="true" className="overflow-visible">
      <polyline
        fill="none"
        stroke="var(--color-brand)"
        strokeWidth={1.5}
        points={pts}
      />
    </svg>
  );
}

function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="mt-3 flex items-center gap-2">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-[color:var(--color-surface-sunk)]">
        <div
          className="h-full bg-[color:var(--color-brand)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[0.7rem] tabular text-[color:var(--color-ink-soft)]">
        {pct}%
      </span>
    </div>
  );
}
