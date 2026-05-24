import {
  VACANCY_STATUS_LABEL,
  VACANCY_STATUS_TONE,
  type VacancyStatus,
} from "@/lib/employer/vacancies-types";
import { cn } from "@/lib/utils";

const TONE_CLS: Record<"muted" | "brand" | "neutral" | "accent", string> = {
  muted:
    "border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] text-[color:var(--color-ink-soft)]",
  brand:
    "border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]",
  neutral:
    "border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] text-[color:var(--color-ink)]",
  accent:
    "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]",
};

export function VacancyStatusChip({
  status,
  className,
}: {
  status: VacancyStatus;
  className?: string;
}) {
  const tone = VACANCY_STATUS_TONE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-pill)] border px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em]",
        TONE_CLS[tone],
        className,
      )}
    >
      {VACANCY_STATUS_LABEL[status]}
    </span>
  );
}
