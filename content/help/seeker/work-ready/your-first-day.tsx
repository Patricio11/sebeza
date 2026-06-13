import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "your-first-day",
  title: "What to expect on your first day",
  shortDescription:
    "The first day is about settling in, not proving everything. What to bring, what to ask, and how to start well.",
  category: "work_ready",
  keywords: [
    "first day",
    "start",
    "new job",
    "onboarding",
    "documents",
    "expect",
    "settle in",
  ],
  related: ["prepare-for-an-interview", "workplace-rights-basics"],
  surfaceLink: "/dashboard",
  updatedAt: "2026-06-13",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        The first day is about settling in, not proving everything at
        once. Nobody expects you to know the place yet. Your job on day
        one is to arrive ready, pay attention, and start building trust.
      </p>

      <h2>What to bring</h2>
      <ul>
        <li>Your ID, and your bank details for payroll.</li>
        <li>
          Any documents they asked for  tax number (SARS), qualification
          certificates, proof of address.
        </li>
        <li>
          A notebook or your phone&rsquo;s notes app. You&rsquo;ll be
          told a lot of names and small rules  write them down.
        </li>
      </ul>

      <Callout type="info" title="Confirm the basics before you go">
        <p>
          The day before, confirm the start time, the address or
          meeting point, who to ask for when you arrive, and the dress
          code. A quick message saves a stressful morning.
        </p>
      </Callout>

      <h2>How to start well</h2>
      <ul>
        <li>
          <strong>Be on time.</strong> Plan transport with a buffer
          first impressions stick.
        </li>
        <li>
          <strong>Ask questions.</strong> &ldquo;Where do I find&hellip;?&rdquo;
          and &ldquo;Who should I check with about&hellip;?&rdquo; are
          good questions, not silly ones.
        </li>
        <li>
          <strong>Watch how things are done.</strong> Every workplace
          has its own rhythm. Notice it before you try to change it.
        </li>
        <li>
          <strong>Be friendly to everyone.</strong> The people who help
          you most are often not your manager.
        </li>
      </ul>

      <h2>Keep Sebenza updated</h2>
      <p>
        Once you&rsquo;ve started, update your employment status on your
        dashboard. It keeps your profile honest, and if you ever look
        for work again, your history is already here.
      </p>

      <DashboardLink href="/dashboard">
        Update your status
      </DashboardLink>
    </HelpProse>
  );
}
