import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface Props {
  /** 0–100 */
  value: number;
  /** "bar" (default, inline) or "arc" (used on the seeker dashboard) */
  variant?: "bar" | "arc";
  className?: string;
}

export function ProfileCompleteness({ value, variant = "bar", className }: Props) {
  const t = useTranslations("search.rosterItem");
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const label = `${t("completeness")}: ${clamped}%`;

  if (variant === "arc") {
    const size = 96;
    const stroke = 8;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const dash = (clamped / 100) * c;
    return (
      <div
        role="img"
        aria-label={label}
        className={cn("relative inline-flex items-center justify-center", className)}
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} aria-hidden="true">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="var(--color-hairline)"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="var(--color-brand)"
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${dash} ${c}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <span className="absolute font-display text-xl tabular text-[color:var(--color-ink)]">
          {clamped}%
        </span>
      </div>
    );
  }

  // bar
  return (
    <div
      className={cn("flex items-center gap-2", className)}
      role="img"
      aria-label={label}
    >
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-[color:var(--color-surface-sunk)]">
        <div
          className="h-full bg-[color:var(--color-brand)]"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-xs tabular text-[color:var(--color-ink-soft)]">
        {clamped}%
      </span>
    </div>
  );
}
