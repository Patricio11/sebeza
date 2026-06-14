/**
 * Phase 13.3  /admin/llm  provider configuration + monitoring.
 *
 * Shows the four supported providers (openai, anthropic, mistral,
 * self_hosted) seeded by migration 0045. The admin configures
 * credentials + a monthly budget, tests the connection, activates
 * one provider (DB enforces at-most-one), monitors spend.
 *
 * The kill-switch (`feature_flag_llm_curriculum_enabled`) lives on
 * /admin/settings; this page surfaces its current state at the top
 * so the admin sees both gates in one view.
 */

import { setRequestLocale } from "next-intl/server";
import { asc } from "drizzle-orm";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { ADMIN_NAV } from "@/components/layout/adminNav";
import { verifyAdmin } from "@/lib/auth/dal";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { getSetting } from "@/lib/admin/settings";
import { LlmProvidersManager } from "@/components/feature/admin/LlmProvidersManager";

export const revalidate = 0;

export default async function AdminLlmPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifyAdmin();

  const db = getDb();
  const [providers, killSwitchOn] = await Promise.all([
    db
      .select({
        id: schema.llmProviders.id,
        displayName: schema.llmProviders.displayName,
        active: schema.llmProviders.active,
        hasCredentials: schema.llmProviders.credentialsEnc,
        monthlyBudgetZar: schema.llmProviders.monthlyBudgetZar,
        configuredAt: schema.llmProviders.configuredAt,
        lastUsedAt: schema.llmProviders.lastUsedAt,
        totalCalls: schema.llmProviders.totalCalls,
        totalTokens: schema.llmProviders.totalTokens,
        totalSpendZar: schema.llmProviders.totalSpendZar,
        s72AcknowledgedAt: schema.llmProviders.s72AcknowledgedAt,
      })
      .from(schema.llmProviders)
      .orderBy(asc(schema.llmProviders.id)),
    getSetting<boolean>("feature_flag_llm_curriculum_enabled"),
  ]);

  const view = providers.map((p) => ({
    id: p.id,
    displayName: p.displayName,
    active: p.active,
    hasCredentials: p.hasCredentials != null,
    monthlyBudgetZar: p.monthlyBudgetZar,
    configuredAt: p.configuredAt ? p.configuredAt.toISOString() : null,
    lastUsedAt: p.lastUsedAt ? p.lastUsedAt.toISOString() : null,
    totalCalls: p.totalCalls,
    totalTokens: Number(p.totalTokens),
    totalSpendZar: Number(p.totalSpendZar),
    s72AcknowledgedAt: p.s72AcknowledgedAt
      ? p.s72AcknowledgedAt.toISOString()
      : null,
  }));

  const activeProvider = view.find((p) => p.active) ?? null;

  return (
    <DashboardMasthead
      role="admin"
      workspaceLabel={session.name ?? "Admin"}
      workspaceEyebrow="Administrator · 2FA required"
      nav={ADMIN_NAV}
      activeKey="llm"
      pageEyebrow="Editorial pipeline"
      pageTitle="LLM providers"
      pageSubtitle={
        killSwitchOn
          ? activeProvider
            ? `Kill-switch ON · ${activeProvider.displayName} is the active provider for /admin/curriculum.`
            : "Kill-switch ON, no provider active. Activate one to start curating."
          : "Kill-switch OFF on /admin/settings. Configure + test providers here; nothing dispatches until you flip the switch."
      }
    >
      <KillSwitchBanner on={killSwitchOn} />

      <LlmProvidersManager providers={view} killSwitchOn={killSwitchOn} />

      <aside className="mt-10 rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface-sunk)] p-5 text-xs text-[color:var(--color-ink-soft)]">
        <p className="font-medium text-[color:var(--color-ink)]">
          Six-gate dispatch posture
        </p>
        <p className="mt-2">
          Every call to <code>/admin/curriculum</code> runs through six
          gates before any outbound HTTP fires: an active provider row,
          valid credentials, configured budget, admin role, kill-switch
          ON, and a payload that doesn&rsquo;t look like seeker PII. If any
          single gate fails the dispatcher refuses and writes
          <code> llm.curriculum.skipped</code> with the reason. Zero
          spend until every gate is open.
        </p>
        <p className="mt-2">
          Self-hosted is the POPIA-clean recommended path  inference
          stays inside the af-south-1 residency boundary. OpenAI +
          Anthropic require explicit POPIA s.72 acknowledgement before
          credentials are accepted; the acknowledgement timestamp lands
          in the row and the audit ledger.
        </p>
      </aside>
    </DashboardMasthead>
  );
}

function KillSwitchBanner({ on }: { on: boolean }) {
  if (on) {
    return (
      <div className="mb-6 rounded-[var(--radius-md)] border border-[color:var(--color-positive)]/40 bg-[color:var(--color-positive)]/10 px-4 py-3 text-sm text-[color:var(--color-ink)]">
        <span className="font-medium">Kill-switch ON.</span> Configured
        + activated providers will dispatch on /admin/curriculum bulk
        imports. Flip OFF on /admin/settings to pause all LLM activity
        without losing the configuration.
      </div>
    );
  }
  return (
    <div className="mb-6 rounded-[var(--radius-md)] border border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning)]/10 px-4 py-3 text-sm text-[color:var(--color-ink)]">
      <span className="font-medium">Kill-switch OFF.</span> The
      dispatcher refuses every call regardless of provider state.
      Configure + test below, then turn on{" "}
      <code>feature_flag_llm_curriculum_enabled</code> on
      /admin/settings.
    </div>
  );
}
