/**
 * Phase 11.1.2  "Why no invites?" diagnostic card.
 *
 * Renders above the empty-state on /dashboard/invitations when the
 * seeker has zero invitations. Surfaces the four preconditions for
 * getting invites with green-check / red-cross treatment + a direct
 * action link for any failing check. Removes the silent-fail mystery
 * ("the platform is broken") by turning it into a five-line
 * actionable checklist.
 *
 * All data is composed server-side from existing reads  no new query
 * here. The component is deliberately a server component so it
 * round-trips cleanly with the page revalidation.
 */

import { Link } from "@/i18n/navigation";
import { CheckCircle2, XCircle, ArrowUpRight } from "lucide-react";

interface Check {
  pass: boolean;
  ordinal: string;
  passLabel: string;
  failLabel: string;
  actionHref: string;
  actionLabel: string;
}

interface Props {
  statusFresh: { pass: boolean; days: number };
  completenessOk: { pass: boolean; percent: number };
  vacancyMatchingConsent: boolean;
  poolHasEmployers: { pass: boolean; poolTotal: number };
}

export function NoInvitesDiagnosticCard({
  statusFresh,
  completenessOk,
  vacancyMatchingConsent,
  poolHasEmployers,
}: Props) {
  const checks: Check[] = [
    {
      pass: statusFresh.pass,
      ordinal: "01",
      passLabel: "Status confirmed in the last 90 days",
      failLabel: `Status hasn't been confirmed in ${statusFresh.days} days  the matcher down-ranks stale profiles.`,
      actionHref: "/dashboard",
      actionLabel: "Confirm status",
    },
    {
      pass: completenessOk.pass,
      ordinal: "02",
      passLabel: "Profile is at least 50% complete",
      failLabel: `Profile is ${completenessOk.percent}% complete  add skills, a cert, or experience.`,
      actionHref: "/dashboard/profile",
      actionLabel: "Open profile editor",
    },
    {
      pass: vacancyMatchingConsent,
      ordinal: "03",
      passLabel: "Vacancy-matching consent is on",
      failLabel:
        "Vacancy-matching consent is off  employers cannot send you invitations until you turn it on.",
      actionHref: "/dashboard/privacy",
      actionLabel: "Open Privacy & consent",
    },
    {
      pass: poolHasEmployers.pass,
      ordinal: "04",
      passLabel: "Employers in your skill × location are searching",
      failLabel:
        "Your skill × province pool is small  consider Career Compass adjacent professions.",
      actionHref: "/dashboard/grow",
      actionLabel: "Open Career Compass",
    },
  ];

  const allPass = checks.every((c) => c.pass);

  return (
    <section
      aria-labelledby="diag-h"
      className="mb-6 rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-surface)] p-5 md:p-6"
    >
      <header className="mb-3">
        <p className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
          Diagnostic
        </p>
        <h2
          id="diag-h"
          className="mt-1 font-display text-xl text-[color:var(--color-ink)] md:text-2xl"
        >
          Why no invites yet?
        </h2>
      </header>

      <ul className="space-y-3">
        {checks.map((c) => (
          <li key={c.ordinal} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 font-display text-base italic text-[color:var(--color-ink-soft)]"
            >
              {c.ordinal}
            </span>
            {c.pass ? (
              <CheckCircle2
                className="mt-0.5 size-4 shrink-0 text-[color:var(--color-employed)]"
                aria-label="check passes"
              />
            ) : (
              <XCircle
                className="mt-0.5 size-4 shrink-0 text-[color:var(--color-danger)]"
                aria-label="check fails"
              />
            )}
            <div className="flex-1">
              <p className="text-sm leading-snug text-[color:var(--color-ink)]">
                {c.pass ? c.passLabel : c.failLabel}
              </p>
              {!c.pass && (
                <Link
                  href={c.actionHref as never}
                  className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[color:var(--color-brand-strong)] hover:underline"
                >
                  {c.actionLabel}
                  <ArrowUpRight className="size-3" aria-hidden="true" />
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>

      {allPass && (
        <p className="mt-4 rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] p-3 text-xs text-[color:var(--color-ink-soft)]">
          All clear. The matcher hasn&rsquo;t surfaced you for a fresh
          vacancy yet. Most seekers see their first invite within 21 days
          of a complete profile  the platform pool for{" "}
          {poolHasEmployers.poolTotal} seekers in your combo is active.
        </p>
      )}
    </section>
  );
}
