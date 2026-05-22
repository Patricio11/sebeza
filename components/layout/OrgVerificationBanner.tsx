import { Link } from "@/i18n/navigation";
import { MOCK_EMPLOYER } from "./employerNav";

export function OrgVerificationBanner({
  message,
  cta,
}: {
  message: string;
  cta: string;
}) {
  if (MOCK_EMPLOYER.orgVerified) return null;
  return (
    <div className="border-y border-[color:var(--color-accent)] bg-[color:var(--color-accent-tint)] px-5 py-3 md:px-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[color:var(--color-ink)]">
          <span className="font-medium">Organisation not verified.</span>{" "}
          {message}
        </p>
        <Link
          href="/employer/organisation"
          className="rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-4 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--color-paper)]"
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}
