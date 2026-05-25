-- Phase 9.10  Employer KYC / org vetting flow.
--
-- Two changes:
--
-- 1. Four nullable columns on `organizations` for the admin review
--    lifecycle (per `docs/PHASE_9_10_PLAN.md` task 9.10.1):
--      - verified_at         : timestamp when admin approved
--      - verified_by_user_id : the admin who approved (audit trail)
--      - rejection_reason    : free-text reason shown to the org owner
--                              when verification = 'rejected'
--      - admin_note          : free-text note shown as a yellow banner
--                              on the onboarding form when admin clicks
--                              "Request Changes". Cleared on resubmit.
--      - company_address     : physical address textarea (captured at
--                              onboarding, not at signup)
--      - vat_number          : optional, captured at onboarding
--
-- 2. New `organization_documents` table  the actual uploaded KYC
--    docs. Mirrors the `qualifications.documentStorageKey` pattern.
--    Service-role uploads to Supabase Storage under
--    `{userId}/org-documents/{id}.{ext}`. One row per (org, kind) for
--    the four required slots; multiple `other` rows allowed.
--
-- No data migration: existing orgs start with all new columns NULL,
-- which is the correct "haven't submitted onboarding yet" state. The
-- existing seed (Discovery Bank, verification='unverified') stays as
-- before; new fixtures land via seed updates in 9.10.6.

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "verified_at"          timestamp,
  ADD COLUMN IF NOT EXISTS "verified_by_user_id"  text REFERENCES "app_user"("id"),
  ADD COLUMN IF NOT EXISTS "rejection_reason"     text,
  ADD COLUMN IF NOT EXISTS "admin_note"           text,
  ADD COLUMN IF NOT EXISTS "company_address"      text,
  ADD COLUMN IF NOT EXISTS "vat_number"           text;

CREATE TYPE "org_document_kind" AS ENUM (
  'company_reg_cert',
  'tax_clearance',
  'proof_of_address',
  'bank_confirmation',
  'other'
);

CREATE TABLE IF NOT EXISTS "organization_documents" (
  "id"                  text PRIMARY KEY NOT NULL,
  "organization_id"     text NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "kind"                "org_document_kind" NOT NULL,
  "original_name"       text NOT NULL,
  "storage_key"         text NOT NULL,
  "mime_type"           text NOT NULL,
  "size_bytes"          integer NOT NULL,
  "uploaded_by_user_id" text NOT NULL REFERENCES "app_user"("id"),
  "uploaded_at"         timestamp NOT NULL DEFAULT now()
);

-- One required-kind row per org (the 4 required slots dedupe; `other`
-- allows multiple rows so this partial unique is correct).
CREATE UNIQUE INDEX IF NOT EXISTS "organization_documents_org_required_kind_uq"
  ON "organization_documents" ("organization_id", "kind")
  WHERE "kind" <> 'other';

-- Common admin-review query: "show me every doc for this org."
CREATE INDEX IF NOT EXISTS "organization_documents_org_idx"
  ON "organization_documents" ("organization_id");
