import { Check, CircleDashed, CircleDot, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { VerificationStatus } from "@/lib/mock/types";

interface Props {
  state: VerificationStatus;
  /** Show the textual label next to the glyph. Default true. */
  showLabel?: boolean;
  /**
   * Phase 9.16.1  global opt-out. When `false`, the component renders
   * nothing  every state hidden, no chrome, no aria-label. Drives the
   * platform-level `feature_flag_verification_badges_visible` toggle.
   * Defaults to `true` (visible) so existing call sites that don't pass
   * the prop keep working unchanged.
   */
  visible?: boolean;
  className?: string;
}

/**
 * Verification-Honesty Rule (TO_START_EVERY_SESSION.md §6): never display
 * "Verified" for self-reported data. Default is `unverified`. Badges must
 * reflect reality  this component refuses to lie.
 *
 * Phase 9.16.1: also refuses to render at all when the admin has flipped
 * `feature_flag_verification_badges_visible` to false. Still honest
 * the column exists, the rule still holds, we just don't paint anything.
 */
export function VerificationBadge({
  state,
  showLabel = true,
  visible = true,
  className,
}: Props) {
  // Hooks must run before the early-return to keep the call order stable.
  const t = useTranslations("verification");
  if (!visible) return null;
  const cfg = STATE[state];
  const Icon = cfg.icon;
  const label = t(state);
  return (
    <span
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2 py-0.5 text-xs font-medium",
        cfg.classes,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {showLabel && <span>{label}</span>}
    </span>
  );
}

const STATE: Record<
  VerificationStatus,
  { icon: typeof Check; classes: string }
> = {
  unverified: {
    icon: CircleDashed,
    classes:
      "border border-[color:var(--color-hairline)] text-[color:var(--color-ink-soft)] bg-transparent",
  },
  pending: {
    icon: CircleDot,
    classes:
      "border border-dotted border-[color:var(--color-accent)] text-[color:var(--color-accent)] bg-[color:var(--color-accent-tint)]",
  },
  verified: {
    icon: Check,
    classes:
      "bg-[color:var(--color-verified)] text-white border border-[color:var(--color-brand-strong)]",
  },
  rejected: {
    icon: XCircle,
    classes:
      "bg-[color:var(--color-danger)] text-white border border-[color:var(--color-danger)]",
  },
};
