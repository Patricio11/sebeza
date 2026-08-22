"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { updateSetting } from "@/lib/admin/settings-actions";
import type { SettingKey } from "@/lib/admin/settings";

interface Props {
  values: Record<SettingKey, unknown>;
  /** The email pipeline diagnostic, rendered only under Notifications. */
  emailTestSlot?: React.ReactNode;
}

type SettingsTab =
  | "launch"
  | "growth"
  | "notifications"
  | "verification"
  | "ranking";

interface SettingRow {
  key: SettingKey;
  label: string;
  type: "number" | "boolean" | "managed";
  hint?: string;
  /** For "managed" rows: where the real, ack-gated switch lives. */
  href?: string;
  /** Which tab the row renders under. */
  group: SettingsTab;
}

/** Founder decision, 2026-08-21: one page for every flag, but tabbed,
 *  because sixty rows in a single column is a wall, not a control room.
 *  The tab is part of the row definition so a new setting cannot be
 *  added without deciding where it belongs. */
const TABS: Array<{ id: SettingsTab; label: string; blurb: string }> = [
  {
    id: "launch",
    label: "Launch",
    blurb:
      "Features that shipped dark and wait here for the day you flip them on.",
  },
  {
    id: "growth",
    label: "Growth & AI",
    blurb:
      "The seeker growth loop and everything the platform's AI is allowed to do.",
  },
  {
    id: "notifications",
    label: "Notifications",
    blurb:
      "Which channels may reach users, and when they must stay quiet.",
  },
  {
    id: "verification",
    label: "Verification & access",
    blurb: "Identity, partnerships, and who gets through which door.",
  },
  {
    id: "ranking",
    label: "Ranking & data",
    blurb:
      "The numbers behind search ranking and the honesty floors on analytics.",
  },
];

