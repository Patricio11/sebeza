-- Phase 23.1 ("Truth & Data Integrity") — internships / graduate programmes /
-- learnerships for the student lane, moved off the hardcoded mock snapshots
-- into an editable table (seeded from those constants). Live data, admin-
-- correctable, honest application status. Public info, not PII.
--
-- Idempotent (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS graduate_programmes (
  id                 text PRIMARY KEY,
  title              text NOT NULL,
  organisation       text NOT NULL,
  -- "public" | "corporate" | "ngo" | "startup" — context, never a gate.
  sector             text NOT NULL,
  -- "internship" | "graduate_programme" | "learnership".
  kind               text NOT NULL,
  duration_months    integer NOT NULL,
  cities             jsonb NOT NULL,
  -- "open" | "closing_soon" | "closed" — sourced from listings, never invented.
  application_status text NOT NULL,
  application_hint   text NOT NULL,
  eligibility        text NOT NULL,
  field_tags         jsonb NOT NULL,
  saqa_recognised    boolean NOT NULL DEFAULT false,
  sort_order         integer NOT NULL DEFAULT 0,
  created_at         timestamp NOT NULL DEFAULT now(),
  deleted_at         timestamp
);
