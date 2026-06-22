"use client";

/**
 * Phase 10.1 / 10.2  client-side fuzzy search for the help index
 * page.
 *
 * Rank-and-filter per D4:
 *
 *   1. Exact title match           rank 0 (top)
 *   2. Prefix title match           rank 1
 *   3. Exact keyword match          rank 2
 *   4. Title substring              rank 3
 *   5. shortDescription substring   rank 4
 *   6. Category label substring     rank 5
 *   7. Multi-token match            rank 6
 *
 * No fuzzy-distance scoring  prefix + substring covers ~95% of
 * intent. With ~30 articles the loop is trivial; renders in well
 * under 5ms even on a low-end Android over 3G.
 *
 * State is URL-synced (`?q=`) so deep-links / refresh / share-link
 * preserve the search. The input is controlled + writes to the URL
 * with `router.replace` (no history pollution).
 *
 * Phase 10.2 made the island role-agnostic: the caller passes
 * `basePath` (e.g. "/employer/help" or "/dashboard/help"),
 * `categoryLabels` (the role's category-value → label map), and the
 * `placeholder` text. Employer + seeker reuse this verbatim; admin +
 * gov will follow in 10.3 / 10.4.
 */

import { useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import type { HelpArticleMeta } from "@/content/help/types";
import { Search, X, ChevronRight } from "lucide-react";

interface Props {
  /** Flattened article-metadata list, no React components needed for
   *  the index page  the link target is just the slug. */
  articles: HelpArticleMeta[];
  /** Initial query from URL (server-rendered into the input). */
  initialQuery: string;
  /** Base route this help centre lives under, no trailing slash. The
   *  search input writes back to `${basePath}?q=…`; result cards link
   *  to `${basePath}/${slug}`. */
  basePath: string;
  /** Map of category-value → human label for displaying the eyebrow
   *  on each result card. Roles use disjoint category enums so the
   *  caller passes whichever map matches its articles. */
  categoryLabels: Record<string, string>;
  /** Placeholder + aria-label for the input. Role-specific copy
   *  ("Search the employer help center"). */
  placeholder: string;
}

interface RankedArticle {
  meta: HelpArticleMeta;
  rank: number;
}

function rankArticle(
  meta: HelpArticleMeta,
  q: string,
  categoryLabel: string,
): number | null {
  const title = meta.title.toLowerCase();
  const short = meta.shortDescription.toLowerCase();
  const kws = meta.keywords.map((k) => k.toLowerCase());
  const cat = categoryLabel.toLowerCase();

  if (title === q) return 0;
  if (title.startsWith(q)) return 1;
  if (kws.includes(q)) return 2;
  if (title.includes(q)) return 3;
  if (short.includes(q)) return 4;
  if (cat.includes(q)) return 5;
  if (q.includes(" ")) {
    const tokens = q.split(/\s+/).filter(Boolean);
    const haystack = `${title} ${short} ${kws.join(" ")} ${cat}`;
    if (tokens.every((t) => haystack.includes(t))) return 6;
  }
  return null;
}

export function HelpSearchIsland({
  articles,
  initialQuery,
  basePath,
  categoryLabels,
  placeholder,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  function updateQuery(next: string) {
    setQuery(next);
    const trimmed = next.trim();
    const path = trimmed
      ? `${basePath}?q=${encodeURIComponent(trimmed)}`
      : basePath;
    router.replace(path as never, { scroll: false });
  }

  const q = query.trim().toLowerCase();
  const results: RankedArticle[] | null = useMemo(() => {
    if (q.length === 0) return null;
    const matches: RankedArticle[] = [];
    for (const meta of articles) {
      const rank = rankArticle(meta, q, categoryLabels[meta.category] ?? "");
      if (rank !== null) matches.push({ meta, rank });
    }
    matches.sort((a, b) => a.rank - b.rank);
    return matches;
  }, [q, articles, categoryLabels]);

  return (
    <div>
      <div className="relative mb-6">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[color:var(--color-ink-soft)]"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => updateQuery(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="h-12 w-full rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] pl-10 pr-10 text-[0.95rem] text-[color:var(--color-ink)] outline-none transition-colors placeholder:text-[color:var(--color-ink-soft)] focus:border-[color:var(--color-ink)]"
        />
        {query && (
          <button
            type="button"
            onClick={() => updateQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-paper)] hover:text-[color:var(--color-ink)]"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {results !== null && (
        <div className="mb-6">
          {results.length === 0 ? (
            <p className="rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-6 text-center text-sm text-[color:var(--color-ink-soft)]">
              No articles match &ldquo;{query}&rdquo;. Try fewer words, or
              {" "}
              <button
                type="button"
                onClick={() => updateQuery("")}
                className="underline underline-offset-2 hover:text-[color:var(--color-ink)]"
              >
                browse by category
              </button>
              {" "}instead.
            </p>
          ) : (
            <>
              <p className="mb-3 text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                {results.length} {results.length === 1 ? "result" : "results"}{" "}
                for &ldquo;{query}&rdquo;
              </p>
              <ul className="space-y-2">
                {results.map(({ meta }) => (
                  <li key={meta.slug}>
                    <Link
                      href={`${basePath}/${meta.slug}` as never}
                      className="group flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4 no-underline transition-colors hover:border-[color:var(--color-ink)]"
                    >
                      <div className="flex-1">
                        <p className="text-[0.65rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]">
                          {categoryLabels[meta.category] ?? meta.category}
                        </p>
                        <p className="mt-1 font-display text-base leading-tight text-[color:var(--color-ink)]">
                          {meta.title}
                        </p>
                        <p className="mt-1 text-[0.85rem] text-[color:var(--color-ink-soft)]">
                          {meta.shortDescription}
                        </p>
                      </div>
                      <ChevronRight
                        className="mt-1 size-4 shrink-0 text-[color:var(--color-ink-soft)] transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
