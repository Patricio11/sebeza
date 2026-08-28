/**
 * Pure parser + schema for AI-drafted role blueprints. No server-only
 * imports so the admin page, the tests and one-off probes can use it; the
 * provider call lives in lib/llm/blueprint-drafts.ts.
 */

import { z } from "zod";

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const slug = z.string().regex(slugRe).max(60);

export const blueprintDraftSchema = z.object({
  core: z.array(slug).min(1).max(8),
  expected: z.array(slug).max(8).default([]),
  tracks: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(40),
        skills: z.array(slug).min(1).max(8),
      }),
    )
    .max(5)
    .default([]),
  proveIt: z.record(z.string(), z.string().trim().max(240)).optional(),
  newSkills: z
    .array(
      z.object({
        slug,
        label: z.string().trim().min(2).max(40),
        category: z.enum(["technical", "professional"]),
      }),
    )
    .max(6)
    .default([]),
});

export interface BlueprintDraftPayload {
  core: string[];
  expected: string[];
  tracks: Array<{ name: string; skills: string[] }>;
  proveIt: Record<string, string>;
  newSkills: Array<{
    slug: string;
    label: string;
    category: "technical" | "professional";
  }>;
}

/**
 * Pure: model text -> clean payload. Drops slugs the taxonomy does not have
 * (unless the draft itself introduces them), dedupes across tiers (core
 * wins, then expected, then tracks), caps sizes, and refuses a draft whose
 * core is thinner than three skills. Never throws.
 */
export function parseBlueprintDraft(
  text: string,
  knownSlugs: ReadonlySet<string>,
):
  { ok: true; payload: BlueprintDraftPayload } | { ok: false; reason: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(
      text
        .replace(/^\s*```(?:json)?/m, "")
        .replace(/```\s*$/m, "")
        .trim(),
    );
  } catch {
    return {
      ok: false,
      reason: "The model reply wasn't valid JSON, try again.",
    };
  }
  const parsed = blueprintDraftSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, reason: "The model reply had the wrong shape." };
  const d = parsed.data;
  const newSkills = d.newSkills.filter((s) => !knownSlugs.has(s.slug));
  const allowed = new Set([...knownSlugs, ...newSkills.map((s) => s.slug)]);
  const seen = new Set<string>();
  const take = (list: string[], max: number) => {
    const out: string[] = [];
    for (const s of list) {
      if (!allowed.has(s) || seen.has(s)) continue;
      seen.add(s);
      out.push(s);
      if (out.length >= max) break;
    }
    return out;
  };
  const core = take(d.core, 5);
  if (core.length < 3) {
    return {
      ok: false,
      reason: "The draft named fewer than three core skills we recognise.",
    };
  }
  const expected = take(d.expected, 4);
  const tracks = d.tracks
    .map((t) => ({ name: t.name, skills: take(t.skills, 5) }))
    .filter((t) => t.skills.length >= 2)
    .slice(0, 4);
  const used = new Set([
    ...core,
    ...expected,
    ...tracks.flatMap((t) => t.skills),
  ]);
  const proveIt: Record<string, string> = {};
  for (const [k, v] of Object.entries(d.proveIt ?? {})) {
    if (used.has(k) && v.trim().length > 0) proveIt[k] = v.trim();
  }
  return {
    ok: true,
    payload: {
      core,
      expected,
      tracks,
      proveIt,
      newSkills: newSkills.filter((s) => used.has(s.slug)),
    },
  };
}
