-- Interview scheduling (founder request, 2026-08-22).
--
-- The platform walked a person from found -> invited -> accepted and
-- then went silent at the most human step: the interview happened over
-- WhatsApp, off the record. This closes that gap. An interview belongs
-- to an accepted invitation, carries the when/where/how the seeker
-- needs, and both sides see the same facts.
--
-- One ACTIVE interview (scheduled|confirmed) per invitation: a
-- reschedule is an explicit cancel + a new row, so the audit trail
-- keeps every version of the plan. Enforced by a partial unique index,
-- not application hope.

CREATE TABLE IF NOT EXISTS interviews (
  id                   text PRIMARY KEY,
  invitation_id        text NOT NULL REFERENCES vacancy_invitations(id) ON DELETE CASCADE,
  vacancy_id           text NOT NULL,
  organization_id      text NOT NULL,
  profile_id           text NOT NULL,
  scheduled_by_user_id text NOT NULL,
  -- Stored UTC; rendered Africa/Johannesburg everywhere.
  starts_at            timestamp NOT NULL,
  duration_minutes     integer NOT NULL DEFAULT 60,
  -- in_person | video | phone
  location_kind        text NOT NULL,
  -- The address, the meeting link, or the number they will be called
  -- from. Employer-authored, seeker-directed: same PII posture as
  -- invite notes.
  location             text NOT NULL,
  instructions         text,
  -- scheduled -> confirmed | declined (seeker) | cancelled (employer)
  --           -> attended | no_show (employer, after the start time)
  -- Attendance closes the loop: an attended interview offers the
  -- existing "Log this hire" placement flow; a no_show frees the
  -- invitation for one more attempt or an honest end.
  state                text NOT NULL DEFAULT 'scheduled',
  seeker_note          text,
  created_at           timestamp NOT NULL DEFAULT now(),
  responded_at         timestamp,
  cancelled_at         timestamp
);

CREATE INDEX IF NOT EXISTS interviews_org_starts_idx
  ON interviews (organization_id, starts_at);
CREATE INDEX IF NOT EXISTS interviews_profile_idx
  ON interviews (profile_id);
CREATE UNIQUE INDEX IF NOT EXISTS interviews_one_active_per_invitation
  ON interviews (invitation_id)
  WHERE state IN ('scheduled', 'confirmed');
