/**
 * 2026-08-19  reads for "Work & projects". Kept out of the `"use server"`
 * action module so these never become public HTTP endpoints.
 *
 * Signed URLs: one thumb (256px WebP, ~15KB  what the grid renders) and
 * one full-size link per image. On S3 presigning is local HMAC, so the
 * per-image cost is negligible; the caps (6 projects × 5 images) bound
 * it either way.
 */

import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { signedPhotoUrl } from "@/lib/storage/signed";
import { linkHostname } from "./project-links";

export interface ProjectImageView {
  key: string;
  thumbUrl: string | null;
  fullUrl: string | null;
}

export interface ProjectView {
  id: string;
  title: string;
  url: string | null;
  hostname: string | null;
  contribution: string;
  year: number | null;
  images: ProjectImageView[];
}

export async function listProjectsForProfile(
  profileId: string,
): Promise<ProjectView[]> {
  const rows = await getDb()
    .select()
    .from(schema.profileProjects)
    .where(eq(schema.profileProjects.profileId, profileId))
    .orderBy(asc(schema.profileProjects.sortOrder), asc(schema.profileProjects.createdAt))
    .limit(6);

  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      title: r.title,
      url: r.url,
      hostname: r.url ? linkHostname(r.url) : null,
      contribution: r.contribution,
      year: r.year,
      images: await Promise.all(
        r.imageKeys.slice(0, 5).map(async (key) => ({
          key,
          thumbUrl: await signedPhotoUrl(key, { width: 256 }),
          fullUrl: await signedPhotoUrl(key),
        })),
      ),
    })),
  );
}

/** Same view, resolved from a public handle (public profile / dossier). */
export async function listProjectsForHandle(
  handle: string,
): Promise<ProjectView[]> {
  const rows = await getDb()
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(eq(schema.profiles.handle, handle))
    .limit(1);
  const profileId = rows[0]?.id;
  if (!profileId) return [];
  return listProjectsForProfile(profileId);
}
