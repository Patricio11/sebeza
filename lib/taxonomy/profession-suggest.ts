import "server-only";

/**
 * One place that turns typed profession parts into admin-queue rows.
 * Used by sign-up (no session yet, so it cannot go through the
 * `submitTaxonomySuggestion` Server Action) and by the profile editor.
 *
 * Per part: skip when already canonical (DB label match, so promoted
 * professions count), skip when this user already has a pending row
 * with the same text (autosave re-submits), otherwise insert + audit +
 * notify admins. Failures are logged and swallowed by the callers: the
 * profile write is the primary act, the suggestion is auxiliary.
 */

import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { logAccess } from "@/lib/audit";
import { notifyAllAdmins } from "@/lib/notifications/server";

type Db = ReturnType<typeof getDb>;

export async function recordProfessionSuggestions(opts: {
  db: Db;
  userId: string;
  parts: readonly string[];
  via: "signup" | "profile-editor" | "admin-split";
}): Promise<string[]> {
  const { db, userId, via } = opts;
  const ids: string[] = [];
  for (const raw of opts.parts) {
    const text = raw.trim().replace(/\s+/g, " ");
    if (text.length < 2) continue;

    const canonical = await db
      .select({ slug: schema.professions.slug })
      .from(schema.professions)
      .where(sql`lower(${schema.professions.label}) = lower(${text})`)
      .limit(1);
    if (canonical[0]) continue;

    const dupe = await db
      .select({ id: schema.taxonomySuggestions.id })
      .from(schema.taxonomySuggestions)
      .where(
        and(
          eq(schema.taxonomySuggestions.submittedByUserId, userId),
          eq(schema.taxonomySuggestions.kind, "profession"),
          eq(schema.taxonomySuggestions.state, "pending"),
          sql`lower(${schema.taxonomySuggestions.customText}) = lower(${text})`,
        ),
      )
      .limit(1);
    if (dupe[0]) {
      ids.push(dupe[0].id);
      continue;
    }

    const suggestionId = `tx_${randomUUID()}`;
    await db.insert(schema.taxonomySuggestions).values({
      id: suggestionId,
      kind: "profession",
      customText: text,
      submittedByUserId: userId,
    });
    await logAccess({
      kind: "taxonomy.suggestion.submit",
      actor: userId,
      subject: suggestionId,
      meta: { kind: "profession", customText: text, via },
    });
    await notifyAllAdmins({
      kind: "taxonomy.suggestion.received",
      title: `New profession suggestion: ${text}`,
      body:
        via === "signup"
          ? `A new user picked "Other" + entered "${text}". Review on /admin/taxonomy.`
          : via === "profile-editor"
            ? `A seeker picked "Other" on their profile + entered "${text}". Review at /admin/taxonomy.`
            : `Split from a joined suggestion: "${text}". Review at /admin/taxonomy.`,
      link: "/admin/taxonomy",
      dedupeKey: `profession::${text.toLowerCase()}`,
      meta: { suggestionId, kind: "profession", customText: text },
    });
    ids.push(suggestionId);
  }
  return ids;
}
