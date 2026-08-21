"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { updateSetting } from "@/lib/admin/settings-actions";
import type { SettingKey } from "@/lib/admin/settings";

interface Props {
  values: Record<SettingKey, unknown>;
}

interface SettingRow {
  key: SettingKey;
  label: string;
  type: "number" | "boolean" | "managed";
  hint?: string;
  /** For "managed" rows: where the real, ack-gated switch lives. */
  href?: string;
}

const ROWS: SettingRow[] = [
  {
    key: "freshness_band_days_fresh",
    label: "Fresh, confirmed within",
    type: "number",
    hint: "Days (≥1, ≤365)",
  },
  {
    key: "freshness_band_days_ageing",
    label: "Ageing, older than",
    type: "number",
    hint: "Days (must be > fresh)",
  },
  {
    key: "ranking_weight_freshness",
    label: "Freshness confidence weight",
    type: "number",
    hint: "0 – 5 (default 1.0)",
  },
  {
    key: "ranking_weight_completeness",
    label: "Profile completeness weight",
    type: "number",
    hint: "0 – 5 (default 1.0)",
  },
  {
    key: "ranking_weight_citizen_boost",
    label: "Citizen-highlight boost",
    type: "number",
    hint: "1 – 2 (default 1.08)",
  },
  {
    key: "feature_flag_2fa_enforced",
    label: "Enforce 2FA for admin & employer sign-ins",
    type: "boolean",
  },
  {
    key: "feature_flag_email_notifications",
    label: "Send transactional emails (Phase 8)",
    type: "boolean",
  },
  {
    key: "feature_flag_gov_portal",
    label: "Government partner portal (Phase 9)",
    type: "boolean",
  },
  {
    key: "feature_flag_kyc_provider",
    label: "Real KYC provider (requires partnership + creds)",
    type: "boolean",
  },
  {
    key: "feature_flag_saqa_worker",
    label: "SAQA NLRD verification worker (requires partnership + creds)",
    type: "boolean",
  },
  {
    key: "feature_flag_employer_mix_lookup",
    label:
      "Gov per-employer mix lookup (9.7.6, ships dormant; activate when DEL §8 partnership lands)",
    type: "boolean",
  },
  // ── Launch switches ──────────────────────────────────────────────
  // Features that shipped dark. Until 2026-08-21 these flags existed in
  // the registry but had NO toggle anywhere in the product, so the only
  // way to launch a finished feature was a manual database write. Every
  // dark-shipped flag must land a row here in the same commit.
  {
    key: "feature_flag_selfie_verification",
    label: "Selfie verification (the Verified badge)",
    type: "boolean",
    hint:
      "Seekers earn the profile badge with an in-browser live selfie. " +
      "All processing stays on their device; nothing biometric reaches the server.",
  },
  {
    key: "feature_flag_vacancy_self_apply",
    label: "Vacancy Self Apply (public apply links)",
    type: "boolean",
    hint:
      "Employers can enable a public apply link per vacancy. Second gate: " +
      "each vacancy's own toggle must also be on.",
  },
  {
    key: "feature_flag_seeker_projects",
    label: "Work & projects on seeker profiles",
    type: "boolean",
    hint:
      "Project links + images, self-declared. Never counts toward " +
      "completeness or ranking.",
  },
  {
    key: "feature_flag_web_push",
    label: "Web push notifications (phones)",
    type: "boolean",
    hint:
      "Killswitch for push delivery. Needs the Push integration configured, " +
      "tested and enabled on Integrations first. Turning this off stops sends " +
      "without touching anyone's subscription.",
  },
  {
    key: "feature_flag_sms_channel_enabled",
    label: "SMS notifications channel",
    type: "boolean",
    hint:
      "Critical notifications by SMS. Needs the SMS integration configured " +
      "on Integrations; sends also require per-user consent + verified phone.",
  },
  {
    key: "feature_flag_whatsapp_channel_enabled",
    label: "WhatsApp notifications channel",
    type: "boolean",
    hint: "Same gates as SMS, over WhatsApp Business.",
  },
  {
    key: "feature_flag_sms_quiet_hours_start",
    label: "SMS quiet hours start (SAST)",
    type: "number",
    hint: "0 - 23 (default 21). No SMS/WhatsApp sends after this hour.",
  },
  {
    key: "feature_flag_sms_quiet_hours_end",
    label: "SMS quiet hours end (SAST)",
    type: "number",
    hint: "0 - 23 (default 7). Sends resume at this hour.",
  },
  {
    key: "feature_flag_llm_curriculum_enabled",
    label: "AI curriculum drafts",
    type: "boolean",
    hint:
      "Lets the configured LLM draft learning-path suggestions for admin " +
      "approval. Needs an active provider on the LLM page.",
  },
  {
    key: "testimonial_campaign_active",
    label: "Testimonial campaign",
    type: "boolean",
    hint: "Shows the testimonial prompt card to eligible seekers.",
  },
  {
    key: "feature_flag_seeker_ai_coach",
    label: "AI Coach (seekers)",
    type: "managed",
    href: "/admin/llm",
    hint:
      "Ack-gated: the safety review acknowledgement lives with the switch " +
      "on the LLM page, so it cannot be flipped from here.",
  },
  {
    key: "feature_flag_id_verification_enabled",
    label: "ID / passport collection",
    type: "managed",
    href: "/admin/verifications",
    hint:
      "Ack-gated on the verifications page. Removal of an already-saved ID " +
      "is never gated, only collection is.",
  },
  {
    key: "feature_flag_verification_badges_visible",
    label:
      "Show verification badges on profiles (9.16.1, turn off while verification volume is still thin)",
    type: "boolean",
  },
  {
    key: "outcomes_min_cohort_size",
    label: "Outcomes minimum cohort size (k-anonymity floor)",
    type: "number",
    hint:
      "5 – 200 (default 10). Cohort cells below this are suppressed " +
      "on /insights and exports. Lower with extreme care.",
  },
  {
    key: "lmi_demand_floor",
    label: "Demand floor (Justification Index)",
    type: "number",
    hint:
      "0.3 – 10 (default 1.0). 1.0 = 10 distinct employers searched / " +
      "province / 30 days. Cells below this floor are not classified.",
  },
  {
    key: "lmi_local_supply_threshold",
    label: "Local supply ratio threshold",
    type: "number",
    hint:
      "0.1 – 5 (default 0.5). Below this ratio (SA supply ÷ demand × 10) " +
      "AND the other shortage conditions = 'genuine local shortage'.",
  },
  {
    key: "lmi_foreign_fill_floor",
    label: "Foreign-fill share floor",
    type: "number",
    hint:
      "0.1 – 1 (default 0.5). Share of confirmed placements that went to " +
      "foreign nationals before the fill-pattern condition fires.",
  },
  {
    key: "employer_mix_min_placements",
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
    label:
      "Seeker · The Climb, live skill journey (learning progress + visible rank payoff + seeker-set proficiency)",
    type: "boolean",
  },
  {
    key: "feature_flag_seeker_demand_pulse",
    label:
      "Seeker · Demand Pulse, weekly “your skill is heating up near you” nudge",
    type: "boolean",
  },
  {
    key: "feature_flag_seeker_ai_coach",
    label:
      "Seeker · AI Career Coach, interview practice (also requires a configured + budgeted LLM provider on /admin/llm)",
    type: "boolean",
  },
  {
    key: "feature_flag_living_catalog",
    label:
      "Seeker · Living Learning Catalog, path reviews + “recommended by N of M” roll-up on learning-path cards",
    type: "boolean",
  },
  {
    key: "feature_flag_seeker_custom_skills",
    label:
      "Seeker · Custom skills, add up to 3 self-described skills outside the taxonomy (never searchable until canonicalized)",
    type: "boolean",
  },
  {
    key: "feature_flag_skill_prereqs",
    label:
      "Seeker · Skill prerequisites, sequence recommendations (prereqs first), “Requires:” pills, and the “Unlocks next” moment",
    type: "boolean",
  },
  {
    key: "feature_flag_city_demand",
    label:
      "Seeker · Hyper-local demand, “Your city’s hotspots” (top-5 metros only, k-anon floor, requires the seeker’s research-insights consent)",
    type: "boolean",
  },
];

