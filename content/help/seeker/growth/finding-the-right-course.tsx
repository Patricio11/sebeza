import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "finding-the-right-course",
  title: "Finding the right course  reading a learning-path card",
  shortDescription:
    "Each learning path on the Career Compass shows a direct application link, a Reviewed chip when Sebenza editorial has vetted it, and an honest cost line.",
  category: "growth",
  keywords: [
    "course",
    "learning",
    "path",
    "seta",
    "tvet",
    "wits",
    "review",
    "enrol",
  ],
  related: [
    "learning-paths-and-proficiency",
    "career-compass-recommendations",
  ],
  surfaceLink: "/dashboard/grow",
  updatedAt: "2026-05-31",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Career compass surfaces real SA learning paths  SETA
        learnerships, public TVET diplomas, university short courses,
        free online resources. Each card now carries a direct
        application link so you can move from &ldquo;read&rdquo; to
        &ldquo;apply&rdquo; without Googling.
      </p>

      <h2>What the card shows</h2>
      <ul>
        <li>
          <strong>Provider chip</strong>: SETA, Public TVET, SAQA,
          university, or open / free.
        </li>
        <li>
          <strong>Cost chip</strong>: free, subsidised, or paid
          with a one-line cost note (&ldquo;Stipend-paying, fully
          funded for unemployed SA citizens&rdquo;,
          &ldquo;NSFAS funding available; typical out-of-pocket
          ~R 4 000/year&rdquo;).
        </li>
        <li>
          <strong>Open application</strong> primary CTA  opens the
          provider&rsquo;s own enrolment page in a new tab. The link
          goes straight to the provider; we don&rsquo;t redirect via
          Sebenza.
        </li>
        <li>
          <strong>Reviewed</strong> chip (when present)  Sebenza
          editorial has actually visited + verified the provider +
          the specific course.
        </li>
      </ul>

      <Callout type="info" title="Honest when the link is missing">
        <p>
          Some paths don&rsquo;t have a URL we&rsquo;ve verified yet.
          Those cards show a quiet hint instead of a dead button:
          &ldquo;Provider link coming  search this title on Google
          for now&rdquo;. Better to be honest than to ship a stale
          link.
        </p>
      </Callout>

      <h2>What we don&rsquo;t do</h2>
      <p>
        No paid placement. The ordering of paths is editorial
        free-first, then provider quality. No sponsored slots, no
        affiliate kickbacks.
      </p>

      <DashboardLink href="/dashboard/grow">Open Career Compass</DashboardLink>
    </HelpProse>
  );
}
