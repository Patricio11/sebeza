# Skills: categories, smart matching, and the skills-first rule

Founder request, 2026-08-24. Three asks plus what the audit found:

```
categories ──▶ skills.category: technical | professional
               grouped editor + profile + dossier; admin can recategorise

smart match ─▶ lib/skills/normalize.ts: "nextjs" == "Next.js",
               "Node.js & Express.js" ∋ "node". Used at ENTRY (picker
               finds it, save auto-canonicalises) and at QUERY (search
               text + vacancy match expand through aliases)

skills-first ▶ ORDERING UNCHANGED (founder, mid-build): citizens,
               primary profession, score, completeness stays exactly
               as is. Smart matching feeds the existing score (every
               vacancy skill now actually reaches the query), and the
               match page shows an informational "covers N of M
               skills" chip per candidate
```

## What the audit found (fixed here)

- **BUG: matcher uses MOCK_SKILLS.** `vacancyToSearchFilters` resolved
  vacancy skillSlugs to labels via the frozen mock constant; every
  admin-promoted skill resolved to undefined and silently dropped out
  of the match query. Now resolves via the live taxonomy.
- **Ranking stays as designed** (founder call): ts_rank_cd density
  already rewards covering more of the vacancy's skills; the real
  problem was that promoted skills never REACHED the query (mock
  resolution bug) and aliases didn't match. Both fixed; ORDER BY
  untouched. The match page surfaces "covers N of M skills" as
  information.
- **Silent drops on save.** A seeker typing "Node.js & Express.js"
  saw a card, then the save silently shunted it to the admin queue.
  Now: if a typed skill normalises onto canonical skills it attaches
  to them (seeker told "saved as Node.js"); only genuinely-new skills
  go to the queue, and the seeker is told that too.

## Design decisions

- **Category lives on the taxonomy row** (text: technical |
  professional, default technical). Seeded backfill: organisational /
  people / care / compliance skills are professional; tools, trades
  and licences are technical. Admin recategorises on /admin/taxonomy;
  new skills pick a category at add + promote time.
- **Normalization is pure code, no new table.** `lib/skills/normalize`
  lowercases, strips non-alphanumerics, splits compound labels on
  & / , / "and", plus a small curated alias map per canonical slug
  (node: nodejs, node.js, express...; postgres: postgresql; react:
  reactjs; typescript: ts...). Deterministic, unit-tested, admin adds
  real skills as before.
- **Custom skills stay unsearchable** (the existing honesty rule).
  The bridge happens at entry time: the picker's typeahead now ranks
  by normalized match ("nodejs" surfaces "Node.js"), and the save
  auto-attaches normalize-matched canonicals, so customs stop being
  created for skills we already have.
- **Matched count is information, not ordering.** `filters.skillSlugs`
  (expanded through aliases) adds `matched_skill_count` to the SELECT
  for the match page chip; ORDER BY is untouched on every surface.

## TASKS

- [x] Migration 0076: skills.category + backfill; schema; test DB + seed carries categories (harness re-seeds!)
- [x] lib/skills/normalize.ts + unit tests (variants, compound splits, curated aliases)
- [x] getSkills carries category; admin taxonomy add/update set category (UI select + listing chip); promoted skills default technical, recategorisable
- [x] SkillsEditor: Technical / Professional / Awaiting-review sections + normalized picker ranking (both combobox components); profile page passes categories
- [x] updateSkills: auto-canonicalise typed entries via normalize; queue only genuinely-new skills
- [x] Public profile + employer dossier: skills grouped by category (single-kind profiles stay flat)
- [x] searchProfilesQuery: alias-expanded free text (direct taxonomy read, cache-safe) + skillSlugs -> matched_skill_count SELECT-only (ordering untouched)
- [x] vacancyToSearchFilters: live taxonomy (bug fix) + expanded skillSlugs; match page professionLabel also live
- [x] Match page: "Skills N/M" chip per candidate (full coverage highlighted)
- [x] i18n en/zu/xh/af (skillsGroups.*, match.skillCoverage)
- [x] Tests: 16 normalize unit + 4 integration (alias search, matched count, auto-canonicalise); 15 legacy suites' next/cache mocks made partial (unstable_cache)

## VERIFY

- [x] Full suite + build green (581 tests, 65 files)
- [x] Harness screenshots sk01-sk04 in test-results/ (typeahead nodejs->Node.js, grouped editor, grouped public profile, Skills 2/2 chip)
- [x] Migration applied to Neon (21 professional / 37 technical)
