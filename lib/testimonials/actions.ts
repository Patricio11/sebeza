"use server";

/**
 * Phase 24  user-facing testimonial actions.
 *
 * `submitTestimonial`: campaign-gated; captures the display fields AT
 * SUBMISSION (seeker → first name + profession · city; employer → name + org)
 * under an explicit public-display consent checkbox; lands as `pending` for
 * admin curation; marks the user never-prompt-again. The quote body is never
 * put in audit meta.
 *
 * `snoozeTestimonialPrompt`: dismiss = don't ask again for 30 days.
 */

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { getSessionUser } from "@/lib/auth/guard";
import { getSetting } from "@/lib/admin/settings";
import { logAccess } from "@/lib/audit";

const QUOTE_MAX = 280;
const SNOOZE_DAYS = 30;

export type SubmitTestimonialResult =
  | { ok: true }
  | { ok: false; error: string };

export async function submitTestimonial(
  quote: string,
  consentDisplay: boolean,
): Promise<SubmitTestimonialResult> {
  const campaignOn = await getSetting<boolean>("testimonial_campaign_active");
  if (!campaignOn) return { ok: false, error: "Collection isn't open right now." };

  const session = await getSessionUser();
  if (!session) return { ok: false, error: "Not signed in." };
  if (!consentDisplay) {
    return {
      ok: false,
      error: "Please confirm we may show your words publicly.",
    };
  }
  const clean = (quote ?? "").trim().replace(/\s+/g, " ").slice(0, QUOTE_MAX);
  if (clean.length < 20) {
    return { ok: false, error: "A sentence or two helps  at least 20 characters." };
  }

  const db = getDb();

  // Display fields captured NOW, with role-appropriate context. First name
  // only (POPIA-light), never the surname.
  let displayName = (session.name ?? "A Sebenza user").split(/\s+/)[0] ?? "A Sebenza user";
  let displayContext = "Sebenza user";
  let authorRole: "seeker" | "employer" = "seeker";

  const [profile] = await db
    .select({
      displayName: schema.profiles.displayName,
      profession: schema.profiles.profession,
      city: schema.profiles.city,
    })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, session.id))
    .limit(1);
  if (profile) {
    const first = profile.displayName.split(/\s+/)[0] ?? displayName;
    const initial =
      profile.displayName.split(/\s+/)[1]?.charAt(0)?.toUpperCase() ?? "";
    displayName = initial ? `${first} ${initial}.` : first;
    displayContext = `${profile.profession} · ${profile.city}`;
  } else {
    // Employer path: name + org.
    const [member] = await db
      .select({ orgName: schema.organizations.name })
      .from(schema.organizationMembers)
      .innerJoin(
        schema.organizations,
        eq(schema.organizations.id, schema.organizationMembers.organizationId),
      )
      .where(eq(schema.organizationMembers.userId, session.id))
      .limit(1);
    if (member) {
      authorRole = "employer";
      displayContext = member.orgName;
    }
  }

  const id = `tst_${randomUUID()}`;
  await db.insert(schema.testimonials).values({
    id,
    userId: session.id,
    authorRole,
    quote: clean,
    displayName,
    displayContext,
    consentDisplay: true,
    state: "pending",
  });

  // Never prompt this user again.
  await db
    .insert(schema.testimonialPromptState)
    .values({ userId: session.id, submittedAt: new Date() })
    .onConflictDoUpdate({
      target: schema.testimonialPromptState.userId,
      set: { submittedAt: new Date() },
    });

  await logAccess({
    kind: "testimonial.submit",
    actor: session.id,
    subject: id,
    meta: { authorRole, consentDisplay: true },
  });

  revalidatePath("/dashboard");
  revalidatePath("/employer");
  return { ok: true };
}

export async function snoozeTestimonialPrompt(): Promise<void> {
  const session = await getSessionUser();
  if (!session) return;
  const db = getDb();
  const until = new Date(Date.now() + SNOOZE_DAYS * 86_400_000);
  await db
    .insert(schema.testimonialPromptState)
    .values({ userId: session.id, snoozedUntil: until })
    .onConflictDoUpdate({
      target: schema.testimonialPromptState.userId,
      set: { snoozedUntil: until },
    });
  revalidatePath("/dashboard");
  revalidatePath("/employer");
}