export function SettingsForm({ values }: Props) {
  return (
    <div className="grid gap-10 md:grid-cols-2">
      <section className="md:col-span-2">
        <h2 className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-xl">
          Freshness bands
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {ROWS.filter((r) => r.key.startsWith("freshness_band")).map((row) => (
            <SettingRow key={row.key} row={row} value={values[row.key]} />
          ))}
        </div>
      </section>

      <section className="md:col-span-2">
        <h2 className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-xl">
          Search ranking weights
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {ROWS.filter((r) => r.key.startsWith("ranking_weight")).map((row) => (
            <SettingRow key={row.key} row={row} value={values[row.key]} />
          ))}
        </div>
      </section>

      <section className="md:col-span-2">
        <h2 className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-xl">
          Outcomes (Phase 7.5)
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {ROWS.filter((r) => r.key === "outcomes_min_cohort_size").map((row) => (
            <SettingRow key={row.key} row={row} value={values[row.key]} />
          ))}
        </div>
      </section>

      <section className="md:col-span-2">
        <h2 className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-xl">
          Shortage Justification Index (Phase 9.7.3)
        </h2>
        <p className="mb-4 text-sm text-[color:var(--color-ink-soft)]">
          Explicit, plain-language thresholds that drive the cell
          classifier on <code>/gov/shortage</code>. Same values feed the
          per-employer lookup in 9.7.6.
          <strong> The formula is published verbatim on /gov</strong>
           policy users can argue with these numbers from the page,
          which is the point.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {ROWS.filter((r) =>
            ["lmi_demand_floor", "lmi_local_supply_threshold", "lmi_foreign_fill_floor", "employer_mix_min_placements"].includes(
              r.key,
            ),
          ).map((row) => (
            <SettingRow key={row.key} row={row} value={values[row.key]} />
          ))}
        </div>
      </section>

      <section className="md:col-span-2">
        <h2 className="mb-4 border-b-2 border-[color:var(--color-ink)] pb-2 font-display text-xl">
          Feature flags
        </h2>
        <ul className="space-y-3">
          {ROWS.filter((r) => r.type !== "number").map((row) => (
            <SettingRow key={row.key} row={row} value={values[row.key]} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function SettingRow({ row, value }: { row: SettingRow; value: unknown }) {
  const [pending, startTransition] = useTransition();
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
  const [draft, setDraft] = useState<string>(String(value ?? ""));
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

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
      <li className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-4 py-3">
        <span className="text-sm">{row.label}</span>
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
