import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ADMIN_NAV } from "@/components/layout/adminNav";
import { verifyAdmin } from "@/lib/auth/dal";
import { listPendingQualifications } from "@/lib/admin/verifications-query";
import { listOrgsForReview } from "@/lib/admin/org-vetting";
import { listKycSubmissions, type KycReviewRow } from "@/lib/admin/kyc-review";
import { VerificationActions } from "@/components/feature/admin/VerificationActions";
import { OrgReviewLauncher } from "@/components/feature/admin/OrgReviewLauncher";
import { KycReviewActions } from "@/components/feature/admin/KycReviewActions";
import { getSetting } from "@/lib/admin/settings";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  ShieldOff,
  XCircle,
} from "lucide-react";
import { HelpLink } from "@/components/feature/help/HelpLink";

export default async function VerificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifyAdmin();
  const { tab } = await searchParams;
  const active =
    tab === "organisations"
      ? "organisations"
      : tab === "seeker-ids"
        ? "seeker-ids"
        : "qualifications";

  const t = await getTranslations("adminDash.verifications");
  const [quals, orgGroups, kycGroups, saqaWorkerEnabled] = await Promise.all([
    listPendingQualifications(),
    listOrgsForReview(),
    listKycSubmissions(),
    getSetting<boolean>("feature_flag_saqa_worker"),
  ]);
  // Default org sub-view = pending (the actionable queue); drafts are
  // pre-submission, rejected + verified are history.
  const orgsActionable = orgGroups.pending.length + orgGroups.unverified.length;

  const relTime = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  function relative(d: Date | string | null | undefined): string {
    if (!d) return "";
    const at = typeof d === "string" ? new Date(d) : d;
    const diffMs = Date.now() - at.getTime();
    const mins = Math.round(diffMs / 60_000);
    if (mins < 60) return relTime.format(-mins, "minute");
    const hrs = Math.round(mins / 60);
    if (hrs < 48) return relTime.format(-hrs, "hour");
    return relTime.format(-Math.round(hrs / 24), "day");
  }

  return (
    <DashboardShell
      role="admin"
      workspaceLabel={session.name ?? "Admin"}
      workspaceEyebrow="Administrator · 2FA required"
      nav={ADMIN_NAV}
      activeKey="verifications"
      pageEyebrow="Queue"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
    >
      {/* Phase 10.3  help deep-links (D6). */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <HelpLink role="admin" slug="reviewing-seeker-id-submissions" label="Reviewing KYC" />
        <HelpLink role="admin" slug="qualification-review-and-saqa-workflow" label="Qualifications + SAQA" />
        <HelpLink role="admin" slug="organisation-kyc-verification" label="Organisation KYC" />
        <HelpLink role="admin" slug="approval-rejection-and-appeals" label="Writing dispositions" />
      </div>

      {/* Tabs */}
      <nav className="mb-6 flex gap-1 border-b border-[color:var(--color-hairline)]">
        <TabLink
          active={active === "qualifications"}
          href={{ pathname: "/admin/verifications", query: { tab: "qualifications" } }}
          label={`${t("tabs.qualifications")} · ${quals.length}`}
        />
        <TabLink
          active={active === "organisations"}
          href={{ pathname: "/admin/verifications", query: { tab: "organisations" } }}
          label={`${t("tabs.organisations")} · ${orgsActionable}`}
        />
        <TabLink
          active={active === "seeker-ids"}
          href={{ pathname: "/admin/verifications", query: { tab: "seeker-ids" } }}
          label={`Seeker IDs · ${kycGroups.pending.length}`}
        />
      </nav>

      {active === "seeker-ids" ? (
        <div className="space-y-8">
          <KycGroup
            title={`Pending review · ${kycGroups.pending.length}`}
            tone="brand"
            icon={Clock}
            emptyTitle="Nothing pending."
            emptyNote="When a seeker uploads a copy of their SA ID or passport, submissions appear here for review."
            rows={kycGroups.pending}
            relative={relative}
          />
          {kycGroups.rejected.length > 0 && (
            <KycGroup
              title={`Recently rejected · ${kycGroups.rejected.length}`}
              tone="danger"
              icon={XCircle}
              emptyTitle=""
              emptyNote=""
              rows={kycGroups.rejected}
              relative={relative}
              readOnly
            />
          )}
          {kycGroups.verified.length > 0 && (
            <KycGroup
              title={`Recently verified · ${kycGroups.verified.length}`}
              tone="accent"
              icon={CheckCircle2}
              emptyTitle=""
              emptyNote=""
              rows={kycGroups.verified}
              relative={relative}
              readOnly
            />
          )}
        </div>
      ) : active === "qualifications" ? (
        quals.length === 0 ? (
          <EmptyQueue
            title="Nothing pending."
            note="When seekers upload qualification evidence, submissions appear here."
          />
        ) : (
          <ul className="space-y-3">
            {quals.map((q) => (
              <li
                key={q.id}
                className="grid grid-cols-1 gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 md:grid-cols-[auto_1fr_auto] md:items-center"
              >
                <span className="inline-flex size-10 items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]">
                  <FileText className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <div className="font-display text-lg">{q.title}</div>
                  <div className="text-sm text-[color:var(--color-ink-soft)]">
                    {q.institution}
                    {q.awardedYear ? ` · ${q.awardedYear}` : ""}
                  </div>
                  <div className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                    {t("submittedBy")}{" "}
                    {q.handle ? (
                      <Link
                        href={`/p/${q.handle}`}
                        className="text-[color:var(--color-brand)] hover:underline"
                      >
                        {q.candidateName}
                      </Link>
                    ) : (
                      <span>{q.candidateName}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {q.saqaJobStatus && (
                    <span
                      className={
                        "rounded-[var(--radius-pill)] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] " +
                        (q.saqaJobStatus === "queued" || q.saqaJobStatus === "in_flight"
                          ? "bg-[color:var(--color-accent-tint)] text-[color:var(--color-accent)]"
                          : q.saqaJobStatus === "verified"
                            ? "bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]"
                            : "bg-[color:var(--color-danger)] text-white")
                      }
                    >
                      SAQA: {q.saqaJobStatus.replace("_", " ")}
                      {q.saqaJobSubmittedAt && ` · ${relative(q.saqaJobSubmittedAt)}`}
                    </span>
                  )}
                  <VerificationActions
                    id={q.id}
                    kind="qualification"
                    approveLabel={t("approve")}
                    rejectLabel={t("reject")}
                    showSaqaOverride={saqaWorkerEnabled}
                  />
                </div>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="space-y-8">
          {/* Pending review  the actionable queue */}
          <OrgGroup
            title={`Pending review · ${orgGroups.pending.length}`}
            tone="brand"
            icon={Clock}
            emptyTitle="Nothing pending."
            emptyNote="Submitted onboarding applications will appear here. Drafts (not yet submitted) live in the section below."
            orgs={orgGroups.pending}
            relative={relative}
          />
          {/* Drafts  Owner hasn't submitted yet */}
          <OrgGroup
            title={`Drafts · ${orgGroups.unverified.length}`}
            tone="muted"
            icon={ShieldOff}
            emptyTitle="No drafts."
            emptyNote="New employers go here after signup, before they submit documents."
            orgs={orgGroups.unverified}
            relative={relative}
          />
          {/* Rejected  history */}
          {orgGroups.rejected.length > 0 && (
            <OrgGroup
              title={`Rejected · ${orgGroups.rejected.length}`}
              tone="danger"
              icon={XCircle}
              emptyTitle=""
              emptyNote=""
              orgs={orgGroups.rejected}
              relative={relative}
            />
          )}
          {/* Verified  history */}
          {orgGroups.verified.length > 0 && (
            <OrgGroup
              title={`Verified · ${orgGroups.verified.length}`}
              tone="accent"
              icon={CheckCircle2}
              emptyTitle=""
              emptyNote=""
              orgs={orgGroups.verified}
              relative={relative}
            />
          )}
        </div>
      )}
    </DashboardShell>
  );
}

function TabLink({
  active,
  href,
  label,
}: {
  active: boolean;
  href: { pathname: "/admin/verifications"; query: { tab: string } };
  label: string;
}) {
  return (
    <Link
      href={href}
      className={
        "border-b-2 px-4 py-2.5 text-sm uppercase tracking-[0.18em] " +
        (active
          ? "border-[color:var(--color-ink)] text-[color:var(--color-ink)]"
          : "border-transparent text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]")
      }
    >
      {label}
    </Link>
  );
}

function EmptyQueue({ title, note }: { title: string; note: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-8 text-sm text-[color:var(--color-ink-soft)]">
      <p className="font-display text-lg text-[color:var(--color-ink)]">{title}</p>
      <p className="mt-1">{note}</p>
    </div>
  );
}

// Phase 9.10  per-state group on the admin organisations tab.
function OrgGroup({
  title,
  tone,
  icon: Icon,
  emptyTitle,
  emptyNote,
  orgs,
  relative,
}: {
  title: string;
  tone: "brand" | "muted" | "danger" | "accent";
  icon: typeof CheckCircle2;
  emptyTitle: string;
  emptyNote: string;
  orgs: Awaited<ReturnType<typeof listOrgsForReview>>["pending"];
  relative: (d: Date | string | null | undefined) => string;
}) {
  const toneClass: Record<typeof tone, string> = {
    brand: "text-[color:var(--color-brand-strong)]",
    muted: "text-[color:var(--color-ink-soft)]",
    danger: "text-[color:var(--color-danger)]",
    accent: "text-[color:var(--color-accent)]",
  };
  return (
    <section>
      <header className="mb-3 flex items-center gap-2 border-b border-[color:var(--color-hairline)] pb-2">
        <Icon className={`size-4 ${toneClass[tone]}`} aria-hidden="true" />
        <h2 className="font-display text-base text-[color:var(--color-ink)]">
          {title}
        </h2>
      </header>
      {orgs.length === 0 ? (
        emptyTitle ? (
          <EmptyQueue title={emptyTitle} note={emptyNote} />
        ) : null
      ) : (
        <ul className="space-y-3">
          {orgs.map((o) => (
            <li
              key={o.id}
              className="grid grid-cols-1 gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 md:grid-cols-[1fr_auto] md:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-display text-lg">{o.name}</span>
                  <span className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                    {o.id}
                  </span>
                </div>
                <div className="text-sm text-[color:var(--color-ink-soft)]">
                  {o.registrationNumber
                    ? `CIPC ${o.registrationNumber}`
                    : "No CIPC on file"}
                  {o.industry ? `  ${o.industry}` : ""}
                  {o.country ? `  ${o.country}` : ""}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-ink-soft)]">
                  <span>Created {relative(o.createdAt)}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {o.documentCount} doc{o.documentCount === 1 ? "" : "s"}
                  </span>
                  {o.ownerEmail && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>
                        Owner: {o.ownerName ?? "?"} ({o.ownerEmail}
                        {o.ownerEmailVerified ? "" : "  unverified email"})
                      </span>
                    </>
                  )}
                </div>
              </div>
              <OrgReviewLauncher orgId={o.id} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Phase 9.16  per-state group on the admin "Seeker IDs" tab. Mirrors
// OrgGroup but the row is simpler  one document per seeker, signed
// URL inline, three inline action buttons.
function KycGroup({
  title,
  tone,
  icon: Icon,
  emptyTitle,
  emptyNote,
  rows,
  relative,
  readOnly,
}: {
  title: string;
  tone: "brand" | "muted" | "danger" | "accent";
  icon: typeof CheckCircle2;
  emptyTitle: string;
  emptyNote: string;
  rows: KycReviewRow[];
  relative: (d: Date | string | null | undefined) => string;
  readOnly?: boolean;
}) {
  const toneClass: Record<typeof tone, string> = {
    brand: "text-[color:var(--color-brand-strong)]",
    muted: "text-[color:var(--color-ink-soft)]",
    danger: "text-[color:var(--color-danger)]",
    accent: "text-[color:var(--color-accent)]",
  };
  return (
    <section>
      <header className="mb-3 flex items-center gap-2 border-b border-[color:var(--color-hairline)] pb-2">
        <Icon className={`size-4 ${toneClass[tone]}`} aria-hidden="true" />
        <h2 className="font-display text-base text-[color:var(--color-ink)]">
          {title}
        </h2>
      </header>
      {rows.length === 0 ? (
        emptyTitle ? (
          <EmptyQueue title={emptyTitle} note={emptyNote} />
        ) : null
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.profileId}
              className="grid grid-cols-1 gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 md:grid-cols-[1fr_auto] md:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <Link
                    href={`/p/${r.handle}`}
                    className="font-display text-lg text-[color:var(--color-brand)] hover:underline"
                  >
                    {r.displayName}
                  </Link>
                  <span className="rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] bg-[color:var(--color-paper)] px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                    {r.idDocumentKind === "passport"
                      ? `Passport · ${r.passportCountry ?? "?"}`
                      : "SA ID"}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[color:var(--color-ink-soft)]">
                  {r.uploadedAt && <span>Uploaded {relative(r.uploadedAt)}</span>}
                  {r.kycVerifiedAt && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Verified {relative(r.kycVerifiedAt)}</span>
                    </>
                  )}
                  {r.signedUrl && (
                    <>
                      <span aria-hidden="true">·</span>
                      <a
                        href={r.signedUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="inline-flex items-center gap-1 text-[color:var(--color-brand)] hover:underline"
                      >
                        <ExternalLink className="size-3" aria-hidden="true" />
                        Open document
                      </a>
                    </>
                  )}
                </div>
                {r.rejectionReason && (
                  <p className="mt-2 rounded-[var(--radius-sm)] border-l-2 border-[color:var(--color-danger)] bg-[color:var(--color-paper)] px-3 py-1.5 text-xs italic text-[color:var(--color-ink)]">
                    Reviewer note: {r.rejectionReason}
                  </p>
                )}
              </div>
              <KycReviewActions profileId={r.profileId} readOnly={readOnly} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
