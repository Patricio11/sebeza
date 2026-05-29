/**
 * Phase 10.1  in-context deep-link from a dashboard surface to the
 * relevant help article.
 *
 * Used on the top ~8 employer surfaces (D6) so users discover help in
 * the place they hit friction, not only when they go looking. The
 * chip is deliberately small + neutral  it never competes with the
 * page's primary action, only signals "there's documentation if you
 * need it."
 */

import { Link } from "@/i18n/navigation";
import { HelpCircle } from "lucide-react";

interface Props {
  /** Slug of the help article to deep-link to. */
  slug: string;
  /** Override the default label. Useful when the surface needs more
   *  specific wording ("Learn about match requirements" vs the
   *  generic default). */
  label?: string;
}

export function HelpLink({ slug, label = "How does this work?" }: Props) {
  return (
    <Link
      href={`/employer/help/${slug}` as never}
      className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-2.5 py-1 text-[0.7rem] text-[color:var(--color-ink-soft)] no-underline transition-colors hover:border-[color:var(--color-ink)] hover:text-[color:var(--color-ink)]"
    >
      <HelpCircle className="size-3" aria-hidden="true" />
      {label}
    </Link>
  );
}