const ROWS: SettingRow[] = [
  {
    key: "freshness_band_days_fresh",
    group: "ranking",
    label: "Fresh, confirmed within",
    type: "number",
    hint: "Days (≥1, ≤365)",
  },
  {
    key: "freshness_band_days_ageing",
    group: "ranking",
    label: "Ageing, older than",
    type: "number",
    hint: "Days (must be > fresh)",
  },
  {
    key: "ranking_weight_freshness",
    group: "ranking",
    label: "Freshness confidence weight",
    type: "number",
    hint: "0 – 5 (default 1.0)",
  },
  {
    key: "ranking_weight_completeness",
    group: "ranking",
    label: "Profile completeness weight",
    type: "number",
    hint: "0 – 5 (default 1.0)",
  },
  {
    key: "ranking_weight_citizen_boost",
    group: "ranking",
    label: "Citizen-highlight boost",
    type: "number",
    hint: "1 – 2 (default 1.08)",
  },
  {
    key: "feature_flag_2fa_enforced",
    group: "verification",
    label: "Enforce 2FA for admin & employer sign-ins",
    type: "boolean",
  },
  {
    key: "feature_flag_email_notifications",
    group: "notifications",
    label: "Email notifications",
    hint:
      "Transactional email for the notification kinds users opted into. Configure and test the Email provider on Integrations first.",
    type: "boolean",
  },
  {
    key: "feature_flag_gov_portal",
    group: "verification",
    label: "Government partner portal",
    hint: "Read-only national analytics portal for government partners.",
    type: "boolean",
  },
  {
    key: "feature_flag_kyc_provider",
    group: "verification",
    label: "Real KYC provider (requires partnership + creds)",
    type: "boolean",
  },
  {
    key: "feature_flag_saqa_worker",
    group: "verification",
    label: "SAQA NLRD verification worker (requires partnership + creds)",
    type: "boolean",
  },
  {
    key: "feature_flag_employer_mix_lookup",
    group: "verification",
    label: "Per-employer mix lookup (government)",
    hint:
      "Ships dormant. Activate when the DEL §8 partnership lands.",
    type: "boolean",
  },
  // ── Launch switches ──────────────────────────────────────────────
  // Features that shipped dark. Until 2026-08-21 these flags existed in
  // the registry but had NO toggle anywhere in the product, so the only
  // way to launch a finished feature was a manual database write. Every
  // dark-shipped flag must land a row here in the same commit.
  {
    key: "feature_flag_selfie_verification",
    group: "launch",
    label: "Selfie verification (the Verified badge)",
    type: "boolean",
    hint:
      "Seekers earn the profile badge with an in-browser live selfie. " +
      "All processing stays on their device; nothing biometric reaches the server.",
  },
  {
    key: "feature_flag_vacancy_self_apply",
    group: "launch",
    label: "Vacancy Self Apply (public apply links)",
    type: "boolean",
    hint:
      "Employers can enable a public apply link per vacancy. Second gate: " +
      "each vacancy's own toggle must also be on.",
  },
  {
    key: "feature_flag_seeker_projects",
    group: "launch",
    label: "Work & projects on seeker profiles",
    type: "boolean",
    hint:
      "Project links + images, self-declared. Never counts toward " +
      "completeness or ranking.",
  },
  {
    key: "feature_flag_web_push",
    group: "notifications",
    label: "Web push notifications (phones)",
    type: "boolean",
    hint:
      "Killswitch for push delivery. Needs the Push integration configured, " +
      "tested and enabled on Integrations first. Turning this off stops sends " +
      "without touching anyone's subscription.",
  },
  {
    key: "feature_flag_sms_channel_enabled",
    group: "notifications",
    label: "SMS notifications channel",
    type: "boolean",
    hint:
      "Critical notifications by SMS. Needs the SMS integration configured " +
      "on Integrations; sends also require per-user consent + verified phone.",
  },
  {
    key: "feature_flag_whatsapp_channel_enabled",
    group: "notifications",
    label: "WhatsApp notifications channel",
    type: "boolean",
    hint: "Same gates as SMS, over WhatsApp Business.",
  },
  {
    key: "feature_flag_sms_quiet_hours_start",
    group: "notifications",
    label: "SMS quiet hours start (SAST)",
    type: "number",
    hint: "0 - 23 (default 21). No SMS/WhatsApp sends after this hour.",
  },
  {
    key: "feature_flag_sms_quiet_hours_end",
    group: "notifications",
    label: "SMS quiet hours end (SAST)",
    type: "number",
    hint: "0 - 23 (default 7). Sends resume at this hour.",
  },
  {
    key: "feature_flag_llm_curriculum_enabled",
    group: "growth",
    label: "AI curriculum drafts",
    type: "boolean",
    hint:
      "Lets the configured LLM draft learning-path suggestions for admin " +
      "approval. Needs an active provider on the LLM page.",
  },
  {
    key: "testimonial_campaign_active",
    group: "growth",
    label: "Testimonial campaign",
    type: "boolean",
    hint: "Shows the testimonial prompt card to eligible seekers.",
  },
  {
    key: "feature_flag_seeker_ai_coach",
    group: "growth",
    label: "AI Coach (seekers)",
    type: "managed",
    href: "/admin/llm",
    hint:
      "Ack-gated: the safety review acknowledgement lives with the switch " +
      "on the LLM page, so it cannot be flipped from here.",
  },
  {
    key: "feature_flag_id_verification_enabled",
    group: "verification",
    label: "ID / passport collection",
    type: "managed",
    href: "/admin/verifications",
    hint:
      "Ack-gated on the verifications page. Removal of an already-saved ID " +
      "is never gated, only collection is.",
  },
  {
    key: "feature_flag_verification_badges_visible",
    group: "verification",
    label: "Show verification badges on profiles",
    hint: "Turn off while verification volume is still thin.",
    type: "boolean",
  },
  {
    key: "outcomes_min_cohort_size",
    group: "ranking",
    label: "Outcomes minimum cohort size (k-anonymity floor)",
    type: "number",
    hint:
      "5 – 200 (default 10). Cohort cells below this are suppressed " +
      "on /insights and exports. Lower with extreme care.",
  },
  {
    key: "lmi_demand_floor",
    group: "ranking",
    label: "Demand floor (Justification Index)",
    type: "number",
    hint:
      "0.3 – 10 (default 1.0). 1.0 = 10 distinct employers searched / " +
      "province / 30 days. Cells below this floor are not classified.",
  },
  {
    key: "lmi_local_supply_threshold",
    group: "ranking",
    label: "Local supply ratio threshold",
    type: "number",
    hint:
      "0.1 – 5 (default 0.5). Below this ratio (SA supply ÷ demand × 10) " +
      "AND the other shortage conditions = 'genuine local shortage'.",
  },
  {
    key: "lmi_foreign_fill_floor",
    group: "ranking",
    label: "Foreign-fill share floor",
    type: "number",
    hint:
      "0.1 – 1 (default 0.5). Share of confirmed placements that went to " +
      "foreign nationals before the fill-pattern condition fires.",
  },
  {
    key: "employer_mix_min_placements",
    group: "ranking",
    label: "Employer-mix minimum placements",
    type: "number",
    hint:
      "3 – 200 (default 5). Minimum employer-confirmed placements before " +
      "the Justification Index OR per-employer lookup will classify the " +
      "cell. Single source of truth for both surfaces.",
  },
  // Seeker growth suite  all ship dark (default OFF); flip on when ready.
  {
    key: "feature_flag_seeker_skill_journey",
    group: "growth",
    label:
      "Seeker · The Climb, live skill journey (learning progress + visible rank payoff + seeker-set proficiency)",
    type: "boolean",
  },
  {
    key: "feature_flag_seeker_demand_pulse",
    group: "growth",
    label: "Seeker · Demand Pulse",
    hint: "Weekly nudge when a seeker's skill is heating up near them.",
    type: "boolean",
  },
  {
    key: "feature_flag_living_catalog",
    group: "growth",
    label:
      "Seeker · Living Learning Catalog, path reviews + “recommended by N of M” roll-up on learning-path cards",
    type: "boolean",
  },
  {
    key: "feature_flag_seeker_custom_skills",
    group: "growth",
    label:
      "Seeker · Custom skills, add up to 3 self-described skills outside the taxonomy (never searchable until canonicalized)",
    type: "boolean",
  },
  {
    key: "feature_flag_skill_prereqs",
    group: "growth",
    label:
      "Seeker · Skill prerequisites, sequence recommendations (prereqs first), “Requires:” pills, and the “Unlocks next” moment",
    type: "boolean",
  },
  {
    key: "feature_flag_city_demand",
    group: "growth",
    label:
      "Seeker · Hyper-local demand, “Your city’s hotspots” (top-5 metros only, k-anon floor, requires the seeker’s research-insights consent)",
    type: "boolean",
  },
];

