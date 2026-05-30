/**
 * Phase 11.1.4  recent-achievements strip.
 *
 * Renders up to three most-recent badges across the bottom of the
 * dashboard overview. The strip is suppressed silently when the
 * seeker has no badges yet  an empty strip would feel like a
 * scolding "you haven't earned anything." Honest signal: show
 * nothing.
 *
 * Civic-Editorial constraints:
 *   - Two-word titles + a quiet eyebrow ("EARNED")  no exclamation
 *     marks, no animation, no "Congratulations" copy.
 *   - Static SVG medallions from /public/badges. No gradient washes,
 *     no glow effects. The medallion itself carries the visual.
 *   - Citation copy reveals on hover/focus through a regular
 *     `title` attribute  no JS-driven tooltip.
 *   - Renders inside the existing dashboard grid; mobile stacks one
 *     per row, desktop lays out three across.
 *
 * Data: `RecentBadge[]` (slug + awardedAt). Catalog lookup happens
 * here  unknown slugs are filtered upstream in `listMyBadges`.
 */

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Award } from "lucide-react";
import { BADGE_CATALOG, type BadgeSlug } from "@/lib/seeker/badge-catalog";

interface RecentBadge {
  slug: BadgeSlug;
  awardedAt: string;
}

interface Props {
  badges: RecentBadge[];
  locale: string;
}

export function RecentAchievementsStrip({ badges, locale }: Props) {
  if (badges.length === 0) return null;

  const fmt = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <section
      aria-labelledby="badges-h"
      className="md:col-span-3 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] p-6"
    >
      <header className="mb-4 flex items-center justify-between gap-2 border-b border-[color:var(--color-hairline)] pb-2">
        <div className="flex items-center gap-2">
          <Award
            className="size-4 text-[color:var(--color-accent)]"
            aria-hidden="true"
          />
          <h2 id="badges-h" className="font-display text-lg">
            Recent achievements
          </h2>
        </div>
        <Link
          href="/dashboard/profile#achievements"
          className="text-xs text-[color:var(--color-brand)] hover:underline"
        >
          View all
        </Link>
      </header>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {badges.map((b) => {
          const meta = BADGE_CATALOG[b.slug];
          const awardedLabel = fmt.format(new Date(b.awardedAt));
          return (
            <li
              key={b.slug}
              className="flex items-center gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4"
              title={meta.description}
            >
              <div className="shrink-0">
                <Image
                  src={meta.artwork}
                  alt=""
                  width={56}
                  height={56}
                  className="size-14"
                />
              </div>
              <div className="min-w-0">
                <div className="text-[0.62rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                  Earned  {awardedLabel}
                </div>
                <div className="mt-0.5 font-display text-base leading-tight text-[color:var(--color-ink)]">
                  {meta.title}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-[color:var(--color-ink-soft)]">
                  {meta.description}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
