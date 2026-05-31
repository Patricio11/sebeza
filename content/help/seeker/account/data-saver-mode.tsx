import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "data-saver-mode",
  title: "Data saver mode  lighter pages for expensive data",
  shortDescription:
    "Skip avatar images, swap charts for tables, lazy-load below the fold. Honours your browser&rsquo;s Save-Data signal automatically.",
  category: "account",
  keywords: [
    "data saver",
    "bandwidth",
    "mobile",
    "save-data",
    "lite",
    "3g",
    "lightweight",
  ],
  related: [
    "managing-notification-preferences",
  ],
  surfaceLink: "/dashboard/account",
  updatedAt: "2026-05-31",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Mobile data in South Africa is expensive. The data-saver
        toggle in <em>Account &rarr; Data + bandwidth</em> shaves
        bytes on every page without removing functionality.
      </p>

      <h2>What changes when it&rsquo;s on</h2>
      <ul>
        <li>
          <strong>Avatars</strong> render as initials blocks instead
          of fetching the photo. No image network requests.
        </li>
        <li>
          <strong>Career Compass</strong> below-fold sections defer
          loading until you scroll near them.
        </li>
        <li>
          <strong>Charts</strong> on insights pages render the data
          as tables instead of canvas.
        </li>
        <li>
          <strong>Activity feeds</strong> load fewer items upfront
          with a &ldquo;Load more&rdquo; control.
        </li>
      </ul>

      <Callout type="info" title="Browser signal is the floor">
        <p>
          If your browser sends <code>Save-Data: on</code> (Chrome /
          Edge on a metered connection, mobile data-saver setting),
          the platform treats it as if the toggle was on  even if
          you haven&rsquo;t flipped the account toggle. The account
          toggle is the ceiling: turn it on once + the experience
          stays light across devices.
        </p>
      </Callout>

      <h2>What doesn&rsquo;t change</h2>
      <p>
        Every action you need to use Sebenza still works. The
        downgrades are visual + bandwidth-focused; no feature is
        gated by data-saver. Confirming your status, accepting an
        invitation, uploading a certificate  all still one tap
        away.
      </p>

      <DashboardLink href="/dashboard/account">Open Account</DashboardLink>
    </HelpProse>
  );
}
