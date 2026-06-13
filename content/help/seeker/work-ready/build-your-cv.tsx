import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "build-your-cv",
  title: "Build your CV",
  shortDescription:
    "Turn the profile you already filled in into a clean, printable CV  no retyping, no cost. Pick a layout, save it as a PDF.",
  category: "work_ready",
  keywords: [
    "cv",
    "resume",
    "build",
    "create",
    "make",
    "pdf",
    "print",
    "template",
    "download",
    "free",
  ],
  related: ["cv-backup", "skills-youre-still-learning", "prepare-for-an-interview"],
  surfaceLink: "/dashboard/cv",
  updatedAt: "2026-06-13",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        You already did the hard part. The skills, experience and
        qualifications you typed into your profile <em>are</em> a CV
        Sebenza just lays them out for you. Open the CV builder, pick a
        layout, and save it as a PDF you can send to anyone. It&rsquo;s
        free, and you never retype a thing.
      </p>

      <h2>What goes on it</h2>
      <p>
        Everything you&rsquo;ve already added: your name, your
        profession, where you&rsquo;re based, your skills (with how many
        years you&rsquo;ve done each), your work history, and your
        qualifications. If a section is empty on your profile, it
        simply doesn&rsquo;t appear  so the more complete your profile,
        the fuller your CV.
      </p>

      <Callout type="tip" title="Fill the gaps first">
        <p>
          A thin profile makes a thin CV. Before you print, spend ten
          minutes adding any missing skills or a past job  it lifts
          both your CV <em>and</em> how easily employers find you.
        </p>
      </Callout>

      <h2>Honest by design</h2>
      <p>
        Your CV shows your skills the same way your public profile does
         as <strong>your own rating</strong>, never stamped
        &ldquo;verified&rdquo; unless an employer or institution
        actually confirmed it. That&rsquo;s deliberate. An honest CV
        that matches your profile builds more trust than an inflated
        one that falls apart in the interview.
      </p>

      <h2>Two layouts</h2>
      <ul>
        <li>
          <strong>Classic</strong>  one clean column. Easiest for
          employers&rsquo; systems to read, and the safest default.
        </li>
        <li>
          <strong>Compact</strong>  a tighter two-column look on a
          bigger screen that folds back to one column on your phone and
          in print.
        </li>
      </ul>

      <h2>Saving it</h2>
      <p>
        Tap <strong>Print / Save as PDF</strong>. Your phone or computer
        opens its normal print screen  choose &ldquo;Save as
        PDF&rdquo; instead of a printer. That PDF is yours to send by
        email or WhatsApp. If you want a safe copy kept for you, upload
        it to your private <em>CV backup</em> on the profile page.
      </p>

      <DashboardLink href="/dashboard/cv">
        Build your CV
      </DashboardLink>
    </HelpProse>
  );
}
