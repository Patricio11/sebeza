-- Phase 9.15  Taxonomy suggestion queue ("Other" + admin promote/merge).
--
-- One table for both professions + institutions, discriminated by `kind`.
-- The admin queue at /admin/taxonomy/suggestions surfaces pending rows;
-- the four admin actions (promote / edit & promote / merge / reject) all
-- update this table + (for promote/merge) backfill the affected
-- profile/academic rows.
--
-- Two schema flavours for the free-text capture:
--
--   1. Professions: profiles.profession is plain text (no FK). The user's
--      free-text lands directly in that column. The suggestion row tracks
--      pending review. Backfill on promote is UPDATE profiles SET
--      profession = '<canonical>' WHERE lower(profession) = lower(<text>).
--
--   2. Institutions: academic_profiles.institution_slug has an FK to
--      institutions(slug). So free-text creates a new institutions row
--      with is_pending = true + a slug like 'other--<kebab>-<rand6>'. The
--      academic_profiles.institution_slug points at this pending row.
--      Pickers default to WHERE NOT is_pending AND deleted_at IS NULL.
--      Admin promote flips is_pending to false. Admin merge UPDATEs
--      academic_profiles to point at the target + DELETEs the pending row.
--      Admin reject keeps the pending row so the user's profile data
--      remains intact (Verification-Honesty + Placement-Truth: never erase
--      user data because an admin disagrees with the canonicalisation).

-- ─────────────────────────────────────────────────────────────────────
-- Institutions  add is_pending + deleted_at for the free-text path
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE institutions
  ADD COLUMN IF NOT EXISTS is_pending  boolean    NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at  timestamp;

CREATE INDEX IF NOT EXISTS institutions_pending_idx
  ON institutions (is_pending)
  WHERE is_pending = true;

-- ─────────────────────────────────────────────────────────────────────
-- Suggestion queue
-- ─────────────────────────────────────────────────────────────────────

CREATE TYPE taxonomy_suggestion_kind AS ENUM (
  'profession',
  'institution'
);

CREATE TYPE taxonomy_suggestion_state AS ENUM (
  'pending',
  'promoted',
  'merged',
  'rejected'
);

CREATE TABLE IF NOT EXISTS taxonomy_suggestions (
  id                   text PRIMARY KEY,
  kind                 taxonomy_suggestion_kind NOT NULL,
  custom_text          text NOT NULL,
  submitted_by_user_id text NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  submitted_at         timestamp NOT NULL DEFAULT now(),
  state                taxonomy_suggestion_state NOT NULL DEFAULT 'pending',
  -- When promoted, the canonical slug created. When merged, the target
  -- canonical slug the suggestion was merged INTO. Null on pending or
  -- rejected.
  target_slug          text,
  resolved_by_user_id  text REFERENCES app_user(id),
  resolved_at          timestamp,
  -- Admin note  free text. On reject, the reason. On merge / edit-and-
  -- promote, the rationale. Optional.
  admin_note           text,
  -- For institution suggestions, the pending institutions.slug created
  -- alongside this suggestion. Useful for the "merge into existing"
  -- action which needs to DELETE the pending row after backfilling.
  pending_institution_slug text REFERENCES institutions(slug) ON DELETE SET NULL,
  CONSTRAINT taxonomy_suggestions_custom_text_len_chk
    CHECK (length(trim(custom_text)) BETWEEN 2 AND 80)
);

CREATE INDEX IF NOT EXISTS taxonomy_suggestions_state_kind_idx
  ON taxonomy_suggestions (state, kind, submitted_at DESC);

CREATE INDEX IF NOT EXISTS taxonomy_suggestions_dedup_idx
  ON taxonomy_suggestions (kind, lower(custom_text));