export function SettingsForm({ values, emailTestSlot }: Props) {
  // Deep-linkable (?tab=notifications) without a navigation: reading
  // once at mount and mirroring into the URL keeps this a plain client
  // island with no router coupling. No-Flash: the tab switch re-renders
  // a filtered list, nothing animates, nothing refetches.
  const [tab, setTab] = useState<SettingsTab>(() => {
    if (typeof window === "undefined") return "launch";
    const t = new URLSearchParams(window.location.search).get("tab");
    return TABS.some((x) => x.id === t) ? (t as SettingsTab) : "launch";
  });

  function switchTab(next: SettingsTab) {
    setTab(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  }

  const active = TABS.find((t) => t.id === tab)!;
  const rows = ROWS.filter((r) => r.group === tab);
  const numbers = rows.filter((r) => r.type === "number");
  const switches = rows.filter((r) => r.type !== "number");

  return (
    <div>
      {/* The tab rail. Editorial, not app-chrome: an underline, not a
          pill bar. */}
      <div
        role="tablist"
        aria-label="Setting groups"
        className="flex flex-wrap gap-x-6 gap-y-2 border-b border-[color:var(--color-hairline)]"
      >
        {TABS.map((t) => {
          const isActive = t.id === tab;
          const count = ROWS.filter((r) => r.group === t.id).length;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => switchTab(t.id)}
              className={
                "-mb-px flex items-baseline gap-1.5 border-b-2 px-1 pb-2.5 text-[0.72rem] uppercase tracking-[0.18em] transition-colors " +
                (isActive
                  ? "border-[color:var(--color-ink)] font-medium text-[color:var(--color-ink)]"
                  : "border-transparent text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]")
              }
            >
              {t.label}
              <span
                className={
                  "text-[0.6rem] tabular-nums " +
                  (isActive
                    ? "text-[color:var(--color-ink-soft)]"
                    : "text-[color:var(--color-ink-soft)]/60")
                }
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 max-w-2xl text-sm text-[color:var(--color-ink-soft)]">
        {active.blurb}
      </p>

      {switches.length > 0 && (
        <ul className="mt-6 grid gap-3 lg:grid-cols-2">
          {switches.map((row) => (
            <SettingRow key={row.key} row={row} value={values[row.key]} />
          ))}
        </ul>
      )}

      {tab === "notifications" && emailTestSlot && (
        <div className="mt-8">{emailTestSlot}</div>
      )}

      {numbers.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-lg">
            Thresholds
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {numbers.map((row) => (
              <SettingRow key={row.key} row={row} value={values[row.key]} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SettingRow({ row, value }: { row: SettingRow; value: unknown }) {
  const [pending, startTransition] = useTransition();
  // Hooks run unconditionally (rules-of-hooks); the managed early
  // return below simply never reads the draft/status state.
  const [draft, setDraft] = useState<string>(String(value ?? ""));
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  // Ack-gated switches render as a status + a link to the real switch.
  // Duplicating the toggle here would bypass the acknowledgement flow,
  // and a bypassable safety ack is not an ack.
  if (row.type === "managed") {
    return (
      <li className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm text-[color:var(--color-ink)]">{row.label}</div>
          {row.hint && (
            <p className="mt-0.5 text-xs text-[color:var(--color-ink-soft)]">{row.hint}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[0.65rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
            {value ? "On" : "Off"}
          </span>
          <Link
            href={(row.href ?? "/admin") as never}
            className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-3 py-1 text-xs hover:border-[color:var(--color-ink)]"
          >
            Manage
          </Link>
        </div>
      </li>
    );
  }
  function save(next: unknown) {
    setError(null);
    setStatus("idle");
    startTransition(async () => {
      const res = await updateSetting({ key: row.key, value: next });
      if (!res.ok) {
        setError(res.message);
        setStatus("error");
      } else {
        setStatus("saved");
      }
    });
  }

  if (row.type === "boolean") {
    const on = value === true;
    return (
      <li className="flex items-start justify-between gap-4 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-3">
        <div className="min-w-0">
          <span className="text-sm">{row.label}</span>
          {row.hint && (
            <p className="mt-0.5 text-xs leading-relaxed text-[color:var(--color-ink-soft)]">
              {row.hint}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {status === "saved" && (
            <span className="text-xs text-[color:var(--color-employed)]">Saved</span>
          )}
          {error && (
            <span className="text-xs text-[color:var(--color-danger)]">{error}</span>
          )}
          <button
            type="button"
            role="switch"
            aria-checked={on}
            disabled={pending}
            onClick={() => save(!on)}
            className={
              "h-6 w-11 rounded-full border transition-colors " +
              (on
                ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)]"
                : "border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)]")
            }
          >
            <span
              className={
                "block size-5 rounded-full bg-white transition-transform " +
                (on ? "translate-x-5" : "translate-x-0.5")
              }
            />
          </button>
        </div>
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={`setting-${row.key}`}
        className="text-[0.7rem] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)]"
      >
        {row.label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={`setting-${row.key}`}
          type="number"
          step="any"
          value={draft}
          disabled={pending}
          onChange={(e) => setDraft(e.target.value)}
          className="h-10 flex-1 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 text-sm"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending || draft === String(value ?? "")}
          onClick={() => {
            const n = Number(draft);
            if (!Number.isFinite(n)) {
              setError("Must be a number.");
              setStatus("error");
              return;
            }
            save(n);
          }}
        >
          {pending ? "…" : "Save"}
        </Button>
      </div>
      <p className="text-[0.68rem] text-[color:var(--color-ink-soft)]">
        {row.hint}
        {status === "saved" && (
          <span className="ml-2 text-[color:var(--color-employed)]">Saved.</span>
        )}
        {error && (
          <span className="ml-2 text-[color:var(--color-danger)]">{error}</span>
        )}
      </p>
    </div>
  );
}
