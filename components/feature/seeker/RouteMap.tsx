/**
 * "Your route": the role blueprint drawn as three stations (core, expected,
 * next-level tracks) in Civic Editorial. Server component; the only
 * interactive part is the Start-this-route button per track. Pure HTML +
 * CSS, no chart library, nothing loads lazily, nothing animates.
 */

import { getTranslations } from "next-intl/server";
import { Check, Circle } from "lucide-react";

import type {
  RouteMap as RouteMapData,
  RouteSkill,
} from "@/lib/blueprints/engine";
import { StartTrackButton } from "@/components/feature/seeker/learning/StartTrackButton";

function SkillLine({ skill }: { skill: RouteSkill }) {
  return (
    <li className="flex items-start gap-2.5 py-1.5">
      {skill.owned ? (
        <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand)] text-[color:var(--color-paper)]">
          <Check className="size-3" aria-hidden="true" />
        </span>
      ) : (
        <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-dashed border-[color:var(--color-ink-soft)] text-[color:var(--color-ink-soft)]">
          <Circle className="size-2" aria-hidden="true" />
        </span>
      )}
      <span className="min-w-0">
        <span
          className={
            "text-sm " +
            (skill.owned
              ? "text-[color:var(--color-ink)]"
              : "text-[color:var(--color-ink-soft)]")
          }
        >
          {skill.label}
        </span>
        {skill.demand && skill.demand.searches > 0 && !skill.owned && (
          <span className="ml-2 rounded-[var(--radius-pill)] border border-[color:var(--color-accent)] bg-[color:var(--color-accent-tint)] px-1.5 py-0.5 text-[0.58rem] uppercase tracking-[0.16em] text-[color:var(--color-accent)]">
            {skill.demand.searches}
          </span>
        )}
      </span>
    </li>
  );
}

export async function RouteMap({
  data,
  professionLabel,
}: {
  data: RouteMapData;
  professionLabel: string;
}) {
  const t = await getTranslations("seekerDash.grow.route");
  const startLabels = {
    start: t("start"),
    starting: t("starting"),
    started: t("started"),
  };
  const stations: Array<{
    n: string;
    title: string;
    covered: number;
    total: number;
    skills: RouteSkill[];
  }> = [
    {
      n: "01",
      title: t("core"),
      covered: data.coreCovered,
      total: data.core.length,
      skills: data.core,
    },
    {
      n: "02",
      title: t("expected"),
      covered: data.expectedCovered,
      total: data.expected.length,
      skills: data.expected,
    },
  ];

  return (
    <section
      aria-labelledby="route-h"
      className="mt-10 rounded-[var(--radius-md)] border-2 border-[color:var(--color-ink)] bg-[color:var(--color-surface)] p-6 md:p-8"
    >
      <header className="mb-6 border-b-2 border-[color:var(--color-ink)] pb-3">
        <div className="text-[0.7rem] uppercase tracking-[0.24em] text-[color:var(--color-accent)]">
          {t("eyebrow")}
        </div>
        <h2 id="route-h" className="mt-1 font-display text-2xl md:text-3xl">
          {t("title", { profession: professionLabel })}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--color-ink-soft)]">
          {t("sub")}
        </p>
      </header>

      <ol className="grid gap-6 md:grid-cols-[1fr_1fr_1.4fr]">
        {stations.map((s) => (
          <li
            key={s.n}
            className="border-l-2 border-[color:var(--color-ink)] pl-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-xl italic text-[color:var(--color-accent)]">
                  {s.n}
                </span>
                <h3 className="text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
                  {s.title}
                </h3>
              </div>
              <span className="font-display tabular text-base text-[color:var(--color-ink)]">
                {s.covered}
                <span className="text-[color:var(--color-ink-soft)]">
                  /{s.total}
                </span>
              </span>
            </div>
            <ul className="mt-2">
              {s.skills.map((sk) => (
                <SkillLine key={sk.slug} skill={sk} />
              ))}
            </ul>
          </li>
        ))}

        <li className="border-l-2 border-[color:var(--color-ink)] pl-4">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-xl italic text-[color:var(--color-accent)]">
              03
            </span>
            <h3 className="text-[0.72rem] uppercase tracking-[0.22em] text-[color:var(--color-ink)]">
              {t("next")}
            </h3>
          </div>
          <div className="mt-2 grid gap-3">
            {data.tracks.map((track) => {
              const missing = track.skills
                .filter((sk) => !sk.owned)
                .map((sk) => sk.slug);
              return (
                <div
                  key={track.name}
                  className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h4 className="font-display text-lg">{track.name}</h4>
                    <span className="font-display tabular text-sm text-[color:var(--color-ink)]">
                      {track.ownedCount}
                      <span className="text-[color:var(--color-ink-soft)]">
                        /{track.skills.length}
                      </span>
                    </span>
                  </div>
                  <ul className="mt-1">
                    {track.skills.map((sk) => (
                      <SkillLine key={sk.slug} skill={sk} />
                    ))}
                  </ul>
                  <div className="mt-3">
                    <StartTrackButton
                      trackName={track.name}
                      missingSlugs={missing}
                      labels={startLabels}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </li>
      </ol>

      <p className="mt-6 text-xs text-[color:var(--color-ink-soft)]">
        {t("honest")}
      </p>
    </section>
  );
}
