import { setRequestLocale } from "next-intl/server";
import { DashboardFrame } from "@/components/layout/DashboardFrame";
import { GOV_NAV } from "@/components/layout/govNav";
import { verifyGov } from "@/lib/auth/dal";

/**
 * Gov / policy route-group layout. Renders the persistent <DashboardFrame>
 * once (Part A pattern); `verifyGov()` guards (gov or admin, 2FA enforced).
 *
 * The frame's chrome is `print:hidden`, so the standalone print-CSS page in
 * this group (`/gov/brief`) still prints as a clean, full-width document.
 */
export default async function GovLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const me = await verifyGov();

  return (
    <DashboardFrame
      role="gov"
      workspaceLabel={me.name}
      workspaceEyebrow="Government / policy workspace"
      nav={GOV_NAV}
    >
      {children}
    </DashboardFrame>
  );
}
