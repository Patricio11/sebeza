/**
 * Phase 21.2 ("Hyper-Local Demand")  the seeker-facing "Your city's hotspots"
 * surface. Renders only when `getCityDemandHotspots` returned a value (all gates
 * open: flag + top-5 metro + research consent + above the floor), so there's no
 * empty state to apologise for. Editorial: ordinal pillars, tabular counts, an
 * explicit provenance + consent line (honest: it's market signal, not a job).
 *
 * Server component  pure display over the gated query result.
 */

import { MapPin } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { CityDemand } from "@/db/queries/city-demand";

export function CityHotspotsCard({ data }: { data: CityDemand }) {
  return (
    <section aria-labelledby="city-hotspots-h" className="mt-16">
      <header className="mb-5 flex items-baseline justify-between border-b-2 border-[color:var(--color-ink)] pb-2">
        <h2 id="city-hotspots-h" className="flex items-center gap-2 font-display text-2xl">
          <MapPin className="size-5 text-[color:var(--color-accent)]" aria-hidden="true" />
          Your city&rsquo;s hotspots
        </h2>
        <span className="hidden text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)] md:inline">
          {data.city}
        </span>
      </header>
      <p className="mb-6 max-w-2xl text-sm text-[color:var(--color-ink-soft)]">
        What employers are searching for in {data.city}  last 90 days. Hyper-local
        market signal, not a job guarantee.
      </p>

      <ul className="grid gap-4 sm:grid-cols-2">
        {data.hotspots.map((h, i) => (
          <li
            key={h.label}
            className="flex items-center gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4"
          >
            <span className="font-display tabular text-2xl text-[color:var(--color-accent)]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-display text-base">{h.label}</div>
              <div className="text-xs text-[color:var(--color-ink-soft)]">
                <span className="font-medium text-[color:var(--color-ink)]">
                  {h.searches}
                </span>{" "}
                employer search{h.searches === 1 ? "" : "es"} in {data.city}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-[color:var(--color-ink-soft)]">
        Based on employer searches in your city. Shown because you opted into
        research insights .{" "}
        <Link
          href="/dashboard/privacy"
          className="underline underline-offset-2 hover:text-[color:var(--color-ink)]"
        >
          Manage this in Privacy &amp; consent
        </Link>
        .
      </p>
    </section>
  );
}
