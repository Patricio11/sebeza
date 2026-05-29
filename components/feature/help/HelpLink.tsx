/**
 * Phase 10.1 / 10.2 / 10.3 — in-context deep-link from a dashboard
 * surface to the relevant help article.
 *
 * Used on the top dashboard surfaces (~8 per role) so users discover
 * help in the place they hit friction, not only when they go looking.
 * The chip is deliberately small + neutral — it never competes with
 * the page's primary action, only signals "there's documentation if
 * you need it."
 *
 * Phase 10.2 added the `role` prop. The employer help centre lives at
 * `/employer/help/*`; the seeker help centre lives at
 * `/dashboard/help/*` (under the seeker dashboard route group). The
 * default is "employer" so the existing 8 employer surfaces using
 * `<HelpLink slug="..." />` keep working without edits.
 *
 * Phase 10.3 added the "admin" role pointing at `/admin/help/*`. Gov
 * follows in Phase 10.4 and slots in here too.
 */

import { Link } from "@/i18n/navigation";
import { HelpCircle } from "lucide-react";

type HelpRole = "employer" | "seeker" | "admin";

interface Props {
  /** Slug of the help article to deep-link to. */
  slug: string;
  /** Which role's help centre this chip points into. Defaults to
   *  "employer" so Phase 10.1 chips don't need editing. */
  role?: HelpRole;
  /** Override the default label. Useful when the surface needs more
   *  specific wording ("Learn about match requirements" vs the
   *  generic default). */
  label?: string;
}

const BASE_PATH: Record<HelpRole, string> = {
  employer: "/employer/help",
  seeker: "/dashboard/help",
  admin: "/admin/help",
};

export function HelpLink({
  slug,
  role = "employer",
  label = "How does this work?",
}: Props) {
  return (
    <Link
      href={`${BASE_PATH[role]}/${slug}` as never}
      className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2.5 py-1 text-[0.7rem] text-[color:var(--color-ink-soft)] no-underline transition-colors hover:border-[color:var(--color-ink)] hover:text-[color:var(--color-ink)]"
    >
      <HelpCircle className="size-3" aria-hidden="true" />
      {label}
    </Link>
  );
}
