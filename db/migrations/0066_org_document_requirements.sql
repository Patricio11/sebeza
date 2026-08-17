-- 0066 · Admin-managed org onboarding document requirements
--
-- Founder decision 2026-08-17 (docs/ORG_ONBOARDING_GATE_PLAN.md), following
-- the SRS blueprint: the list of documents an organisation must upload for
-- KYC is configured by the admin, never hardcoded. The four current
-- SA-standard documents are seeded as the defaults (ids matching the legacy
-- org_document_kind enum values, so existing uploads backfill cleanly), and
-- organization_documents gains a requirement_id.
--
-- Idempotent, applies clean from zero and onto live.

CREATE TABLE IF NOT EXISTS "org_document_requirements" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "description" text,
  "required" boolean NOT NULL DEFAULT true,
  "sort_order" integer NOT NULL DEFAULT 0,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

INSERT INTO "org_document_requirements"
  ("id", "name", "description", "required", "sort_order", "active")
VALUES
  ('company_reg_cert', 'Company registration certificate',
   'CIPC certificate (COR14.3 / CK1 / CK2).', true, 0, true),
  ('tax_clearance', 'SARS tax clearance',
   'Tax clearance pin or letter of good standing.', true, 1, true),
  ('proof_of_address', 'Proof of business address',
   'Utility bill or lease agreement, not older than 3 months.', true, 2, true),
  ('bank_confirmation', 'Bank confirmation letter',
   'Stamped bank letter confirming the business account.', true, 3, true)
ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "organization_documents"
  ADD COLUMN IF NOT EXISTS "requirement_id" text
  REFERENCES "org_document_requirements"("id");

-- Legacy uploads attach to the seeded requirement matching their enum kind;
-- optional "other" supporting documents stay unattached.
UPDATE "organization_documents"
SET "requirement_id" = "kind"::text
WHERE "requirement_id" IS NULL AND "kind"::text <> 'other';
