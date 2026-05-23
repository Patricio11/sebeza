import { useTranslations } from "next-intl";
import { cn, daysSince, formatRelativeTime } from "@/lib/utils";
import { freshnessBand } from "@/lib/mock/helpers";
import type { EmploymentStatus, FreshnessBand } from "@/lib/mock/types";

interface Props {
  status: EmploymentStatus;
  /** ISO timestamp from PublicProfile.statusConfirmedAt */
  confirmedAt: string;
  locale?: string;
  className?: string;
}

/**
 * The Talent Pulse. Encodes status + freshness in one honest glyph.
 * - fresh   (<30d):  solid filled ring, status colour
 * - ageing  (30–90d): half ring
 * - stale   (≥90d):   dashed outline + small dot
 *
 * Carries text + ARIA  never colour-only (Critical UX Rule §5, WCAG 1.4.1).
 */
export function StatusChip({ status, confirmedAt, locale = "en", className }: Props) {
  const tStatus = useTranslations("status");
  const tFreshness = useTranslations("status.freshness");
  const band = freshnessBand(confirmedAt);

  const colorVar = STATUS_COLOR_VAR[status];
  const label = tStatus(status);
  const relative = formatRelativeTime(confirmedAt, locale);
  const days = daysSince(confirmedAt);
  const a11y =
    band === "stale"
      ? `${label}. Status is stale  confirmed ${days} days ago.`
      : `${label}. Confirmed ${relative}.`;

  return (
    <span
      role="status"
      aria-label={a11y}
      title={`${label}  ${tStatus("confirmedRelative", { when: relative })}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 text-[0.78rem] leading-none",
        "border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] text-[color:var(--color-ink)]",
        className,
      )}
    >
      <PulseGlyph band={band} colorVar={colorVar} />
      <span className="font-medium">{label}</span>
      <span
        className={cn(
          "text-[color:var(--color-ink-soft)]",
          band === "stale" && "text-[color:var(--color-stale)]",
        )}
      >
        · {relative}
      </span>
      <span className="sr-only">{tFreshness(`${band}Help`)}</span>
    </span>
  );
}

function PulseGlyph({ band, colorVar }: { band: FreshnessBand; colorVar: string }) {
  // Pure SVG (no JS animation past initial paint). Cheap on mobile.
  const size = 12;
  const r = 4.5;
  const cx = size / 2;
  const cy = size / 2;
  const stroke = `var(${colorVar})`;
  if (band === "fresh") {
    return (
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={cx} cy={cy} r={r} fill={stroke} />
      </svg>
    );
  }
  if (band === "ageing") {
    return (
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={stroke} strokeWidth={1.4} />
        <path d={`M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} Z`} fill={stroke} />
      </svg>
    );
  }
  // stale
  return (
    <svg width={size} height={size} aria-hidden="true">
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth={1.4}
        strokeDasharray="2 2"
      />
      <circle cx={cx} cy={cy} r={1.2} fill={stroke} />
    </svg>
  );
}

const STATUS_COLOR_VAR: Record<EmploymentStatus, string> = {
  employed: "--color-employed",
  open_to_work: "--color-open",
  unemployed: "--color-unemployed",
  self_employed: "--color-self-employed",
  studying: "--color-studying",
};
