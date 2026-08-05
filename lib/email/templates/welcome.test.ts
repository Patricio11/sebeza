/**
 * Phase 32.4  the welcome email.
 *
 * These assertions are about PROMISES, not pixels. The email is the
 * POPIA §18 transparency moment for a seeker ("here is what you agreed
 * to, here is where to change it"), and the first thing a nervous user
 * reads from us - so the properties worth pinning are: it tells the
 * truth about their consents, it escapes user input, it links to the
 * privacy centre, it carries the anti-phishing line, and it stays
 * transactional (no tracking, no marketing opt-in).
 */
import { describe, expect, it } from "vitest";
import { seekerWelcomeEmail, employerWelcomeEmail } from "./welcome";

describe("seeker welcome email (Phase 32.4)", () => {
  const base = { name: "Thandeka Mbeki", grantedConsents: [] as never[] };

  it("greets by first name only - surnames are redacted everywhere else too", () => {
    const html = seekerWelcomeEmail({ ...base });
    expect(html).toContain("Thandeka");
    expect(html).not.toContain("Mbeki");
  });

  it("escapes the name (it is user-supplied and reaches an HTML email)", () => {
    const html = seekerWelcomeEmail({
      ...base,
      name: '<img src=x onerror="alert(1)">',
    });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });

  it("states each granted consent in plain words", () => {
    const html = seekerWelcomeEmail({
      ...base,
      grantedConsents: ["searchability", "contact_reveal"],
    });
    expect(html).toContain("find you by skill and location");
    expect(html).toContain("every single request is logged");
    // …and does NOT claim consents the seeker did not grant.
    expect(html).not.toContain("cohort-level education-to-employment");
  });

  it("is honest when nothing was granted rather than silently empty", () => {
    const html = seekerWelcomeEmail({ ...base, grantedConsents: [] });
    expect(html).toContain("haven't switched any sharing options on yet");
  });

  it("always links to the privacy centre and says withdrawal is free", () => {
    const html = seekerWelcomeEmail({ ...base, grantedConsents: ["searchability"] });
    expect(html).toContain("/dashboard/privacy");
    expect(html).toMatch(/never weakens your job search/i);
  });

  it("carries the anti-phishing line", () => {
    const html = seekerWelcomeEmail({ ...base });
    expect(html).toMatch(/never<\/strong> ask you for your password/i);
    expect(html).toMatch(/never asks you to pay/i);
  });

  it("points at the three actions that actually improve outcomes", () => {
    const html = seekerWelcomeEmail({ ...base });
    expect(html).toContain("/dashboard/profile");
    expect(html).toContain("/dashboard/experience");
    expect(html).toContain("/dashboard");
  });
});

describe("employer welcome email (Phase 32.4)", () => {
  it("names the org when known and degrades gracefully when not", () => {
    expect(
      employerWelcomeEmail({ name: "Naledi K", orgName: "Discovery Bank" }),
    ).toContain("Discovery Bank");
    expect(
      employerWelcomeEmail({ name: "Naledi K", orgName: null }),
    ).toContain("Your organisation is");
  });

  it("escapes the org name too", () => {
    const html = employerWelcomeEmail({
      name: "N",
      orgName: '<script>alert(1)</script>',
    });
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("sets the expectation that verification gates contact details", () => {
    const html = employerWelcomeEmail({ name: "N", orgName: "X" });
    expect(html).toContain("/employer/onboarding");
    expect(html).toMatch(/audit-logged/i);
    expect(html).toMatch(/two-factor/i);
  });
});

describe("both emails stay transactional (Phase 32.4 guardrail)", () => {
  const samples = [
    seekerWelcomeEmail({ name: "A B", grantedConsents: ["searchability"] }),
    employerWelcomeEmail({ name: "A B", orgName: "Org" }),
  ];

  it("contains no tracking pixel or open/click analytics", () => {
    for (const html of samples) {
      // A 1x1 beacon is the classic form; also reject obvious trackers.
      expect(html).not.toMatch(/width="1"\s+height="1"/i);
      expect(html).not.toMatch(/utm_|mailchimp|sendgrid\.net\/wf\/open/i);
    }
  });

  it("smuggles in no marketing opt-in - a digest would need its own consent", () => {
    for (const html of samples) {
      expect(html).not.toMatch(/subscribe|newsletter|marketing/i);
    }
  });
});
