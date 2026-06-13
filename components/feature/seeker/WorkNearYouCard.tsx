/**
 * Phase 16.1  "Work near you".
 *
 * Foregrounds the location dimension Sebenza already has, expressed in
 * REVERSE-MATCHING terms (not a job-board feed  Sebenza has no seeker
 * vacancy-browse surface by design; see PHASE_16_PLAN.md §D1):
 *
 *   1. Be found near you  the part the seeker controls. Leads the card
 *      (agency first), with profile completeness as the actionable signal.
 *   2. Demand near you  honest employer-search demand for the seeker's
 *      profession, PROVINCE-level (D2, k-anon-safe; it's demand-side
 *      activity, never a seeker cohort), reusing the existing demand
 *      engine (`getNearYouDemand`, D5). Honest empty state when quiet.
 *   3. "Near you OR remote" (D3)  a remote-available seeker is never
 *      penalised; the SA-wide demand line shows their national reach.
 *
 * The pool link is labelled TRUTHFULLY  "see who you're matched against"
 * (the rank-in-pool view), never "opportunities" (16.1.3 / D1). No new
 * geolocation, no GPS, no new matching: it reads the city already on the
 * profile + the existing search/demand surfaces.
 */

import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { MapPin, ArrowUpRight, Compass, Radar } from "lucide-react";
import { getNearYouDemand } from "@/db/queries/career-compass";
import { PROVINCES } from "@/lib/mock/taxonomy";
import type { WorkAvailabilityKind } from "@/lib/mock/types";

export async function WorkNearYouCard({
  profession,
  province,
  city,
  completeness,
  workAvailability,
}: {
  profession: string;
  province: string;
  city: string;
  completeness: number;
  workAvailability: WorkAvailabilityKind[];
}) {
  const t = await getTranslations("seekerDash.nearYou");
  const demand = await getNearYouDemand(profession, province);

  const provinceSlug =
    PROVINCES.find((p) => p.label.toLowerCase() === province.trim().toLowerCase())
      ?.slug ?? province.trim().toLowerCase().replace(/\s+/g, "-");
  const poolHref = `/search?q=${encodeURIComponent(profession)}&province=${provinceSlug}`;

  const isRemote =
    workAvailability.includes("remote") || workAvailability.includes("hybrid");

  return (
    <section
      aria-labelledby="near-you-h"
      className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6"
    >
      <header className="mb-4">
        <p className="inline-flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-brand-strong)]">
          <MapPin className="size-3.5" aria-hidden="true" />
          {t("eyebrow")}
        </p>
        <h2
          id="near-you-h"
          className="mt-1 font-display text-xl text-[color:var(--color-ink)]"
        >
          {t("beFoundTitle", { profession, city })}
        </h2>
      </header>

      {/* 1. Be found  the actionable part, led first (agency). */}
      <div className="flex flex-col gap-3 rounded-[var(--radius-sm)] bg-[color:var(--color-surface-sunk)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-[color:var(--color-ink)]">
            {t("beFoundBody", { city })}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <div
              className="h-1.5 w-28 overflow-hidden rounded-full bg-[color:var(--color-hairline)]"
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full bg-[color:var(--color-brand)]"
                style={{ width: `${Math.max(0, Math.min(100, completeness))}%` }}
              />
            </div>
            <span className="text-xs font-medium text-[color:var(--color-ink-soft)]">
              {t("completeness", { percent: completeness })}
            </span>
          </div>
        </div>
        {completeness < 100 && (
          <Link
            href="/dashboard/profile"
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1 rounded-[var(--radius-pill)] border-2 border-[color:var(--color-ink)] px-4 py-2 text-sm font-medium text-[color:var(--color-ink)] no-underline transition-colors hover:bg-[color:var(--color-ink)] hover:text-[color:var(--color-paper)]"
          >
            {t("completeProfile")}
          </Link>
        )}
      </div>

      {/* 2. Demand context  honest, province-level, with empty state. */}
      <div className="mt-4 border-t border-[color:var(--color-hairline)] pt-4">
        <p className="inline-flex items-center gap-1.5 text-[0.7rem] uppercase tracking-[0.2em] text-[color:var(--color-ink-soft)]">
          <Radar className="size-3.5" aria-hidden="true" />
          {t("demandHeading", { profession })}
        </p>
        {demand.localSearches > 0 ? (
          <p className="mt-1 text-sm text-[color:var(--color-ink)]">
            {t("demand", {
              count: demand.localSearches,
              province,
              days: demand.windowDays,
            })}
          </p>
        ) : (
          <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
            {t("demandEmpty", { province })}
          </p>
        )}
        {/* 3. Near you OR remote (D3). */}
        {isRemote && demand.nationalSearches > 0 && (
          <p className="mt-1 text-sm text-[color:var(--color-ink-soft)]">
            {t("remote", { count: demand.nationalSearches, profession })}
          </p>
        )}
      </div>

      {/* Truthful pool link (16.1.3 / D1)  the rank-in-pool view, never
          "opportunities". */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <Link
          href={poolHref as never}
          className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-[color:var(--color-brand-strong)] no-underline hover:underline"
        >
          <Compass className="size-4" aria-hidden="true" />
          {t("poolLink", { province })}
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
        <Link
          href="/dashboard/profile"
          className="inline-flex min-h-[44px] items-center text-xs text-[color:var(--color-ink-soft)] no-underline hover:text-[color:var(--color-ink)] hover:underline"
        >
          {t("notHere", { city })}
        </Link>
      </div>
    </section>
  );
}
