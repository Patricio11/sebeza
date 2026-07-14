-- Phase 25.4 ("Bulk announcements")  a dedicated opt-in consent purpose for
-- platform announcements over SMS. POPIA posture identical to 0008/0016:
-- optional, default-off, NON-DEGRADING (withholding it changes nothing about
-- job search). The admin bulk-send fans out ONLY to users who granted this
-- AND have a verified phone AND the SMS channel is enabled.

ALTER TYPE consent_purpose ADD VALUE IF NOT EXISTS 'announcements';
