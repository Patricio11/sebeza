-- Phase 9.16  DOB + passport + admin-mediated ID verification.
--
-- Three paired changes in one migration (additive only; no FK rewrites,
-- no destructive ops):
--
--   1. DOB on profiles  typed `date` column, NULLABLE so existing rows
--      back-fill cleanly. No app-layer encryption (DOB alone isn't
--      special-category PII; the name+DOB ID surface is already public
--      via PublicProfile; DB encryption-at-rest covers the medium).
--
--   2. ID kind discriminator + passport country  enum + 2 columns.
--      Existing `national_id_enc` column kept as-is despite the
--      slightly broadened semantics (encryption is kind-agnostic; a
--      rename would ripple to too many sites). New columns default
--      to 'sa_id' so existing rows back-fill correctly  sign-up
--      historically only accepted SA ID.
--
--   3. ID document upload slot  3 columns on profiles mirroring the
--      qualifications.document_storage_key pattern. Document file
--      lives in Supabase Storage at {userId}/id-document/{id}.{ext}
--      via the existing uploadDocument helper. One slot for now;
--      multi-doc (front + back + supporting) is a future phase.
--
-- The kyc_verified_at column shipped in Phase 8 stays as the canonical
-- "verified" timestamp. Admin approval flips it; admin reject clears
-- the document but never touches kyc_verified_at (which is already
-- NULL for unverified rows).

CREATE TYPE "id_document_kind" AS ENUM (
  'sa_id',
  'passport'
);

ALTER TABLE "profiles"
  ADD COLUMN IF NOT EXISTS "date_of_birth"                date,
  ADD COLUMN IF NOT EXISTS "id_document_kind"             "id_document_kind" NOT NULL DEFAULT 'sa_id',
  ADD COLUMN IF NOT EXISTS "passport_country"             text,
  ADD COLUMN IF NOT EXISTS "id_document_storage_key"      text,
  ADD COLUMN IF NOT EXISTS "id_document_uploaded_at"      timestamp,
  ADD COLUMN IF NOT EXISTS "id_document_rejection_reason" text;

-- Admin queue uses this index to surface pending-review rows fast.
--
-- Phase 12 fix (2026-06-10): the original predicate also filtered on
-- "kyc_verified_at" IS NULL, but that column lives on app_user (see
-- db/schema.ts appUser.kycVerifiedAt), NOT on profiles — the statement
-- only ever succeeded on databases where a zombie profiles column
-- existed from an old `drizzle-kit push`. The Phase 12 migrate-from-zero
-- harness surfaced the break. The verified-or-not filter is applied at
-- query time via the app_user join; the index narrows to "has an
-- uploaded document + not deleted", which is the hot path.
CREATE INDEX IF NOT EXISTS "profiles_id_doc_pending_idx"
  ON "profiles" ("id_document_uploaded_at")
  WHERE "id_document_storage_key" IS NOT NULL
    AND "deleted_at" IS NULL;
