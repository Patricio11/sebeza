# PLAN - CLOSE THE SUGGESTION APPROVAL LOOP (backfill + notify)

*Founder request (2026-08-13): "when you suggest and it gets approved it should be added to your
profile, computed and notified." Approved after the skills gap report; then sweep the rest of the
system for the same gap.*

## The gap map (verified in code before this plan)

| Suggestion flow | Backfill to suggester today | Notify suggester today |
|---|---|---|
| Profession promote / merge | YES (label match updates profiles) | NO |
| Organisation promote / merge | YES (FK already points; dupes re-pointed) | NO |
| Institution promote / merge | YES (FK already points; dupes re-pointed) | NO |
| **Skill promote** | **NO** (documented "user must re-add") | NO |
| **Skill merge** | **NO** | NO |
| Custom-skill canonicalize (Phase 19) | YES (all holders migrated, proficiency kept) | NO |

So: skills are the only flow where the approved thing never reaches the suggester's profile, and
NO flow tells the suggester their contribution was accepted.

## TASKS

- [x] New notification kind `taxonomy.suggestion.approved` (audience `self`, in-app ON, email
  OFF, no dedupe) in the catalog; per-kind copy composed at the call site.
- [x] New plain module `lib/profile/completeness-internal.ts`:
  `refreshProfileCompleteness(db, profileId)` reusing the shared `computeCompleteness` engine
  (live counts, same formula as the profile editor); usable from any server path.
- [x] `promoteTaxonomySuggestion`, skill branch: after inserting the canonical skill, ALSO
  resolve every other PENDING skill suggestion with the same text (state `merged`, audit-crisp
  admin note, house dupe pattern from orgs/institutions); for the promoted row's submitter AND
  each dupe's submitter: add the skill to their live profile (skip if already present; default
  proficiency, self-attested provenance), refresh completeness, notify. Employer submitters
  (no profile) just get the "now available" notification.
- [x] `mergeTaxonomySuggestion`, skill branch: same backfill + notify with the TARGET canonical
  slug for the row's submitter.
- [x] Profession / organisation / institution promote + merge: notify the submitter (backfill
  already existed); copy per kind, honest about what happened.
- [x] `canonicalizeCustomSkill`: refresh completeness for every migrated holder + notify each
  ("your self-described skill is now official and searchable").
- [x] Integration test: skill suggestion → promote → suggester's profile HAS the skill,
  completeness recomputed, notification row exists; dupe suggestion auto-resolved + backfilled.

## VERIFY

- [x] Integration suite green on the Docker harness (including the existing profession
  promote/reject pins, untouched).
- [x] typecheck + lint + unit green.
- [x] No behaviour change for rejection (stays quiet by design; a rejection notification would
  discourage contribution and the founder didn't ask for it).
