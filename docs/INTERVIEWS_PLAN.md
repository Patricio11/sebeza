# Interviews: closing the last gap in the hiring loop

Founder request, 2026-08-22. The platform walks a person from *found* →
*invited* → *accepted* → and then goes silent at the most human step:
the interview happens over WhatsApp, off the record. This plan puts it
on the platform, end to end:

```
accepted ──schedule──▶ scheduled ──seeker──▶ confirmed / declined
                          │                        │
                       cancel (employer)      after start time
                          ▼                        ▼
                      cancelled            attended / no_show
                                                 │
                                        attended → "Log this hire"
                                        (existing Placement-Truth flow)
```

## Design decisions

- **One active interview per invitation** (scheduled|confirmed),
  enforced by a partial unique index. A reschedule is an explicit
  cancel + a new row: the trail keeps every version of the plan.
- **Attendance closes the loop.** After the start time the employer
  marks attended / no-show. An attended interview offers the existing
  "Log this hire" deep-link (dossier, vacancyId pre-armed); no duplicate
  placement logic, Placement-Truth stays the single source.
- **Calendar = universal links, not OAuth.** "Add to Google Calendar"
  is a template URL; the `.ics` download covers Outlook/Apple. One tap,
  works today, and shares nothing with Google except what the person
  chooses by clicking. Two-way OAuth sync is a future Integrations-hub
  project with its own DPA, deliberately out of scope.
- **Times stored UTC, rendered Africa/Johannesburg** everywhere (SA has
  no DST; formatters pass the zone explicitly, never host-local).
- **Location + instructions are employer-authored seeker-directed
  content**: same PII posture as invite notes, flagged in audit meta.
- **House inputs only**: DatePicker + CustomSelect for time/duration
  (no native date/select inputs), BrandDialog for the schedule modal.
- **Anti-noise**: scheduling notifies the seeker (push on by default:
  a hard clock); cancelling notifies; confirm/decline notifies the org;
  a single reminder fires 3 days out to BOTH sides (founder request),
  once ever per interview. Nothing else fires.

## TASKS

- [x] Migration 0074 `interviews` + partial unique active index; schema.ts (test DB applied)
- [x] `lib/interviews/links.ts`: pure Google-Calendar URL + ICS builder + unit tests
- [x] `lib/employer/interviews.ts`: schedule (single + all-accepted), cancel, attendance
- [x] `lib/seeker/interviews.ts`: confirm / can't-make-it (+note)
- [x] Notification kinds: `interview.scheduled` `interview.cancelled` (seeker, push+email on), `interview.response` (org); bespoke scheduled-email template; prefs lists both roles
- [x] Schedule dialog (BrandDialog) + per-row chip/button on accepted pipeline rows + bulk "Schedule all accepted"
- [x] `/employer/interviews` agenda page (grouped by day, attendance actions, gcal/ics links) + nav item
- [x] ICS route `app/api/interviews/[id]/ics` (org member or owning seeker only)
- [x] Seeker invitation-detail interview block: details, add-to-calendar, Confirm / Can't make it
- [x] i18n: every new string in en/zu/xh/af (employerVacancies.interviews.*, seekerDash.interview.*, nav)
- [x] Audit kinds: interview.schedule / cancel / response / attendance / reminder
- [x] Reminder cron `interview-reminders` (founder request): 3 days out, BOTH sides (`interview.reminder` seeker push+email, `interview.reminder.employer` org), once-ever guard via notifications meta, vercel.json daily 04:30

## VERIFY

- [x] Integration tests: only accepted invitations schedulable; one active per invitation (unique-index race); cancel frees the slot; seeker respond org-scoped; attendance only after start time
- [x] ICS unit tests: escaping, line folding, UTC format; Google URL params
- [x] Full suite + build green
- [x] Harness walkthrough with screenshots: schedule dialog → seeker block → confirm → agenda page shows attendance actions
- [x] Migration applied to Neon
