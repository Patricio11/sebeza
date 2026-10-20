# Profession pipe split: "A | B" is two professions

Founder, 2026-10-20, from the admin queue: a seeker typed
"AI Automation & Systems Specialist | Supply Chain & Admin Solutions Architect" as their
profession. The pipe means "and also": part one is the primary profession, the rest are
secondary professions. Until now the joined string was stored as the headline and reached
the queue as ONE suggestion, so promoting it would have canonicalised the whole string.

```
typed       ▶ "A | B"  or  "A / B" (slash WITH spaces; "UX/UI Designer" stays whole)
stored      ▶ profession = A, secondary_professions += [B]   (cap 3)
queue       ▶ one pending row per part that is not canonical yet
promote     ▶ rewrites the headline AND the secondary arrays that carry the text
backlog     ▶ "Split" on any pending profession row that holds a separator
```

## Decisions

- **Secondaries may be free text until approved** (founder approval 2026-10-20). This
  relaxes Phase 13.10 D3 (canonical-only secondaries). The trade: between typing and
  approval a secondary matches no employer search, which is exactly the primary's state
  today. The alternative was dropping the second half on the floor.
- **Canonical check is DB-backed** (`professions` table), so a promoted profession typed
  again is recognised and raises no new suggestion. The profile editor used the frozen
  constant before; that was a latent bug.
- **One recording path** (`lib/taxonomy/profession-suggest.ts`) for sign-up, the profile
  editor and the admin split: canonical parts skipped, pending dupes per user skipped,
  audit + admin notification per new row.
- **Split resolves the joined rows as `merged`** with an admin note naming the parts. No
  new enum value, no migration.

## TASKS

- [x] `lib/taxonomy/profession-split.ts`: pure splitter (`|` and ` / `), canonical mapping, dedupe, cap; `mergeSecondaryProfessions`; unit tests
- [x] `lib/taxonomy/profession-suggest.ts`: `recordProfessionSuggestions` (sign-up, editor, split)
- [x] Sign-up: split the typed profession; primary + secondaries on the new profile; one suggestion per custom part
- [x] Profile editor action: split on save, merge with the picker's secondaries, return the split so the form mirrors it; canonical-only refine removed
- [x] Profile editor form: "Other" on secondaries adds the label to the profile at once; save response applied to state
- [x] Promote + merge: `backfillSecondaryProfessions` rewrites the text inside secondary arrays (and never duplicates the headline)
- [x] `splitTaxonomySuggestion` admin action + audit kind `taxonomy.suggestion.split`
- [x] /admin/taxonomy: Split button with a preview of the parts on rows that hold a separator

## VERIFY

- [x] Unit: splitter cases (pipe, spaced slash, bare slash kept, canonical slash label kept, dedupe, cap)
- [x] Integration: editor save with "A | B" → headline A, secondary B, two pending rows; promote B with a corrected label → secondary array rewritten; Split on a joined row → profile fixed, per-part rows, joined row merged
- [x] Full suite + build green (653 tests, 82 files)
- [x] Harness (screenshots ps01-ps04 in test-results/): /admin/taxonomy/suggestions shows Split on the joined row, confirm → two rows; seeker's profile editor shows primary + secondary
