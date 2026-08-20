/**
 * Every notification kind must produce a real email.
 *
 * The bug this locks out: `emailContentFor` used to return null for any
 * kind without a bespoke template, and `createNotification` treats null
 * as "nothing to send". Six of the sixteen kinds a seeker can manage
 * were in that state, so switching the Email toggle on for one of them
 * did nothing at all, silently, with no error to notice.
 */
import { describe, it, expect } from "vitest";
import { NOTIFICATION_CATALOG, type NotificationKind } from "@/lib/notifications/catalog";
import { emailContentFor } from "./notifications";

const KINDS = Object.keys(NOTIFICATION_CATALOG) as NotificationKind[];

const ctx = {
  recipientName: "Thandeka",
  title: "Something happened",
  body: "A short description of the thing.",
  link: "/dashboard",
  meta: null,
};

describe("emailContentFor", () => {
  it("covers every kind in the catalog", () => {
    const missing = KINDS.filter((k) => emailContentFor(k, ctx) === null);
    expect(missing, `kinds with no email content: ${missing.join(", ")}`).toEqual([]);
  });

  it("gives every kind a non-empty subject and an HTML body", () => {
    for (const kind of KINDS) {
      const content = emailContentFor(kind, ctx);
      expect(content, kind).not.toBeNull();
      expect(content!.subject.trim().length, `${kind} subject`).toBeGreaterThan(0);
      expect(content!.html, `${kind} html`).toContain("<");
      // Every email says how to stop receiving it. POPIA s.11(3)(b) and
      // basic decency.
      expect(content!.html.toLowerCase(), `${kind} opt-out`).toContain(
        "notification preferences",
      );
    }
  });

  it("escapes a hostile title rather than rendering it as markup", () => {
    const content = emailContentFor("contact.revealed", {
      ...ctx,
      title: '<script>alert("x")</script>',
    });
    expect(content!.html).not.toContain("<script>");
  });
});
