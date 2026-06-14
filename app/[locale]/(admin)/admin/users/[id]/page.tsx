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
  CalendarDays,
  KeyRound,
} from "lucide-react";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { verifyAdmin } from "@/lib/auth/dal";
import { getAdminUserDetail } from "@/lib/admin/users";
import { UserRowActions } from "@/components/feature/admin/UserRowActions";
import type { UserRole } from "@/lib/mock/types";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await verifyAdmin();

  const user = await getAdminUserDetail(id);
  if (!user) notFound();

  const dateLong = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  return (
    <DashboardMasthead
      role="admin"
      pageEyebrow="Account directory"
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
      {/* Back to the directory — keeps the admin in-shell (no bounce to /p). */}
      <div className="-mt-2 mb-6">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)] hover:text-[color:var(--color-ink)]"
        >
          <ChevronLeft className="size-3" aria-hidden="true" />
          Back to user directory
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* ── Account overview ─────────────────────────────────────────── */}
        <section className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <RolePill role={user.role} />
            <StatusBadge
              status={user.status}
              label={
                user.status === "active"
                  ? "Active"
                  : user.status === "suspended"
                    ? "Suspended"
                    : "Erased"
              }
            />
          </div>

          <dl className="mt-5 space-y-4">
            <DetailRow icon={Mail} label="Email">
              {user.email}
            </DetailRow>
            <DetailRow icon={MailCheck} label="Email verified">
              {user.emailVerified ? "Yes" : "No"}
            </DetailRow>
            {user.organisation && (
              <DetailRow icon={Building2} label="Organisation">
                {user.organisation}
              </DetailRow>
            )}
            {(user.profession || user.city) && (
              <DetailRow icon={MapPin} label="Profile">
                {[user.profession, user.city].filter(Boolean).join(" · ")}
              </DetailRow>
            )}
            <DetailRow icon={KeyRound} label="Two-factor auth">
              {user.twoFactorEnabled ? "Enabled" : "Not set up"}
            </DetailRow>
            <DetailRow icon={CalendarDays} label="Joined">
              {dateLong(user.createdAt)}
            </DetailRow>
          </dl>
        </section>

        {/* ── Status & moderation ──────────────────────────────────────── */}
        <section className="rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-5 md:p-6">
          <h2 className="flex items-center gap-2 font-display text-lg">
            {user.status === "active" ? (
              <ShieldCheck className="size-4 text-[color:var(--color-employed)]" aria-hidden="true" />
            ) : (
              <ShieldAlert className="size-4 text-[color:var(--color-danger)]" aria-hidden="true" />
            )}
            Status &amp; moderation
          </h2>

          {user.status === "suspended" && (
            <div className="mt-4 rounded-[var(--radius-sm)] border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger)]/5 p-3 text-sm">
              {user.suspendedReason && (
                <p className="text-[color:var(--color-ink)]">{user.suspendedReason}</p>
              )}
              <p className="mt-1 text-xs text-[color:var(--color-ink-soft)]">
                Suspended
                {user.suspendedAt ? ` on ${dateLong(user.suspendedAt)}` : ""}
                {user.suspendedByName ? ` by ${user.suspendedByName}` : ""}.
              </p>
            </div>
          )}

          {user.status === "deleted" && (
            <p className="mt-4 rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-hairline)] p-3 text-sm text-[color:var(--color-ink-soft)]">
              This account has been erased
              {user.deletedAt ? ` (${dateLong(user.deletedAt)})` : ""}. POPIA
              tombstone retained in the audit log.
            </p>
          )}

          <div className="mt-5 border-t border-dashed border-[color:var(--color-hairline)] pt-5">
            <p className="mb-3 text-xs uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
              Actions
            </p>
            <UserRowActions
              userId={user.id}
              status={user.status}
              isAdmin={user.role === "admin"}
            />
          </div>
        </section>
      </div>
    </DashboardMasthead>
  );
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon
        className="mt-0.5 size-4 shrink-0 text-[color:var(--color-ink-soft)]"
        aria-hidden="true"
      />
      <div className="min-w-0">
        <dt className="text-[0.68rem] uppercase tracking-[0.16em] text-[color:var(--color-ink-soft)]">
          {label}
        </dt>
        <dd className="mt-0.5 break-words text-sm text-[color:var(--color-ink)]">
          {children}
        </dd>
      </div>
    </div>
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

function StatusBadge({
  status,
  label,
}: {
  status: "active" | "suspended" | "deleted";
  label: string;
}) {
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
