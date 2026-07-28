import "server-only";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { sendEmail } from "@/lib/email/send";
import {
  seekerWelcomeEmail,
  employerWelcomeEmail,
} from "@/lib/email/templates/welcome";
import type { ConsentPurpose } from "@/lib/consent";

/**
 * Phase 32.4  send the right welcome email for the user's role.
 *
 * Called from Better Auth's `afterEmailVerification` hook, so the
 * address is already proven. Everything here is best-effort by design:
 * the caller catches, and this function additionally degrades rather
 * than throwing, because a welcome email must never be able to break
 * account verification.
 *
 * The seeker version lists the consents the user ACTUALLY granted,
 * read live from the `consents` table rather than guessed from the
 * sign-up payload  it is the POPIA §18 "here is what you agreed to"
 * moment, so it has to be true at the moment of sending.
 */
export async function sendWelcomeEmail(input: {
  userId: string;
  email: string;
  name: string;
}): Promise<void> {
  const db = getDb();

  const rows = await db
    .select({ role: schema.appUser.role })
    .from(schema.appUser)
    .where(eq(schema.appUser.id, input.userId))
    .limit(1);
  // No row = nothing to welcome. In practice unreachable (the hook only
  // fires for a freshly-verified user), but defaulting to "seeker" and
  // mailing anyway would be a small unsolicited-mail vector if this were
  // ever called with a stale id.
  if (!rows[0]) return;
  const role = rows[0].role ?? "seeker";

  if (role === "employer") {
    const orgRows = await db
      .select({ name: schema.organizations.name })
      .from(schema.organizationMembers)
      .innerJoin(
        schema.organizations,
        eq(schema.organizationMembers.organizationId, schema.organizations.id),
      )
      .where(eq(schema.organizationMembers.userId, input.userId))
      .limit(1);

    await sendEmail({
      to: input.email,
      subject: "Welcome to Sebenza  next steps for your organisation",
      html: employerWelcomeEmail({
        name: input.name,
        orgName: orgRows[0]?.name ?? null,
      }),
    });
    return;
  }

  // Admin + gov accounts are issued by Sebenza, not self-registered;
  // they get no onboarding email (there is nothing for them to finish).
  if (role !== "seeker") return;

  const granted = await db
    .select({ purpose: schema.consents.purpose })
    .from(schema.consents)
    .where(
      and(
        eq(schema.consents.userId, input.userId),
        eq(schema.consents.state, "granted"),
      ),
    );

  await sendEmail({
    to: input.email,
    subject: "Welcome to Sebenza  three things to do next",
    html: seekerWelcomeEmail({
      name: input.name,
      grantedConsents: granted.map((g) => g.purpose as ConsentPurpose),
    }),
  });
}
