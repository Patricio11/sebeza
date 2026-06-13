import {
  HelpProse,
  Callout,
  DashboardLink,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "spotting-job-scams",
  title: "Spotting job scams",
  shortDescription:
    "If a job asks you to pay, rushes you, or wants your banking PIN, it's a scam. The clear warning signs, and how to report a bad invitation on Sebenza.",
  category: "work_ready",
  keywords: [
    "scam",
    "fraud",
    "fake job",
    "safety",
    "report",
    "pay",
    "deposit",
    "whatsapp",
    "warning",
    "phishing",
  ],
  related: ["workplace-rights-basics", "blocking-employers", "contact-reveal-how-it-works"],
  surfaceLink: "/dashboard/invitations",
  updatedAt: "2026-06-13",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        Real employers pay <em>you</em>. The simplest rule there is: if
        a &ldquo;job&rdquo; asks you to pay money, share a banking PIN or
        OTP, or move off-platform to a stranger&rsquo;s WhatsApp under
        pressure  stop. These are the most common ways people get
        cheated looking for work.
      </p>

      <Callout type="warning" title="Never pay for a job">
        <p>
          No legitimate employer charges you a &ldquo;registration
          fee,&rdquo; &ldquo;training deposit,&rdquo; &ldquo;uniform
          fee,&rdquo; or &ldquo;courier fee&rdquo; to start. If money has
          to leave your pocket to get the job, it&rsquo;s a scam.
        </p>
      </Callout>

      <h2>The warning signs</h2>
      <ul>
        <li>
          <strong>They ask for money</strong>  any fee, deposit, or
          &ldquo;refundable&rdquo; payment.
        </li>
        <li>
          <strong>They ask for your PIN, OTP, or card details.</strong>{" "}
          No employer needs these. Ever.
        </li>
        <li>
          <strong>It&rsquo;s too good</strong>  huge pay for little work,
          no experience needed, &ldquo;start today.&rdquo;
        </li>
        <li>
          <strong>They rush you</strong>  &ldquo;pay now or lose the
          spot.&rdquo; Pressure is the scammer&rsquo;s main tool.
        </li>
        <li>
          <strong>They want your ID document to keep</strong>, or your
          passwords, or want everything moved to a personal chat
          immediately.
        </li>
        <li>
          <strong>Vague details</strong>  no real company name, no
          contract, an email address that isn&rsquo;t the company&rsquo;s.
        </li>
      </ul>

      <h2>How Sebenza protects you</h2>
      <p>
        Employers who reveal your contact must be a verified
        organisation, and every reveal is recorded on your activity
        ledger. You&rsquo;re never required to share your banking
        details with anyone to receive an invitation. If an invitation
        feels wrong, you don&rsquo;t have to engage.
      </p>

      <Callout type="tip" title="Report it  it protects others too">
        <p>
          On any vacancy invitation you can <strong>report</strong> it.
          That flags it to our admins, and you can{" "}
          <strong>block</strong> that employer so they can&rsquo;t reach
          you again. Reporting a bad-faith invitation helps the next
          job-seeker as well as you.
        </p>
      </Callout>

      <DashboardLink href="/dashboard/invitations">
        Review your invitations
      </DashboardLink>
    </HelpProse>
  );
}
