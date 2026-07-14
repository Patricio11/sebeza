import { setRequestLocale } from "next-intl/server";
import { DashboardMasthead } from "@/components/layout/DashboardMasthead";
import { verifyAdmin } from "@/lib/auth/dal";
import { getSetting } from "@/lib/admin/settings";
import { listAllTestimonials } from "@/lib/testimonials";
import { TestimonialsManager } from "@/components/feature/admin/TestimonialsManager";

/**
 * Phase 24  admin curation of testimonials + the collection campaign. Only
 * approved rows render on the landing rail; user rows carry the public-display
 * consent recorded at submission.
 */
export default async function AdminTestimonialsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  await verifyAdmin();

  const [rows, campaignOn] = await Promise.all([
    listAllTestimonials(),
    getSetting<boolean>("testimonial_campaign_active"),
  ]);

  return (
    <DashboardMasthead
      role="admin"
      pageEyebrow="Voice of users"
      pageTitle="Testimonials"
      pageSubtitle="Real, consented words from seekers and employers. Run a collection campaign, review what comes in, and choose what shows on the landing page  nothing renders publicly without approval."
    >
      <TestimonialsManager rows={rows} campaignOn={campaignOn} />
    </DashboardMasthead>
  );
}
