# Role blueprints: the Compass learns what a role looks like

Founder, 2026-08-28: a 93%-complete Software Developer profile read "Learn 0 skills →
stay #1 of 3" and "No gaps to close", while it had no DevOps skill at all. Principle
agreed with the founder (and his other advisor): **the database calculates facts, a
skills engine determines relationships, real employer data measures demand, the AI
only explains**. This plan adds the missing middle: the skills engine.

```
sources today   ▶ employer search demand (search_events x taxonomy)
                  peers ranked above you in your pool
                  -> silent for a good profile in a small pool

blueprint       ▶ profession x skill x tier (core / expected / next_level)
                  next_level grouped into named TRACKS ("DevOps & Cloud")
                  one-line "prove it with" idea per skill, written once

gap engine      ▶ blueprint minus profile (canonical skills, alias-matched
                  at save time), ranked core > expected > next_level by
                  local demand, each with an evidence sentence

page            ▶ headline that says "core covered, next level: ..."
                  a route map (three stations, tracks you can start)
                  recommendation cards with role chips

AI              ▶ Coach's read explains THESE facts (cached, no free text);
                  nothing is generated per page view
```

## Decisions

- **Starter catalogue is a curated constant** (`lib/blueprints/catalogue.ts`), same standing
  as the taxonomy constants: seed source + empty-profession fallback. Covers every profession
  in the taxonomy (105). No LLM at runtime; no per-profession draft cost.
- **Live table `profession_skill_blueprints`** (migration 0080) is what seekers read once the
  admin clicks "Import starter catalogue" on /admin/blueprints; admin edits win over later
  imports (`source = 'admin'`).
- **139 skills added** to the taxonomy (migration 0080 + the SKILLS constant + categories) so
  the blueprints are expressible: Git, Docker, CI/CD, REST APIs, testing, site safety,
  patient care, lease administration, wine knowledge, and so on. A unit test keeps the
  constant, the catalogue and the migration in lockstep.
- **Ships dark** behind `feature_flag_role_blueprints` (Launch tab). The admin page works
  regardless so the founder can review before flipping.
- **Ranking contract untouched**: blueprints feed the Compass recommendations only; search
  ordering and rank pools are not involved.
- **Performance**: two indexed queries per Compass load (blueprint rows by profession, owned
  skill slugs by handle); labels come from the same skills read the page already does.
  Nothing new on public routes.

## TASKS

- [x] Catalogue (105 professions, 3 tiers, tracks, prove-it lines) + NEW_SKILLS + integrity tests
- [x] Gap engine (pure) + tests
- [x] Migration 0080 (table + new skills) + schema + journal + seed loads the catalogue
- [x] Compass: blueprint gaps merged into recommendations with role reasons; route map data on the snapshot
- [x] /dashboard/grow: honest headline variants (core covered / next level), role reason chips, prove-it line, RouteMap section with Start-this-route
- [x] /admin/blueprints: coverage list, per-profession rows, import, edit tier/track/prove-it, remove; nav + smoke route
- [x] Flag feature_flag_role_blueprints (settings union, defaults, validator, form row)
- [x] i18n en + zu/xh/af drafts for every new seeker string
- [x] Integration tests: compass with flag on for a seeker whose core is covered; import + edit actions

## Part 2: any profession, AI drafts (founder, 2026-08-28)

Hand-authored blueprints cover the 105 professions the taxonomy shipped with. New
professions arrive through the suggestion queue; nobody will hand-write those. So the
admin can now **draft with AI**: one lean call per profession (slugs only in, one small
JSON out, capped by the shared transport), gated by the curriculum drafting switch and the
provider budget like the learning-path drafts. The draft is a review card (untick rows,
new skills listed); **Approve** replaces the profession's rows (source `ai`) and adds the
draft's new skills to the taxonomy; **Reject** leaves everything as it was. "Draft the
next N professions with no blueprint" batches the backlog, stops on the first provider
failure. Nothing reaches a seeker without Approve.

- [x] lib/llm/blueprint-drafts.ts: pure parser (drops unknown slugs, dedupes tiers, min 3 core) + draftBlueprint (gated, budgeted, audited) + unit tests
- [x] blueprint_drafts table (0081) + schema
- [x] Admin actions: requestBlueprintDraft, draftMissingBlueprints (cap 10, stops on provider failure), approveBlueprintDraft (drop list, new skills, replace rows), rejectBlueprintDraft; audit kinds
- [x] BlueprintDraftPanel on /admin/blueprints: draft / redraft the selected profession, batch the missing ones, review card with untick, approve / reject
- [x] Integration test: approve writes reviewed rows + new skill + replaces old rows; double approve refused; reject only flips state
- [x] Live probe with the founder's key (gpt-5.4-mini): the app's OpenAI requests were 400 (max_tokens / temperature rejected by that family). `lib/llm/openai-tuning.ts` now decides the parameters per provider + model; the Test-button probe is plain text with 8 tokens. One real draft for "Drone Pilot": 1.3k tokens, honest tiers, defining skill proposed as a new taxonomy skill

## VERIFY

- [x] Full suite + build green (626 tests, 75 files)
- [x] Harness screenshots rb08-rb10: draft review card (untick + approve -> live), a new profession with no blueprint showing Draft + batch buttons; 632 tests green
- [x] Harness screenshots rb01-rb07 in test-results/: compass with route map + role chips, Start-this-route adding 5 skills, 360px, /admin/blueprints (105/105 live), settings flag row; console clean
- [ ] Neon: `npm run db:migrate` (0080 + 0081), then Import on /admin/blueprints, then flip the flag
