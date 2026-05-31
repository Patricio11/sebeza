import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "cv-backup",
  title: "Personal CV backup",
  shortDescription:
    "Upload a single PDF as your personal backup copy. Private to you  not shared with employers, not indexed for search.",
  category: "profile",
  keywords: ["cv", "resume", "backup", "pdf", "upload", "download", "private"],
  related: [
    "uploading-certificates-and-verification",
    "exporting-your-data-popia-section-23",
    "deleting-your-account-right-to-erasure",
  ],
  surfaceLink: "/dashboard/profile#cv-backup",
  updatedAt: "2026-05-31",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        The personal CV backup is a simple thing: upload one PDF of
        your CV (max 5 MB), download it whenever you need it, replace
        or delete it any time. That&rsquo;s the whole feature.
      </p>

      <h2>What it&rsquo;s for</h2>
      <p>
        Two reasons people upload:
      </p>
      <ul>
        <li>
          <strong>Backup.</strong> If your phone dies, your CV file
          dies with it. Sebenza keeps a copy in a private bucket so
          you can re-download it on any device.
        </li>
        <li>
          <strong>Permission to set up later.</strong> Some seekers
          have a CV ready but find typing the data into structured
          form fields slow. Uploading the CV first is a low-friction
          way to mark the platform as &ldquo;mine&rdquo;  you can
          fill in skills + experience + qualifications when you
          actually need them.
        </li>
      </ul>

      <Callout type="info" title="Private to you  not shared with employers">
        <p>
          The CV file is <strong>never</strong> shown to an employer.
          Not on your public profile, not in search results, not in
          any vacancy invitation. The structured fields you fill in
          (skills, experience, qualifications) are the matcher&rsquo;s
          source of truth; the CV file is your personal artefact.
        </p>
      </Callout>

      <h2>What gets uploaded</h2>
      <p>
        PDF only, single file, max 5 MB. The platform doesn&rsquo;t
        read the file&rsquo;s text  no OCR, no LLM extraction. You
        upload, you download, that&rsquo;s the contract.
      </p>

      <h2>If you delete your account</h2>
      <p>
        The CV file is part of your data. POPIA §24 erasure (from{" "}
        <em>Privacy &amp; consent</em>) removes the file along with
        the rest of your account. POPIA §23 data export (also there)
        includes a copy of the file in the download.
      </p>

      <DashboardLink href="/dashboard/profile#cv-backup">
        Open the CV backup section
      </DashboardLink>
    </HelpProse>
  );
}
