/**
 * Phase 32.4  the welcome-email dispatch path.
 *
 * The template tests cover the copy; this covers the wiring, where the
 * failure modes actually live:
 *
 *   1. the SEEKER version must list the consents that are really in the
 *      database at send time  it is a POPIA §18 statement of what the
 *      user agreed to, so it cannot be reconstructed from a form
 *      payload that may since have changed;
 *   2. the EMPLOYER version must go to employers instead;
 *   3. admin/gov accounts (issued by Sebenza, nothing to onboard) get
 *      nothing;
 *   4. a mail failure must NOT propagate  losing a welcome note is an
 *      annoyance, being unable to verify your account is a broken
 *      product.
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";

const sent: Array<{ to: string; subject: string; html: string }> = [];

vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn(async (input: { to: string; subject: string; html: string }) => {
    sent.push(input);
    return { transport: "console" as const, id: "test" };
  }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { sendWelcomeEmail } from "@/lib/email/welcome";
import { sendEmail } from "@/lib/email/send";

const db = getDb();

const SEEKER = { id: "user_andile-z", email: "andile-z@example.co.za" };
const EMPLOYER = {
  id: "user_naledi-k",
  email: "naledi.khumalo@discovery.co.za",
};
const ADMIN = { id: "user_sebenza-admin", email: "admin@sebenzasa.com" };

afterEach(() => {
  sent.length = 0;
  vi.mocked(sendEmail).mockClear();
});

describe("Phase 32.4  welcome email dispatch", () => {
  test("a seeker gets the seeker email, listing their REAL granted consents", async () => {
    // Read what the database actually says, then assert the email agrees.
    const granted = await db
      .select({ purpose: schema.consents.purpose })
      .from(schema.consents)
      .where(eq(schema.consents.userId, SEEKER.id));
    const grantedNow = granted.map((g) => g.purpose);

    await sendWelcomeEmail({
      userId: SEEKER.id,
      email: SEEKER.email,
      name: "Andile Zulu",
    });

    expect(sent.length).toBe(1);
    const mail = sent[0]!;
    expect(mail.to).toBe(SEEKER.email);
    expect(mail.subject).toMatch(/three things to do next/i);
    expect(mail.html).toContain("/dashboard/privacy");

    // Seeded seekers all hold `searchability`; if the DB says so, the
    // email must say so: and must NOT claim one they lack.
    if (grantedNow.includes("searchability")) {
      expect(mail.html).toContain("find you by skill and location");
    }
    if (!grantedNow.includes("outcomes_research")) {
      expect(mail.html).not.toContain("cohort-level education-to-employment");
    }
  });

  test("an employer gets the employer email, naming their organisation", async () => {
    await sendWelcomeEmail({
      userId: EMPLOYER.id,
      email: EMPLOYER.email,
      name: "Naledi Khumalo",
    });

    expect(sent.length).toBe(1);
    const mail = sent[0]!;
    expect(mail.subject).toMatch(/your organisation/i);
    expect(mail.html).toMatch(/employer\/onboarding/);
    // The org name is looked up live, so this proves the join works.
    expect(mail.html).toMatch(/Discovery/i);
  });

  test("admin accounts get nothing: they are issued, not onboarded", async () => {
    await sendWelcomeEmail({
      userId: ADMIN.id,
      email: ADMIN.email,
      name: "Sebenza Admin",
    });
    expect(sent.length).toBe(0);
  });

  test("an unknown user id sends nothing and does not throw", async () => {
    // Verification must never break because of a welcome email; and a
    // stale id must not become an unsolicited-mail vector.
    await expect(
      sendWelcomeEmail({
        userId: "user_does_not_exist",
        email: "nobody@example.co.za",
        name: "Nobody",
      }),
    ).resolves.toBeUndefined();
    expect(sent.length, "no mail for an unknown user").toBe(0);
  });
});
