import { setRequestLocale } from "next-intl/server";
import { DashboardFrame } from "@/components/layout/DashboardFrame";
import { ADMIN_NAV } from "@/components/layout/adminNav";
import { verifyAdmin } from "@/lib/auth/dal";

/**
 * Admin route-group layout. Renders the persistent <DashboardFrame> (sidebar +
 * mobile nav) ONCE, around every admin page, so navigating between pages only
 * swaps the page content (the masthead + main)  the sidebar stays mounted and
 * never flashes a full-page skeleton. `loading.tsx` in this segment therefore
 * fills only the main column, not the whole screen.
 *
 * `verifyAdmin()` runs here as a layout-level guard (defence in depth) and to
 * source the workspace label; pages still call it for their own session/data.
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await verifyAdmin();

  return (
    <DashboardFrame
      role="admin"
      workspaceLabel={session.name ?? "Admin"}
      workspaceEyebrow="Administrator · 2FA required"
      nav={ADMIN_NAV}
    >
      {children}
    </DashboardFrame>
  );
}
