import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import {
  ChevronLeft,
  ArrowUpRight,
  ShieldCheck,
  ShieldAlert,
  Mail,
  MailCheck,
  MapPin,
  Building2,
  KeyRound,
  Smartphone,
  MonitorSmartphone,
  Clock,
  BadgeCheck,
  GraduationCap,
  FileBadge,
  Activity as ActivityIcon,
  ExternalLink,
} from "lucide-react";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { Avatar } from "@/components/ui/Avatar";
import { verifyAdmin } from "@/lib/auth/dal";
import {
  getAdminUserDetail,
  listConsentsForUser,
  getEmployerContextForUser,
  getSeekerReviewBundle,
  getOrgDocuments,
  type AdminConsentRow,
} from "@/lib/admin/users";
import { loadProfileForUser } from "@/lib/profile/me";
import { recentAuditEventsFromDb } from "@/lib/audit";
import { AccountAdminActions } from "@/components/feature/admin/AccountAdminActions";
import { KycReviewActions } from "@/components/feature/admin/KycReviewActions";
import { VerificationActions } from "@/components/feature/admin/VerificationActions";
import { formatRelativeTime } from "@/lib/utils";
import type { UserRole } from "@/lib/mock/types";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await verifyAdmin();

  const user = await getAdminUserDetail(id);
  if (!user) notFound();

  const isSelf = session.id === user.id;

  // Role-specific + cross-cutting reads, in parallel.
  const [profile, employer, consents, activity] = await Promise.all([
    user.role === "seeker" ? loadProfileForUser(user.id) : Promise.resolve(null),
    user.role === "employer"
      ? getEmployerContextForUser(user.id)
      : Promise.resolve(null),
    listConsentsForUser(user.id),
    recentAuditEventsFromDb({ actor: user.id, limit: 20 }),
  ]);

  // Review docs (signed URLs) — depend on the ids resolved above.
  const reviewBundle = profile
    ? await getSeekerReviewBundle(profile.profileId)
    : null;
  const orgDocs = employer ? await getOrgDocuments(employer.organizationId) : [];

  const dateLong = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  return (
    <DashboardMasthead
      role="admin"
      pageEyebrow={`Account · ${user.role}`}
      pageTitle={user.name}
      pageSubtitle={user.handle ? `@${user.handle} · ${user.email}` : user.email}
      pageActions={
        user.handle ? (
          <Link
            href={`/p/${user.handle}`}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-4 py-2 text-sm hover:border-[color:var(--color-ink)]"
          >
            View public profile
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        ) : undefined
      }
    >
      {/* Back to the directory — keeps the admin in-shell. */}
      <div className="-mt-2 mb-6">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
        >
          <ChevronLeft className="size-3" aria-hidden="true" />
          Back to user directory
        </Link>
      </div>

      {/* Identity header */}
      <header className="mb-6 flex flex-col gap-4 rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 sm:flex-row sm:items-center md:p-6">
        <Avatar
          name={user.name}
          photoUrl={user.image}
          verification={profile?.verification}
          showRing={!!profile}
          size="xl"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <RolePill role={user.role} />
            <StatusBadge status={user.status} />
            {user.kycVerifiedAt && (
              <Tag tone="brand">
                <BadgeCheck className="size-3" aria-hidden="true" /> ID verified
              </Tag>
            )}
          </div>
          <h2 className="mt-2 font-display text-2xl leading-tight">{user.name}</h2>
          <p className="truncate text-sm text-[color:var(--color-ink-soft)]">
            {user.email}
            {user.handle ? ` · @${user.handle}` : ""}
          </p>
        </div>
        <dl className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-2 text-sm sm:text-right">
          <KeyFact label="Joined">{dateLong(user.createdAt)}</KeyFact>
          <KeyFact label="Last active">
            {user.lastSignInAt ? formatRelativeTime(user.lastSignInAt) : "—"}
          </KeyFact>
          <KeyFact label="Account ID" full>
            <code className="break-all text-xs text-[color:var(--color-ink-soft)]">
              {user.id}
            </code>
          </KeyFact>
        </dl>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        {/* ════════════════ MAIN COLUMN ════════════════ */}
        <div className="space-y-6">
          {/* Security & access */}
          <Card title="Security &amp; access" icon={ShieldCheck}>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field icon={Mail} label="Email">
                {user.email}
              </Field>
              <Field icon={MailCheck} label="Email verified">
                <YesNo value={user.emailVerified} />
              </Field>
              <Field icon={KeyRound} label="Two-factor auth">
                <YesNo value={user.twoFactorEnabled} yes="Enabled" no="Not set up" />
              </Field>
              <Field icon={Smartphone} label="Phone verified">
                <YesNo
                  value={!!user.phoneVerifiedAt}
                  yes={user.phoneVerifiedAt ? dateLong(user.phoneVerifiedAt) : "Yes"}
                  no="No phone on file"
                />
              </Field>
              <Field icon={MonitorSmartphone} label="Active sessions">
                {user.activeSessions} device{user.activeSessions === 1 ? "" : "s"}
              </Field>
              <Field icon={Clock} label="Last sign-in">
                {user.lastSignInAt ? dateLong(user.lastSignInAt) : "—"}
              </Field>
              {(user.smsChannelEnabled || user.whatsappChannelEnabled) && (
                <Field icon={Smartphone} label="Messaging channels" wide>
                  {[
                    user.smsChannelEnabled ? "SMS" : null,
                    user.whatsappChannelEnabled ? "WhatsApp" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Field>
              )}
            </dl>
          </Card>

          {/* Seeker profile + verification */}
          {user.role === "seeker" && profile && (
            <>
              <Card title="Seeker profile" icon={BadgeCheck}>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Field icon={Building2} label="Profession">
                    {[profile.profession, profile.seniority].filter(Boolean).join(" · ")}
                  </Field>
                  <Field icon={MapPin} label="Location">
                    {[profile.city, profile.province].filter(Boolean).join(", ")}
                  </Field>
                  <Field label="Employment status">
                    {humanize(profile.status)}
                    {profile.statusConfirmedAt && (
                      <span className="text-[color:var(--color-ink-soft)]">
                        {" "}
                        · confirmed {formatRelativeTime(profile.statusConfirmedAt)}
                      </span>
                    )}
                  </Field>
                  <Field label="Profile completeness">{profile.completeness}%</Field>
                  {typeof profile.yearsExperience === "number" && (
                    <Field label="Years experience">{profile.yearsExperience}</Field>
                  )}
                  <Field label="Member since">{dateLong(profile.memberSince)}</Field>
                </dl>
                {profile.bio && (
                  <p className="mt-4 border-t border-dashed border-[color:var(--color-hairline)] pt-4 text-sm text-[color:var(--color-ink-soft)]">
                    {profile.bio}
                  </p>
                )}
                {profile.topSkills.length > 0 && (
                  <div className="mt-4 border-t border-dashed border-[color:var(--color-hairline)] pt-4">
                    <p className="mb-2 text-[0.68rem] uppercase tracking-[0.16em] text-[color:var(--color-ink-soft)]">
                      Skills
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.topSkills.map((s) => (
                        <Tag key={s.name} tone="muted">
                          {s.name}
                          <span className="text-[color:var(--color-ink-soft)]">
                            {" "}
                            {"●".repeat(s.proficiency)}
                          </span>
                        </Tag>
                      ))}
                    </div>
                  </div>
                )}
              </Card>

              <Card
                title="Verification"
                icon={FileBadge}
                action={
                  <ReviewLink
                    href="/admin/verifications?tab=qualifications"
                    label="Open queue"
                  />
                }
              >
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Field label="Profile roll-up">
                    <VerifTag status={profile.verification} />
                  </Field>
                  <Field label="ID / KYC">
                    {user.kycVerifiedAt ? (
                      <VerifTag status="verified" label="ID verified" />
                    ) : profile.idDocumentRejectionReason ? (
                      <VerifTag status="rejected" label="ID rejected" />
                    ) : profile.hasIdDocument ? (
                      <VerifTag status="pending" label="ID pending review" />
                    ) : (
                      <span className="text-[color:var(--color-ink-soft)]">No document</span>
                    )}
                  </Field>
                </dl>
                {profile.idDocumentRejectionReason && (
                  <p className="mt-3 rounded-[var(--radius-sm)] border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger)]/5 p-2 text-xs text-[color:var(--color-ink)]">
                    ID rejection note: {profile.idDocumentRejectionReason}
                  </p>
                )}

                {/* Inline ID-document review (doc link + decision actions). */}
                {reviewBundle?.idDoc && (
                  <div className="mt-4 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span>
                        <span className="font-medium">
                          {reviewBundle.idDoc.kind === "passport" ? "Passport" : "SA ID"} document
                        </span>
                        {reviewBundle.idDoc.uploadedAt && (
                          <span className="text-[color:var(--color-ink-soft)]">
                            {" "}
                            · uploaded {dateLong(reviewBundle.idDoc.uploadedAt)}
                          </span>
                        )}
                      </span>
                      {reviewBundle.idDoc.signedUrl && (
                        <DocLink href={reviewBundle.idDoc.signedUrl} label="View ID" />
                      )}
                    </div>
                    {!user.kycVerifiedAt && (
                      <div className="mt-3">
                        <KycReviewActions profileId={profile.profileId} />
                      </div>
                    )}
                  </div>
                )}

                {reviewBundle && reviewBundle.qualifications.length > 0 && (
                  <div className="mt-4 border-t border-dashed border-[color:var(--color-hairline)] pt-4">
                    <p className="mb-2 flex items-center gap-1.5 text-[0.68rem] uppercase tracking-[0.16em] text-[color:var(--color-ink-soft)]">
                      <GraduationCap className="size-3.5" aria-hidden="true" />
                      Qualifications
                    </p>
                    <ul className="space-y-3">
                      {reviewBundle.qualifications.map((q) => (
                        <li
                          key={q.id}
                          className="rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] p-3"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <span className="min-w-0">
                              <span className="font-medium">{q.title}</span>
                              <span className="text-[color:var(--color-ink-soft)]">
                                {" "}
                                · {q.institution}
                                {q.awardedYear ? ` · ${q.awardedYear}` : ""}
                              </span>
                            </span>
                            <div className="flex items-center gap-2">
                              {q.signedUrl && <DocLink href={q.signedUrl} label="View" />}
                              <VerifTag status={q.verification} />
                            </div>
                          </div>
                          {(q.verification === "pending" || q.verification === "unverified") && (
                            <div className="mt-2">
                              <VerificationActions
                                id={q.id}
                                kind="qualification"
                                approveLabel="Approve"
                                rejectLabel="Reject"
                              />
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            </>
          )}

          {/* Employer organisation */}
          {user.role === "employer" && (
            <Card
              title="Organisation"
              icon={Building2}
              action={
                <ReviewLink
                  href="/admin/verifications?tab=organisations"
                  label="Open vetting"
                />
              }
            >
              {employer ? (
                <>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <Field icon={Building2} label="Organisation">
                      {employer.organizationName}
                    </Field>
                    <Field label="Member role">{humanize(employer.role)}</Field>
                    <Field label="Vetting status">
                      <VerifTag status={employer.verification} />
                    </Field>
                    {employer.verifiedAt && (
                      <Field label="Verified">{dateLong(employer.verifiedAt)}</Field>
                    )}
                    {employer.joinedAt && (
                      <Field label="Joined org">{dateLong(employer.joinedAt)}</Field>
                    )}
                  </dl>
                  {employer.rejectionReason && (
                    <p className="mt-3 rounded-[var(--radius-sm)] border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger)]/5 p-2 text-xs">
                      Rejection: {employer.rejectionReason}
                    </p>
                  )}
                  {employer.adminNote && (
                    <p className="mt-2 rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-hairline)] p-2 text-xs text-[color:var(--color-ink-soft)]">
                      Admin note: {employer.adminNote}
                    </p>
                  )}

                  {/* Uploaded vetting documents. */}
                  {orgDocs.length > 0 && (
                    <div className="mt-4 border-t border-dashed border-[color:var(--color-hairline)] pt-4">
                      <p className="mb-2 text-[0.68rem] uppercase tracking-[0.16em] text-[color:var(--color-ink-soft)]">
                        Documents
                      </p>
                      <ul className="space-y-1.5">
                        {orgDocs.map((d) => (
                          <li
                            key={d.id}
                            className="flex flex-wrap items-center justify-between gap-2 text-sm"
                          >
                            <span className="min-w-0">
                              <span className="font-medium">{humanize(d.kind)}</span>
                              <span className="text-[color:var(--color-ink-soft)]">
                                {" "}
                                · {d.originalName}
                              </span>
                            </span>
                            {d.signedUrl && <DocLink href={d.signedUrl} label="View" />}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Inline approve / reject. Request-changes, resend email + mark-verified
                      live in the full vetting queue (linked above). */}
                  {employer.verification !== "verified" && (
                    <div className="mt-4 border-t border-dashed border-[color:var(--color-hairline)] pt-4">
                      <VerificationActions
                        id={employer.organizationId}
                        kind="organisation"
                        approveLabel="Approve organisation"
                        rejectLabel="Reject"
                      />
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-[color:var(--color-ink-soft)]">
                  This employer isn’t linked to an organisation yet.
                </p>
              )}
            </Card>
          )}

          {/* Consents */}
          <Card title="Consents (POPIA)" icon={ShieldCheck}>
            {consents.length === 0 ? (
              <p className="text-sm text-[color:var(--color-ink-soft)]">
                No consent records on file.
              </p>
            ) : (
              <ul className="divide-y divide-[color:var(--color-hairline)]">
                {consents.map((c) => (
                  <ConsentRow key={c.purpose} consent={c} dateLong={dateLong} />
                ))}
              </ul>
            )}
          </Card>

          {/* Recent activity */}
          <Card title="Recent activity" icon={ActivityIcon}>
            {activity.length === 0 ? (
              <p className="text-sm text-[color:var(--color-ink-soft)]">
                No recorded activity for this account.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {activity.map((e, i) => (
                  <li
                    key={`${e.kind}-${e.at}-${i}`}
                    className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
                  >
                    <span className="font-mono text-xs text-[color:var(--color-ink)]">
                      {e.kind}
                    </span>
                    <span className="text-xs text-[color:var(--color-ink-soft)]">
                      {formatRelativeTime(e.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 border-t border-dashed border-[color:var(--color-hairline)] pt-3 text-xs text-[color:var(--color-ink-soft)]">
              Full history in the{" "}
              <ReviewLink href="/admin/audit-log" label="audit log" inline />.
            </p>
          </Card>
        </div>

        {/* ════════════════ RIGHT RAIL ════════════════ */}
        <div className="space-y-6">
          {/* Account actions */}
          <Card
            title="Account actions"
            icon={user.status === "active" ? ShieldCheck : ShieldAlert}
          >
            {user.status === "suspended" && (
              <div className="mb-4 rounded-[var(--radius-sm)] border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger)]/5 p-3 text-sm">
                {user.suspendedReason && (
                  <p className="text-[color:var(--color-ink)]">{user.suspendedReason}</p>
                )}
                <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                  Suspended
                  {user.suspendedAt ? ` ${formatRelativeTime(user.suspendedAt)}` : ""}
                  {user.suspendedByName ? ` by ${user.suspendedByName}` : ""}.
                </p>
              </div>
            )}
            <AccountAdminActions
              userId={user.id}
              status={user.status}
              targetRole={user.role}
              isSelf={isSelf}
            />
          </Card>

          {/* Quick links to specialised surfaces */}
          <Card title="Manage elsewhere" icon={ExternalLink}>
            <ul className="space-y-2 text-sm">
              {user.role === "seeker" && (
                <>
                  <QuickLink href="/admin/verifications?tab=seeker-ids" label="Review ID / KYC" />
                  <QuickLink
                    href="/admin/verifications?tab=qualifications"
                    label="Review qualifications"
                  />
                </>
              )}
              {user.role === "employer" && (
                <QuickLink
                  href="/admin/verifications?tab=organisations"
                  label="Vet organisation"
                />
              )}
              <QuickLink href="/admin/moderation" label="Moderation reports" />
              <QuickLink href="/admin/audit-log" label="Audit log" />
            </ul>
          </Card>
        </div>
      </div>
    </DashboardMasthead>
  );
}

/* ───────────────────────── helpers ───────────────────────── */

function humanize(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** A signed-URL link to a stored document — opens in a new tab. */
function DocLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[color:var(--color-hairline)] px-2.5 py-1 text-xs text-[color:var(--color-brand-strong)] hover:border-[color:var(--color-brand)]"
    >
      {label}
      <ExternalLink className="size-3" aria-hidden="true" />
    </a>
  );
}

function Card({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-lg">
          <Icon className="size-4 text-[color:var(--color-ink-soft)]" aria-hidden="true" />
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({
  icon: Icon,
  label,
  children,
  wide,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="flex items-center gap-1.5 text-[0.68rem] uppercase tracking-[0.16em] text-[color:var(--color-ink-soft)]">
        {Icon && <Icon className="size-3.5" aria-hidden="true" />}
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm text-[color:var(--color-ink)]">{children}</dd>
    </div>
  );
}

function KeyFact({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "col-span-2" : undefined}>
      <dt className="text-[0.62rem] uppercase tracking-[0.16em] text-[color:var(--color-ink-soft)]">
        {label}
      </dt>
      <dd className="text-sm text-[color:var(--color-ink)]">{children}</dd>
    </div>
  );
}

function YesNo({
  value,
  yes = "Yes",
  no = "No",
}: {
  value: boolean;
  yes?: string;
  no?: string;
}) {
  return (
    <span className={value ? "text-[color:var(--color-employed)]" : "text-[color:var(--color-ink-soft)]"}>
      {value ? yes : no}
    </span>
  );
}

function ConsentRow({
  consent,
  dateLong,
}: {
  consent: AdminConsentRow;
  dateLong: (iso: string) => string;
}) {
  const paused = consent.pausedUntil && new Date(consent.pausedUntil) > new Date();
  const tone =
    consent.state === "granted" && !paused
      ? "text-[color:var(--color-employed)]"
      : consent.state === "revoked"
        ? "text-[color:var(--color-danger)]"
        : "text-[color:var(--color-ink-soft)]";
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <span>{humanize(consent.purpose)}</span>
      <span className={`text-xs ${tone}`}>
        {paused
          ? `Paused until ${dateLong(consent.pausedUntil!)}`
          : consent.state === "granted"
            ? "Granted"
            : consent.state === "revoked"
              ? "Revoked"
              : "Not set"}
      </span>
    </li>
  );
}

function ReviewLink({
  href,
  label,
  inline,
}: {
  href: string;
  label: string;
  inline?: boolean;
}) {
  if (inline) {
    return (
      <Link href={href} className="text-[color:var(--color-brand-strong)] hover:underline">
        {label}
      </Link>
    );
  }
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.16em] text-[color:var(--color-brand-strong)] hover:underline"
    >
      {label}
      <ArrowUpRight className="size-3" aria-hidden="true" />
    </Link>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] px-3 py-2 hover:border-[color:var(--color-ink)]"
      >
        {label}
        <ArrowUpRight className="size-3.5 text-[color:var(--color-ink-soft)]" aria-hidden="true" />
      </Link>
    </li>
  );
}

function Tag({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "brand" | "muted";
}) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2 py-0.5 text-[0.66rem] " +
        (tone === "brand"
          ? "bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]"
          : "bg-[color:var(--color-surface-sunk)] text-[color:var(--color-ink)]")
      }
    >
      {children}
    </span>
  );
}

function VerifTag({
  status,
  label,
}: {
  status: "unverified" | "pending" | "verified" | "rejected";
  label?: string;
}) {
  const map = {
    verified: "bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]",
    pending: "bg-[color:var(--color-accent-tint)] text-[color:var(--color-accent)]",
    rejected: "bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)]",
    unverified: "bg-[color:var(--color-surface-sunk)] text-[color:var(--color-ink-soft)]",
  } as const;
  return (
    <span
      className={`inline-flex rounded-[var(--radius-pill)] px-2 py-0.5 text-[0.66rem] uppercase tracking-[0.12em] ${map[status]}`}
    >
      {label ?? status}
    </span>
  );
}

function RolePill({ role }: { role: UserRole }) {
  return (
    <span
      className={
        "rounded-[var(--radius-pill)] px-2.5 py-1 text-[0.62rem] uppercase tracking-[0.18em] " +
        (role === "admin"
          ? "bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
          : role === "employer"
            ? "bg-[color:var(--color-accent-tint)] text-[color:var(--color-accent)]"
            : "bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]")
      }
    >
      {role}
    </span>
  );
}

function StatusBadge({ status }: { status: "active" | "suspended" | "deleted" }) {
  const label = status === "active" ? "Active" : status === "suspended" ? "Suspended" : "Erased";
  return (
    <span
      className={
        "text-sm font-medium " +
        (status === "active"
          ? "text-[color:var(--color-employed)]"
          : status === "suspended"
            ? "text-[color:var(--color-danger)]"
            : "text-[color:var(--color-ink-soft)]")
      }
    >
      {label}
    </span>
  );
}
