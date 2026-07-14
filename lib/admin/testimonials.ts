"use server";

/**
 * Phase 24  admin curation of testimonials: campaign on/off, approve / hide,
 * create manually, delete. Admin-gated + audited. Approving requires the
 * consent bit (a user row always has it; an admin-created row asserts it
 * explicitly since the admin owns that copy).
 */

import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { verifyAdmin } from "@/lib/auth/dal";
import { logAccess } from "@/lib/audit";
import { updateSetting } from "@/lib/admin/settings-actions";

export type AdminTestimonialResult =
  | { ok: true }
  | { ok: false; error: string };

function revalidate() {
  revalidatePath("/admin/testimonials");
  // The landing rail lives under /[locale]  layout-scoped revalidation
  // invalidates every locale's landing in one call.
  revalidatePath("/", "layout");
}

export async function setTestimonialCampaign(
  on: boolean,
): Promise<AdminTestimonialResult> {
  const res = await updateSetting({
    key: "testimonial_campaign_active",
    value: on,
  });
  if (!res.ok) return { ok: false, error: res.message };
  revalidate();
  revalidatePath("/dashboard");
  revalidatePath("/employer");
  return { ok: true };
}

export async function setTestimonialState(
  id: string,
  state: "approved" | "hidden" | "pending",
): Promise<AdminTestimonialResult> {
  const admin = await verifyAdmin();
  const db = getDb();
  await db
    .update(schema.testimonials)
    .set({ state })
    .where(eq(schema.testimonials.id, id));
  await logAccess({
    kind: "admin.testimonial.edit",
    actor: admin.id,
    subject: id,
    meta: { action: state === "approved" ? "approve" : state === "hidden" ? "hide" : "unqueue" },
  });
  revalidate();
  return { ok: true };
}

const createSchema = z.object({
  quote: z.string().trim().min(20).max(280),
  displayName: z.string().trim().min(2).max(60),
  displayContext: z.string().trim().min(2).max(80),
});

export async function createTestimonial(
  input: z.input<typeof createSchema>,
): Promise<AdminTestimonialResult> {
  const admin = await verifyAdmin();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid testimonial." };
  const db = getDb();

  const [agg] = await db
    .select({ max: sql<number>`COALESCE(MAX(sort_order), 0)::int` })
    .from(schema.testimonials);
  const id = `tst_${randomUUID()}`;
  await db.insert(schema.testimonials).values({
    id,
    userId: null,
    authorRole: "admin",
    quote: parsed.data.quote,
    displayName: parsed.data.displayName,
    displayContext: parsed.data.displayContext,
    consentDisplay: true, // admin-authored copy  the admin owns it
    state: "approved",
    sortOrder: (agg?.max ?? 0) + 1,
  });
  await logAccess({
    kind: "admin.testimonial.edit",
    actor: admin.id,
    subject: id,
    meta: { action: "create" },
  });
  revalidate();
  return { ok: true };
}

export async function deleteTestimonial(
  id: string,
): Promise<AdminTestimonialResult> {
  const admin = await verifyAdmin();
  const db = getDb();
  await db.delete(schema.testimonials).where(eq(schema.testimonials.id, id));
  await logAccess({
    kind: "admin.testimonial.edit",
    actor: admin.id,
    subject: id,
    meta: { action: "delete" },
  });
  revalidate();
  return { ok: true };
}
