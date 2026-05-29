import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "curriculum-vs-market-demand-for-students",
  title: "Curriculum vs market demand (for students)",
  shortDescription:
    "If you're a student: see how your programme's skill coverage compares to what employers in your province are actually hiring for.",
  category: "growth",
  keywords: [
    "student",
    "curriculum",
    "university",
    "tvet",
    "programme",
    "graduate",
    "market demand",
    "lecturer",
  ],
  related: [
    "career-compass-recommendations",
    "uploading-certificates-and-verification",
  ],
  surfaceLink: "/dashboard/grow",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        If you flagged yourself as a student during onboarding &mdash;
        institution + programme + NQF level + expected graduation year
        &mdash; the Career compass adds a student-only card:{" "}
        <em>Curriculum vs market demand</em>. It compares the typical
        skill outcomes of your programme against the live demand in
        your (profession × province) pool.
      </p>

      <h2>What the card shows</h2>
      <ul>
        <li>
          <strong>Programme coverage.</strong> A short list of the
          skills your programme typically equips students with, drawn
          from the institution&rsquo;s published curriculum where
          available, or inferred from past graduates&rsquo; profiles.
        </li>
        <li>
          <strong>In-demand skills your programme covers.</strong>{" "}
          Skills that overlap between the two &mdash; the
          &ldquo;you&rsquo;re on the right track&rdquo; column.
        </li>
        <li>
          <strong>In-demand skills your programme doesn&rsquo;t
          cover.</strong> The gap. These are skills employers in your
          province are actively hiring for that your programme
          isn&rsquo;t structurally teaching you. Use this list as the
          most concrete possible roadmap for what to learn outside
          coursework.
        </li>
        <li>
          <strong>Programme-covered skills with no local demand.</strong>{" "}
          The honest other column &mdash; things you&rsquo;ll learn
          that employers in your province aren&rsquo;t (currently)
          hiring for. Doesn&rsquo;t mean don&rsquo;t learn them;
          academic value isn&rsquo;t just employer demand. Means: budget
          your time accordingly.
        </li>
      </ul>

      <Callout type="info" title="This is for you, not your lecturer">
        <p>
          The student card is private. Your institution doesn&rsquo;t
          see it; your lecturer doesn&rsquo;t see it; it isn&rsquo;t
          fed back to programme accreditation bodies. Sebenza does
          generate aggregated, anonymised programme-vs-demand reports
          for government and tertiary institutions in a separate
          surface (see <em>Government insights</em>), but those reports
          are cohort-level &mdash; never a single student&rsquo;s data.
        </p>
      </Callout>

      <h2>What to do with the gap</h2>
      <p>
        Pick one skill from the &ldquo;not covered&rdquo; list. Find a
        learning path on the compass for it (most have at least one
        free or low-cost route). Set yourself a 6-month goal of
        getting to intermediate proficiency. Add it to your profile
        when you&rsquo;re ready. By the time you graduate, you&rsquo;ll
        have a credential <em>and</em> a credible in-demand skill the
        rest of your cohort doesn&rsquo;t &mdash; which is exactly the
        differentiator graduate dossier reviews look for.
      </p>
    </HelpProse>
  );
}
