/**
 * Phase 24 ("Testimonials")  read paths + eligibility. The collection moment
 * is a small dismissible dashboard card (never a page, never a blocking modal):
 * shown only while the admin-run campaign is ON, to users who have neither
 * submitted (ever) nor dismissed (last 30 days). Only `approved` rows render
 * publicly, with display fields captured at submission under explicit consent.
 */

import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { getSetting } from "@/lib/admin/settings";

export interface PublicTestimonial {
  id: string;
  quote: string;
  displayName: string;
  displayContext: string;
  authorRole: string;
}

export interface AdminTestimonial extends PublicTestimonial {
  state: string;
  consentDisplay: boolean;
  sortOrder: number;
  createdAt: Date;
  userId: string | null;
}

/** Approved testimonials for the landing rail (hidden when empty). */
export async function listApprovedTestimonials(): Promise<PublicTestimonial[]> {
  const db = getDb();
  return db
    .select({
      id: schema.testimonials.id,
      quote: schema.testimonials.quote,
      displayName: schema.testimonials.displayName,
      displayContext: schema.testimonials.displayContext,
      authorRole: schema.testimonials.authorRole,
    })
    .from(schema.testimonials)
    .where(
      and(
        eq(schema.testimonials.state, "approved"),
        eq(schema.testimonials.consentDisplay, true),
      ),
    )
    .orderBy(asc(schema.testimonials.sortOrder), asc(schema.testimonials.createdAt))
    .limit(6);
}

/** Everything, for /admin/testimonials. */
export async function listAllTestimonials(): Promise<AdminTestimonial[]> {
  const db = getDb();
  return db
    .select({
      id: schema.testimonials.id,
      quote: schema.testimonials.quote,
      displayName: schema.testimonials.displayName,
      displayContext: schema.testimonials.displayContext,
      authorRole: schema.testimonials.authorRole,
      state: schema.testimonials.state,
      consentDisplay: schema.testimonials.consentDisplay,
      sortOrder: schema.testimonials.sortOrder,
      createdAt: schema.testimonials.createdAt,
      userId: schema.testimonials.userId,
    })
    .from(schema.testimonials)
    .orderBy(asc(schema.testimonials.sortOrder), asc(schema.testimonials.createdAt));
}

/**
 * Should this signed-in user see the collection card right now?
 * Campaign ON + never submitted + not currently snoozed.
 */
export async function shouldPromptForTestimonial(
  userId: string,
): Promise<boolean> {
  const campaignOn = await getSetting<boolean>("testimonial_campaign_active");
  if (!campaignOn) return false;
  const db = getDb();
  const [state] = await db
    .select()
    .from(schema.testimonialPromptState)
    .where(eq(schema.testimonialPromptState.userId, userId))
    .limit(1);
  if (!state) return true;
  if (state.submittedAt) return false;
  if (state.snoozedUntil && state.snoozedUntil.getTime() > Date.now()) {
    return false;
  }
  return true;
}
