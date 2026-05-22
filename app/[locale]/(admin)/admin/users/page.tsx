import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ADMIN_NAV, MOCK_ADMIN } from "@/components/layout/adminNav";
import { dataProvider } from "@/lib/data/provider";
import { verifyAdmin } from "@/lib/auth/dal";
import { CustomSelect } from "@/components/ui/CustomSelect";

interface MockUserRow {
  handle: string;
  display: string;
  email: string;
  role: "seeker" | "employer" | "admin";
  joined: string;
  status: "active" | "suspended" | "deleted";
}

const EXTRA_USERS: MockUserRow[] = [
  { handle: "naledi-k", display: "Naledi Khumalo", email: "naledi.khumalo@discovery.co.za", role: "employer", joined: "Jan 2024", status: "active" },
  { handle: "aisha-p", display: "Aisha Patel", email: "aisha.patel@discovery.co.za", role: "employer", joined: "Apr 2024", status: "active" },
  { handle: "suspect-account", display: "Anonymised", email: "—", role: "seeker", joined: "May 2026", status: "suspended" },
];

export default async function UsersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await verifyAdmin();
  const t = await getTranslations("adminDash.users");

  const profiles = (await dataProvider.searchProfiles({})).profiles;
  const seekerRows: MockUserRow[] = profiles.map((p) => ({
    handle: p.handle,
    display: p.displayName,
    email: `${p.handle}@example.co.za`,
    role: "seeker",
    joined: new Date(p.memberSince).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
    }),
    status: "active",
  }));
  const rows = [...seekerRows, ...EXTRA_USERS];

  return (
    <DashboardShell
      role="admin"
      workspaceLabel={MOCK_ADMIN.fullName}
      workspaceEyebrow="Administrator · 2FA required"
      nav={ADMIN_NAV}
      activeKey="users"
      pageEyebrow="Account directory"
      pageTitle={t("title")}
      pageSubtitle={t("subtitle")}
    >
      <form className="mb-6 grid gap-3 md:grid-cols-[2fr_1fr_auto]">
        <input
          placeholder="Search handle, email or display name…"
          className="h-10 rounded-[var(--radius-sm)] border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] px-3 text-sm"
        />
        <CustomSelect
          ariaLabel="Filter by role"
          variant="compact"
          name="role"
          defaultValue=""
          placeholder="All roles"
          options={[
            { value: "", label: "All roles" },
            { value: "seeker", label: "Seeker" },
            { value: "employer", label: "Employer" },
            { value: "admin", label: "Admin" },
          ]}
        />
        <button
          type="submit"
          className="h-10 rounded-[var(--radius-pill)] bg-[color:var(--color-ink)] px-5 text-sm font-medium text-[color:var(--color-paper)]"
        >
          Search
        </button>
      </form>

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
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.handle} className="border-t border-[color:var(--color-hairline)]">
                <td className="px-5 py-2.5">
                  {u.role === "seeker" ? (
                    <Link
                      href={`/p/${u.handle}`}
                      className="font-display text-base hover:underline"
                    >
                      {u.display}
                    </Link>
                  ) : (
                    <span className="font-display text-base">{u.display}</span>
                  )}
                  <div className="text-xs text-[color:var(--color-ink-soft)]">
                    @{u.handle}
                  </div>
                </td>
                <td className="px-5 py-2.5 text-[color:var(--color-ink-soft)]">{u.email}</td>
                <td className="px-5 py-2.5">
                  <span
                    className={
                      "rounded-[var(--radius-pill)] px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] " +
                      (u.role === "admin"
                        ? "bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
                        : u.role === "employer"
                          ? "bg-[color:var(--color-accent-tint)] text-[color:var(--color-accent)]"
                          : "bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]")
                    }
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-5 py-2.5 text-[color:var(--color-ink-soft)]">{u.joined}</td>
                <td className="px-5 py-2.5">
                  <span
                    className={
                      "text-xs " +
                      (u.status === "active"
                        ? "text-[color:var(--color-employed)]"
                        : u.status === "suspended"
                          ? "text-[color:var(--color-danger)]"
                          : "text-[color:var(--color-ink-soft)]")
                    }
                  >
                    {t(u.status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-3 md:hidden">
        {rows.map((u) => (
          <li
            key={u.handle}
            className="rounded-xl border border-[color:var(--color-hairline)] bg-[color:var(--color-surface)] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {u.role === "seeker" ? (
                  <Link
                    href={`/p/${u.handle}`}
                    className="font-display text-lg leading-tight hover:underline"
                  >
                    {u.display}
                  </Link>
                ) : (
                  <span className="font-display text-lg leading-tight">
                    {u.display}
                  </span>
                )}
                <div className="truncate text-xs text-[color:var(--color-ink-soft)]">
                  @{u.handle} · {u.email}
                </div>
              </div>
              <span
                className={
                  "shrink-0 rounded-full px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.18em] " +
                  (u.role === "admin"
                    ? "bg-[color:var(--color-ink)] text-[color:var(--color-paper)]"
                    : u.role === "employer"
                      ? "bg-[color:var(--color-accent-tint)] text-[color:var(--color-accent)]"
                      : "bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-strong)]")
                }
              >
                {u.role}
              </span>
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-dashed border-[color:var(--color-hairline)] pt-3 text-xs">
              <span className="text-[color:var(--color-ink-soft)]">
                Joined {u.joined}
              </span>
              <span
                className={
                  u.status === "active"
                    ? "text-[color:var(--color-employed)]"
                    : u.status === "suspended"
                      ? "text-[color:var(--color-danger)]"
                      : "text-[color:var(--color-ink-soft)]"
                }
              >
                {t(u.status)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </DashboardShell>
  );
}
