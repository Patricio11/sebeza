import { setRequestLocale } from "next-intl/server";
import { eq, sql } from "drizzle-orm";
import { Link } from "@/i18n/navigation";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { verifyAdmin } from "@/lib/auth/dal";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { getSetting } from "@/lib/admin/settings";
import { integrationSource } from "@/lib/integrations/resolve";
import {
  IntegrationsHub,
  type ChannelView,
} from "@/components/feature/admin/IntegrationsHub";
import { estimateAnnouncementRecipients } from "@/lib/admin/announcements";
import { Database, HardDrive, Sparkles, ShieldCheck } from "lucide-react";

export const revalidate = 0;

/**
 * Phase 25 ("Integrations Hub")  one surface for every external integration:
 * admin-managed channel credentials (SMS / WhatsApp / Email  llm_providers
 * posture, encrypted at rest), read-only health for Database + Storage (those
 * credentials MUST stay platform-env: the app can't bootstrap its DB
 * connection from the DB), links to the LLM + KYC configs, and the
 * consent-gated bulk-announcement composer.
 */
export default async function AdminIntegrationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await verifyAdmin();

  const db = getDb();

  // ── Channel rows (no secrets ever leave the server) ────────────────────
  const rows = await db.select().from(schema.integrationSettings);
  const byChannel = new Map(rows.map((r) => [r.channel, r]));
  const channels: ChannelView[] = [];
  for (const channel of ["sms", "whatsapp", "email"] as const) {
    const row = byChannel.get(channel);
    channels.push({
      channel,
      configured: !!row?.credentialsEnc,
      enabled: !!row?.enabled,
      source: await integrationSource(channel),
      config: (row?.config as Record<string, string>) ?? {},
      updatedAt: row?.updatedAt ? row.updatedAt.toISOString() : null,
    });
  }

  // ── Read-only health ──────────────────────────────────────────────────
  const t0 = Date.now();
  await db.execute(sql`SELECT 1`);
  const dbLatencyMs = Date.now() - t0;
  const migrationRows = (
    (await db.execute(
      sql`SELECT COUNT(*)::int AS n FROM drizzle.__drizzle_migrations`,
    )) as unknown as { rows: Array<{ n: number }> }
  ).rows;
  const migrationCount = migrationRows[0]?.n ?? 0;

  const storageConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  const [llmActive] = await db
    .select({ displayName: schema.llmProviders.displayName })
    .from(schema.llmProviders)
    .where(eq(schema.llmProviders.active, true))
    .limit(1);
  const coachOn = await getSetting<boolean>("feature_flag_seeker_ai_coach");
  const kycFlag = await getSetting<boolean>("feature_flag_kyc_provider");

  const announcementRecipients = await estimateAnnouncementRecipients();
  const smsFlagOn = await getSetting<boolean>("feature_flag_sms_channel_enabled");
  const whatsappFlagOn = await getSetting<boolean>(
    "feature_flag_whatsapp_channel_enabled",
  );

  return (
    <DashboardMasthead
      role="admin"
      pageEyebrow="Platform"
      pageTitle="Integrations"
      pageSubtitle="Every external integration on one surface. Channel credentials are encrypted at rest and managed here; Database and Storage credentials stay platform-env (the app can't bootstrap its own DB connection from the DB) — their health shows below."
    >
      {/* Read-only health row */}
      <section aria-label="Infrastructure health" className="mb-8 grid gap-4 md:grid-cols-4">
        <HealthCard
          icon={<Database className="size-4" aria-hidden="true" />}
          title="Database"
          value={`Connected · ${dbLatencyMs}ms`}
          detail={`${migrationCount} migrations applied · credentials: platform env`}
          ok
        />
        <HealthCard
          icon={<HardDrive className="size-4" aria-hidden="true" />}
          title="Storage (Supabase)"
          value={storageConfigured ? "Configured" : "Not configured"}
          detail="Documents, photos, CVs · credentials: platform env"
          ok={storageConfigured}
        />
        <HealthCard
          icon={<Sparkles className="size-4" aria-hidden="true" />}
          title="LLM"
          value={llmActive ? `Active: ${llmActive.displayName}` : "No active provider"}
          detail={coachOn ? "AI coach switch: ON" : "AI coach switch: OFF"}
          ok={!!llmActive}
          href="/admin/llm"
        />
        <HealthCard
          icon={<ShieldCheck className="size-4" aria-hidden="true" />}
          title="KYC"
          value={kycFlag ? "Flag ON" : "Flag OFF (manual verification)"}
          detail={`Provider env: ${process.env.KYC_PROVIDER ?? "not set"}`}
          ok
        />
      </section>

      <IntegrationsHub
        channels={channels}
        announcementRecipients={announcementRecipients}
        smsFlagOn={smsFlagOn}
        whatsappFlagOn={whatsappFlagOn}
      />
    </DashboardMasthead>
  );
}

function HealthCard({
  icon,
  title,
  value,
  detail,
  ok,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  detail: string;
  ok: boolean;
  href?: string;
}) {
  const body = (
    <div className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4">
      <div className="flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.2em] text-[color:var(--color-ink-soft)]">
        {icon}
        {title}
        <span
          aria-hidden="true"
          className={`ml-auto inline-block size-2 rounded-full ${
            ok ? "bg-[color:var(--color-brand)]" : "bg-[color:var(--color-accent)]"
          }`}
        />
      </div>
      <div className="mt-2 font-display text-base text-[color:var(--color-ink)]">
        {value}
      </div>
      <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">{detail}</p>
    </div>
  );
  return href ? (
    // eslint-disable-next-line jsx-a11y/anchor-is-valid
    <Link href={href as never} className="no-underline">
      {body}
    </Link>
  ) : (
    body
  );
}
