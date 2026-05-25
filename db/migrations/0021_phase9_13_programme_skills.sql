-- Phase 9.13  The learning-loop intelligence layer.
--
-- Adds the institution × programme × skill mapping needed by the
-- demand-vs-curriculum analytics (Task 9.13.3). Hand-curated for the
-- top SA institutions × top programmes at ship time per D4 in
-- PHASE_9_13_PLAN.md; the table shape admits future SAQA-feed
-- expansion (dormant, Phase 8 adapter territory) without a schema
-- change.
--
-- weight  1..10, integer. Represents the strength of the link between
-- a programme's curriculum and a skill the labour market recognises:
--   - 9..10   core / required outcome of the programme
--   - 6..8    strong elective coverage
--   - 3..5    common adjacency (touched, not majored)
--   - 1..2    rare / circumstantial overlap
--
-- The 9.13.3 query weights demand-vs-curriculum gap analysis by this
-- column so a "BSc CS doesn't cover React" headline lands honestly even
-- though every programme touches some web tech tangentially.
--
-- No data migration  table starts populated by the seed in 9.13.2
-- below; existing rows untouched.

CREATE TABLE IF NOT EXISTS "programme_skills" (
  "institution_slug" text NOT NULL REFERENCES "institutions"("slug"),
  "programme"        text NOT NULL,
  "skill_slug"       text NOT NULL REFERENCES "skills"("slug"),
  "weight"           integer NOT NULL DEFAULT 5,
  "created_at"       timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("institution_slug", "programme", "skill_slug")
);

CREATE INDEX IF NOT EXISTS "programme_skills_skill_idx"
  ON "programme_skills" ("skill_slug");

CREATE INDEX IF NOT EXISTS "programme_skills_inst_prog_idx"
  ON "programme_skills" ("institution_slug", "programme");
