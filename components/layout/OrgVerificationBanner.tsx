import { Link } from "@/i18n/navigation";

/**
 * Phase 9.10 cleanup  the banner used to short-circuit on a static
 * org-verified flag, which made it lie when the live DB state
 * diverged. The page-level conditional (e.g.
 * `session.verification !== "verified"` on /employer) is the canonical
 * filter; this component just renders whatever the caller decided to
 * show. No more static-data branches.
 */
export function OrgVerificationBanner({
  message,
  cta,
}: {
  message: string;
  cta: string;
}) {
  return (
    <div className="border-y border-[color:var(--color-accent)] bg-[color:var(--color-accent-tint)] px-5 py-3 md:px-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[color:var(--color-ink)]">
          <span className="font-medium">Organisation not verified.</span>{" "}
          {message}
        </p>
        {/* Phase 9.10  link now points to the dedicated onboarding
            surface (KYC document upload + admin review), not the
            generic /employer/organisation settings page. */}
        <Link
          href="/employer/onboarding"
          className="rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-4 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-paper)]"
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}
