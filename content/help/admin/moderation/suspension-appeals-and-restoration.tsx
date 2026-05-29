import {
  HelpProse,
  Callout,
} from "@/components/feature/help/HelpProse";
import type { HelpArticleMeta } from "@/content/help/types";

export const meta: HelpArticleMeta = {
  slug: "suspension-appeals-and-restoration",
  title: "Suspension appeals + restoration",
  shortDescription:
    "How a suspended user appeals, the queue that lands in, who reviews. The two-key restoration rule for reversing another admin's suspension.",
  category: "moderation",
  keywords: [
    "appeal",
    "restore",
    "restoration",
    "two-key",
    "reverse",
    "suspension",
  ],
  related: [
    "when-to-suspend-an-account",
    "reading-profile-reports",
    "team-roles-and-permissions",
  ],
  surfaceLink: "/admin/users",
  updatedAt: "2026-05-29",
};

export default function Article() {
  return (
    <HelpProse>
      <p>
        A suspended user sees a Sebenza sign-in screen that says
        &ldquo;Your account is suspended pending review&rdquo; with a
        contact link. The contact link opens a structured appeal form
        &mdash; not an email to anyone&rsquo;s personal address. That
        form lands in the suspension-appeals queue inside the Users
        surface.
      </p>

      <h2>What the appeal carries</h2>
      <ul>
        <li>
          The original suspension reason + the suspending
          admin&rsquo;s ID + the timestamp.
        </li>
        <li>
          The user&rsquo;s appeal text. Up to 2000 chars; longer than
          the qualification-appeal limit because suspensions are more
          consequential.
        </li>
        <li>
          Any documents the user attaches (typical: an explanation
          email, a screenshot of the messaging that&rsquo;s being
          contested).
        </li>
        <li>
          A snapshot of the audit-log rows + reports that led to the
          suspension &mdash; the reviewer doesn&rsquo;t have to
          re-derive context.
        </li>
      </ul>

      <h2>The two-key rule for reversal</h2>
      <p>
        An admin cannot reverse their own suspension. That is enforced
        server-side. If you suspended an account and the appeal
        convinces you that you were wrong, you do not lift the
        suspension yourself &mdash; you write a note in the appeal
        case saying &ldquo;Reversing my own decision: here&rsquo;s
        why,&rdquo; and another Operator (or a Lead) executes the
        restore.
      </p>
      <p>
        The two-key rule exists because a suspension that&rsquo;s
        executed and reversed by the same admin within minutes looks,
        in the audit log, indistinguishable from collusion. Requiring
        a second admin&rsquo;s sign-off is friction on purpose.
      </p>

      <h2>What a restore does</h2>
      <ul>
        <li>
          Lifts the suspension state on the account.
        </li>
        <li>
          Writes one <em>account.restored</em> audit row with the
          restoring admin&rsquo;s ID + the reason note.
        </li>
        <li>
          Sends a notification + email to the restored user
          confirming the outcome.
        </li>
        <li>
          Does <em>not</em> auto-reverse follow-on effects. Pending
          invitations that were marked withdrawn at suspension stay
          withdrawn; the user has to re-engage. We considered
          auto-restoring those and decided against it: the
          counterparties saw a withdrawal notification, and quietly
          un-withdrawing would be misleading.
        </li>
      </ul>

      <Callout type="info" title="When the user doesn't appeal">
        <p>
          Many full-suspend cases never see an appeal. That&rsquo;s
          expected for confirmed bad-faith accounts. Don&rsquo;t
          read silence as guilt; some suspended users simply move
          on. The audit log keeps the case open indefinitely; if an
          appeal lands a year later, you handle it then.
        </p>
      </Callout>
    </HelpProse>
  );
}
