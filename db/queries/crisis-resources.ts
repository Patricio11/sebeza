/**
 * Phase 22.2 ("AI Coach  crisis pathway")  read path for admin-editable crisis
 * resources. `listActiveCrisisResources` feeds the seeker distress surface;
 * `listAllCrisisResources` feeds the admin manager. Not PII  public support info.
 */

import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";

export interface CrisisResource {
  id: string;
  name: string;
  contact: string;
  availability: string | null;
  note: string | null;
}

export interface AdminCrisisResource extends CrisisResource {
  active: boolean;
  sortOrder: number;
}

/** Active resources shown to a seeker in the distress pathway. */
export async function listActiveCrisisResources(): Promise<CrisisResource[]> {
  const db = getDb();
  return db
    .select({
      id: schema.crisisResources.id,
      name: schema.crisisResources.name,
      contact: schema.crisisResources.contact,
      availability: schema.crisisResources.availability,
      note: schema.crisisResources.note,
    })
    .from(schema.crisisResources)
    .where(eq(schema.crisisResources.active, true))
    .orderBy(
      asc(schema.crisisResources.sortOrder),
      asc(schema.crisisResources.name),
    );
}

/** Every resource (incl. inactive) for the admin surface. */
export async function listAllCrisisResources(): Promise<AdminCrisisResource[]> {
  const db = getDb();
  return db
    .select({
      id: schema.crisisResources.id,
      name: schema.crisisResources.name,
      contact: schema.crisisResources.contact,
      availability: schema.crisisResources.availability,
      note: schema.crisisResources.note,
      active: schema.crisisResources.active,
      sortOrder: schema.crisisResources.sortOrder,
    })
    .from(schema.crisisResources)
    .orderBy(
      asc(schema.crisisResources.sortOrder),
      asc(schema.crisisResources.name),
    );
}
