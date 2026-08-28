/**
 * Stable fingerprint of a skills list, so the editor can tell "what is on
 * screen" from "what the database last accepted" and autosave only the
 * difference. Order-insensitive (the picker may reorder), label-insensitive
 * (labels are display-only; the action layer ignores them).
 */
/** Hard cap on canonical + typed skills per profile; the picker, the action
 *  and the tests read this one value. */
export const MAX_PROFILE_SKILLS = 30;

export interface SkillDraftItem {
  slug: string;
  proficiency: number;
  yearsOfExperience: number | null;
}

export function serialiseSkills(items: readonly SkillDraftItem[]): string {
  return JSON.stringify(
    [...items]
      .map((i) => ({
        slug: i.slug,
        proficiency: i.proficiency,
        yearsOfExperience: i.yearsOfExperience ?? null,
      }))
      .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0)),
  );
}

export function skillsDirty(
  onScreen: readonly SkillDraftItem[],
  lastSaved: string,
): boolean {
  return serialiseSkills(onScreen) !== lastSaved;
}
