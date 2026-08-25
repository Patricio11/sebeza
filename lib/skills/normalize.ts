/**
 * Skill-name normalization (docs/SKILLS_CATEGORIES_MATCHING_PLAN.md).
 *
 * "nextjs", "Next.js" and "NEXT JS" are the same skill; a seeker who
 * typed "Node.js & Express.js" holds the canonical "Node.js". This
 * module makes that true everywhere the platform compares skill
 * names: the picker's typeahead, the save-time canonicalisation, the
 * search-text expansion, and the vacancy match.
 *
 * Pure code, no table: variants derive from the canonical labels
 * (normalize + compound splits) plus a small curated alias map. The
 * taxonomy stays the single source of truth; admins add real skills
 * exactly as before.
 */

/** Lowercase and strip everything that isn't a letter or digit:
 *  "Node.js" -> "nodejs", "PSIRA Grade A" -> "psiragradea". */
export function normalizeSkillText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/**
 * Curated aliases per canonical slug. Only TRUE equivalents belong
 * here (postgresql IS postgres); related-but-different skills (mysql
 * vs sql) never do. Keys are canonical slugs; values are raw alias
 * strings, normalised at build time.
 */
const CURATED_ALIASES: Record<string, string[]> = {
  node: ["nodejs", "node js", "node.js", "express", "expressjs", "express.js"],
  react: ["reactjs", "react.js", "react js"],
  typescript: ["ts"],
  postgres: ["postgresql", "psql", "postgre sql"],
  python: ["python3", "python 3"],
  aws: ["amazon web services"],
  excel: ["ms excel", "microsoft excel", "spreadsheets"],
  word: ["ms word", "microsoft word"],
  sql: ["structured query language"],
  figma: ["figma design"],
  "pos-systems": ["point of sale", "pos"],
  "first-aid": ["first aider", "level 1 first aid"],
  "food-safety": ["haccp", "food hygiene"],
  "customer-service": ["client service", "customer care"],
  "bookkeeping-skill": ["bookkeeper", "books"],
};

/**
 * Derived variants for one label: the whole label normalised, plus
 * each compound part when the label joins several names with
 * & / , / "and" / "+" ("Node.js & Express.js" -> nodejsexpressjs,
 * nodejs, expressjs). Single-word parts shorter than 3 normalised
 * chars are skipped ("A", "of") so splits never produce noise.
 */
export function labelVariants(label: string): string[] {
  const out = new Set<string>();
  const whole = normalizeSkillText(label);
  if (whole.length >= 2) out.add(whole);
  const parts = label.split(/\s*(?:&|\/|,|\+|\band\b)\s*/i);
  if (parts.length > 1) {
    for (const part of parts) {
      const n = normalizeSkillText(part);
      if (n.length >= 3) out.add(n);
    }
  }
  return Array.from(out);
}

export interface SkillLike {
  slug: string;
  label: string;
}

/**
 * Build a matcher over the live taxonomy: normalised variant ->
 * canonical slugs. One variant can map to several canonicals in a
 * dirty taxonomy; the consumers treat all of them as matches.
 */
export function buildSkillMatcher(skills: SkillLike[]): SkillMatcher {
  const bySlug = new Map(skills.map((s) => [s.slug, s]));
  const variantToSlugs = new Map<string, Set<string>>();
  const add = (variant: string, slug: string) => {
    if (!variant) return;
    const set = variantToSlugs.get(variant) ?? new Set<string>();
    set.add(slug);
    variantToSlugs.set(variant, set);
  };

  for (const s of skills) {
    add(normalizeSkillText(s.slug), s.slug);
    for (const v of labelVariants(s.label)) add(v, s.slug);
  }
  for (const [slug, aliases] of Object.entries(CURATED_ALIASES)) {
    if (!bySlug.has(slug)) continue; // alias for a skill this DB doesn't have
    for (const a of aliases) add(normalizeSkillText(a), slug);
  }

  return new SkillMatcher(variantToSlugs, bySlug);
}

export class SkillMatcher {
  constructor(
    private readonly variantToSlugs: Map<string, Set<string>>,
    private readonly bySlug: Map<string, SkillLike>,
  ) {}

  /** Canonical slugs a free-typed skill name resolves to. A compound
   *  entry resolves to every canonical part it contains. */
  matchText(text: string): string[] {
    const out = new Set<string>();
    for (const v of labelVariants(text)) {
      for (const slug of this.variantToSlugs.get(v) ?? []) out.add(slug);
    }
    return Array.from(out);
  }

  /** Expand a set of canonical slugs to include canonicals that share
   *  a variant (bridges near-duplicate taxonomy entries). Always
   *  includes the inputs. */
  expandSlugs(slugs: string[]): string[] {
    const out = new Set<string>(slugs);
    for (const slug of slugs) {
      const skill = this.bySlug.get(slug);
      if (!skill) continue;
      for (const v of [normalizeSkillText(slug), ...labelVariants(skill.label)]) {
        for (const other of this.variantToSlugs.get(v) ?? []) out.add(other);
      }
    }
    return Array.from(out);
  }

  /**
   * Expand free search text with canonical labels it aliases:
   * "nextjs developer" gains "or Next.js" when the taxonomy knows
   * nextjs. Appended with websearch OR syntax so the original terms
   * keep working exactly as typed; no match = text returned as-is.
   */
  expandQueryText(q: string): string {
    const tokens = q.split(/\s+/).filter(Boolean);
    const extraLabels = new Set<string>();
    // Single tokens plus adjacent bigrams ("node js", "first aid").
    const candidates: string[] = [...tokens];
    for (let i = 0; i < tokens.length - 1; i++) {
      candidates.push(`${tokens[i]} ${tokens[i + 1]}`);
    }
    for (const c of candidates) {
      const n = normalizeSkillText(c);
      if (n.length < 2) continue;
      for (const slug of this.variantToSlugs.get(n) ?? []) {
        const label = this.bySlug.get(slug)?.label;
        // Skip when the label already appears verbatim in the query.
        if (label && !q.toLowerCase().includes(label.toLowerCase())) {
          extraLabels.add(label);
        }
      }
    }
    if (extraLabels.size === 0) return q;
    return [q, ...extraLabels].join(" or ");
  }

  /** Typeahead helper: does this option match the typed text under
   *  normalization? ("nodejs" typed -> "Node.js" option). */
  static optionMatches(optionLabel: string, typed: string): boolean {
    const t = normalizeSkillText(typed);
    if (t.length < 2) return false;
    return labelVariants(optionLabel).some((v) => v.includes(t));
  }
}
