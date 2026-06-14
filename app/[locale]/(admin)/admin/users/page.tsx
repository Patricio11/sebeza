import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { ADMIN_NAV } from "@/components/layout/adminNav";
import { verifyAdmin } from "@/lib/auth/dal";
import { listUsersQuery, type AdminUserRow } from "@/lib/admin/users";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { UserRowActions } from "@/components/feature/admin/UserRowActions";
import type { UserRole } from "@/lib/mock/types";
import { HelpLink } from "@/components/feature/help/HelpLink";

export default async function UsersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; role?: string; status?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifyAdmin();
  const t = await getTranslations("adminDash.users");

  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const role: UserRole | null =
    sp.role === "seeker" || sp.role === "employer" || sp.role === "admin"
      ? sp.role
      : null;
  const status: "active" | "suspended" | "deleted" | null =
    sp.status === "suspended" || sp.status === "deleted" || sp.status === "active"
      ? sp.status
      : null;

  const rows = await listUsersQuery({ search: q, role, status, limit: 200 });

  return (
    <DashboardMasthead
      role="admin"
      workspaceLabel={session.name ?? "Admin"}
      workspaceEyebrow="Administrator · 2FA required"
      nav={ADMIN_NAV}
      activeKey="users"
      pageEyebrow="Account directory"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
    >
      {/* Phase 10.3  help deep-links (D6). */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <HelpLink role="admin" slug="when-to-suspend-an-account" label="When to suspend" />
        <HelpLink role="admin" slug="suspension-appeals-and-restoration" label="Appeals + restoration" />
        <HelpLink role="admin" slug="handling-data-subject-requests" label="POPIA DSRs" />
      </div>

      <form
        method="get"
        className="mb-6 grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]"
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Search handle, email or display name…"
          className="h-10 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 text-sm"
        />
        <CustomSelect
          ariaLabel="Filter by role"
          variant="compact"
          name="role"
          defaultValue={role ?? ""}
          placeholder="All roles"
          options={[
            { value: "", label: "All roles" },
            { value: "seeker", label: "Seeker" },
            { value: "employer", label: "Employer" },
            { value: "admin", label: "Admin" },
          ]}
        />
        <CustomSelect
          ariaLabel="Filter by status"
          variant="compact"
          name="status"
          defaultValue={status ?? ""}
          placeholder="All statuses"
          options={[
            { value: "", label: "All statuses" },
            { value: "active", label: "Active" },
            { value: "suspended", label: "Suspended" },
            { value: "deleted", label: "Erased" },
          ]}
        />
        <button
          type="submit"
          className="h-10 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-5 text-sm font-medium text-[color:var(--color-paper)]"
        >
          Search
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-[var(--radius-md)] border border-dashed border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-6 text-sm text-[color:var(--color-ink-soft)]">
          No accounts match those filters.
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-[color:var(--color-ink)] text-left text-[0.7rem] uppercase tracking-[0.18em] text-[color:var(--color-ink-soft)]">
                  <th className="px-5 py-3 font-normal">User</th>
                  <th className="px-5 py-3 font-normal">Email</th>
                  <th className="px-5 py-3 font-normal">{t("role")}</th>
                  <th className="px-5 py-3 font-normal">{t("joined")}</th>
                  <th className="px-5 py-3 font-normal">{t("status")}</th>
                  <th className="px-5 py-3 font-normal text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    locale={locale}
                    statusLabel={(s) => t(s)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {rows.map((u) => (
              <li
                key={u.id}
                className="rounded-xl border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="font-display text-lg leading-tight hover:underline"
                    >
                      {u.name}
                    </Link>
                    <div className="truncate text-xs text-[color:var(--color-ink-soft)]">
                      {u.handle ? `@${u.handle} · ` : ""}
                      {u.email}
                    </div>
                    {u.organisation && (
                      <div className="text-xs text-[color:var(--color-ink-soft)]">
                        {u.organisation}
                      </div>
                    )}
                  </div>
                  <RolePill role={u.role} />
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-dashed border-[color:var(--color-hairline)] pt-3 text-xs">
                  <span className="text-[color:var(--color-ink-soft)]">
                    Joined{" "}
                    {new Date(u.createdAt).toLocaleDateString(locale, {
                      year: "numeric",
                      month: "short",
                    })}
                  </span>
                  <StatusLabel status={u.status} label={t(u.status)} />
                </div>
                {u.status === "suspended" && u.suspendedReason && (
                  <p className="mt-2 text-xs text-[color:var(--color-danger)]">
                    {u.suspendedReason}
                  </p>
                )}
                <div className="mt-3 border-t border-dashed border-[color:var(--color-hairline)] pt-3">
                  <UserRowActions
                    userId={u.id}
                    status={u.status}
                    isAdmin={u.role === "admin"}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </DashboardMasthead>
  );
}

function UserRow({
  user,
  locale,
  statusLabel,
}: {
  user: AdminUserRow;
  locale: string;
  statusLabel: (s: "active" | "suspended" | "deleted") => string;
}) {
  return (
    <tr className="border-t border-[color:var(--color-hairline)] align-top">
      <td className="px-5 py-2.5">
        <Link
          href={`/admin/users/${user.id}`}
          className="font-display text-base hover:underline"
        >
          {user.name}
        </Link>
        <div className="text-xs text-[color:var(--color-ink-soft)]">
          {user.handle ? `@${user.handle}` : user.organisation ?? ""}
        </div>
      </td>
      <td className="px-5 py-2.5 text-[color:var(--color-ink-soft)]">{user.email}</td>
      <td className="px-5 py-2.5">
        <RolePill role={user.role} />
      </td>
      <td className="px-5 py-2.5 text-[color:var(--color-ink-soft)]">
        {new Date(user.createdAt).toLocaleDateString(locale, {
          year: "numeric",
          month: "short",
        })}
      </td>
      <td className="px-5 py-2.5">
        <StatusLabel status={user.status} label={statusLabel(user.status)} />
        {user.status === "suspended" && user.suspendedReason && (
          <div className="mt-1 max-w-xs text-[0.68rem] text-[color:var(--color-ink-soft)]">
            {user.suspendedReason}
          </div>
        )}
      </td>
      <td className="px-5 py-2.5 text-right">
        <UserRowActions
          userId={user.id}
          status={user.status}
          isAdmin={user.role === "admin"}
        />
      </td>
    </tr>
  );
}

function RolePill({ role }: { role: UserRole }) {
  return (
    <span
      className={
        "rounded-[var(--radius-pill)] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] " +
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

function StatusLabel({
  status,
  label,
}: {
  status: "active" | "suspended" | "deleted";
  label: string;
}) {
  return (
    <span
      className={
        "text-xs " +
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
