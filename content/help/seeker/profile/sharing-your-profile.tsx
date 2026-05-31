import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "sharing-your-profile",
  title: "Sharing your profile  WhatsApp, LinkedIn, link unfurls",
  shortDescription:
    "Two surfaces: a quick-copy URL card and a rich-preview share modal. Recipients see a Civic-Editorial PNG card on WhatsApp + LinkedIn unfurls.",
  category: "profile",
  keywords: [
    "share",
    "whatsapp",
    "linkedin",
    "profile",
    "link",
    "preview",
    "og:image",
    "card",
  ],
  related: [
    "your-public-profile-url",
    "understanding-profile-completeness",
  ],
  surfaceLink: "/dashboard/profile",
  updatedAt: "2026-05-31",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Your public profile lives at <code>sebenza.co.za/p/{`{handle}`}</code>.
        Send anyone that URL  WhatsApp, LinkedIn, email, SMS  and
        they see the same redacted public view employers see.
      </p>

      <h2>Two share surfaces</h2>
      <ul>
        <li>
          <strong>Quick-copy URL card</strong>: the existing
          &ldquo;Share your profile&rdquo; box at the top of the
          editor. URL, Copy, Open, and (on supported devices) the
          native iOS / Android share sheet.
        </li>
        <li>
          <strong>Share my profile modal</strong> (new): one tap to
          open a sheet with WhatsApp + LinkedIn deep-links and a
          one-click copy. WhatsApp opens a pre-filled draft message
          with your URL.
        </li>
      </ul>

      <h2>Rich preview on link unfurl</h2>
      <p>
        When you share <code>/p/{`{handle}`}</code> in WhatsApp,
        LinkedIn, or Slack, the platform fetches{" "}
        <code>/p/{`{handle}`}/card</code> in the background and
        displays a 1200&times;630 preview image with your display
        name, profession, top three skills, verification chip, and
        the Sebenza wordmark. Civic-Editorial typography; no
        animation, no QR code, no Sebenza CTA overpowering your
        name.
      </p>

      <Callout type="info" title="Same redaction as the profile">
        <p>
          The card route reads through the same data path as the
          public profile, so the same redaction rules apply: no ID
          number, no documents, no raw contact details. Profiles
          without searchability consent render a generic
          &ldquo;Profile not available&rdquo; image rather than
          leak data.
        </p>
      </Callout>

      <h2>What we don&rsquo;t do</h2>
      <p>
        No tracking pixel on the preview image. We don&rsquo;t know
        who scanned it; we don&rsquo;t need to. The card route is
        cached for seven days so a viral spike doesn&rsquo;t
        re-render the image for every viewer.
      </p>

      <DashboardLink href="/dashboard/profile">Open profile editor</DashboardLink>
    </HelpProse>
  );
}
