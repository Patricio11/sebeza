# The hiring loop: what is missing between "invited" and "hired"

Status: 2026-08-20. **G1 to G8, G12 and G13 are now built.** The rest are
still open and marked below.

Sebenza models **who** with real care: a seven-state invitation machine, a
decline taxonomy, a vacancy snapshot frozen at send, an expiry cron, placement
rows linked back to the vacancy, and an audit trail behind all of it.

It barely models **how many**. That is the whole of this document.

`vacancies.positions` exists ([db/schema.ts:1586](../db/schema.ts)) and the
vacancy form asks for it ("Open positions", optional). But it is read in
exactly two places in the entire codebase, and it is never compared to how many
people were invited, accepted, or hired. A recruiter who needs five people is
never told they are three short.

---

## The gaps, worst first

### G1. Nothing computes a shortfall

> **DONE.** `lib/employer/vacancy-fill.ts` computes it once, and the vacancy page, match page and mark-as-filled modal all read from it.
**Nowhere** does the product compare accepted (or hired) against `positions`.
There is no remaining-seats math, no "you still need 3", no prompt to invite
more when responses fall short, and no notification when a vacancy has been
open a long time with nobody accepted.

*Fix:* one derived number, `remaining = positions - acceptedOrHired`, computed
once and shown on the vacancy page, the match page, and the vacancies list.
Everything else in this section falls out of having it.

### G2. "3 positions to fill" never counts down

> **DONE.** The label counts down and never says "filled" about a mere acceptance.
[BulkInviteIsland.tsx:536](../components/feature/employer/vacancies/BulkInviteIsland.tsx)
echoes the field. Two people have accepted, it still says three.

*Fix:* render `remaining`, and say which it is: "3 positions, 2 filled, 1 to go".

### G3. "Select top N" ignores who already said yes

> **DONE.** Selects `remaining`, not the original target.
It selects `positions` candidates whether or not four of them are already in
the pipeline.

*Fix:* select `remaining`, and disable it at zero.

### G4. Withdrawn is filed under Expired

> **DONE.** Withdrawn has its own column, and only appears when non-zero.
The accept-rate strip folds `withdrawn` into the Expired tile, so the recruiter
cannot tell "they ignored me" from "I pulled it back". Those are opposite
signals about their own pipeline. `reconsidering` is likewise folded into
Declined.

*Fix:* separate tiles, or at minimum separate the two in the tooltip.

### G5. An expired invitation shows a "responded" date

> **DONE.** Expired rows say "expired", withdrawn say "withdrawn".
The expiry cron stamps `respondedAt` ([invitations-cron.ts:48](../lib/employer/invitations-cron.ts))
and the pipeline panel labels that column as a response. Nobody responded.

*Fix:* label by state, "expired {date}" when the state is expired.

### G6. The structured decline reason never reaches the employer

> **DONE.** The reason renders above the free-text note.
`declineReason` is collected, is carried on `InvitationRow`, feeds the national
analytics, and the notification copy promises it as market signal. The pipeline
panel renders only the free-text note.

*Fix:* render the reason chip next to the state chip. It is the single most
useful thing a recruiter can learn from a decline.

### G7. Zero invitations means zero interface

> **DONE.** An empty pipeline says so, and states the seat count.
Both panels return null when there is nothing yet, so a new vacancy page looks
broken rather than empty.

*Fix:* a real empty state: "No invitations yet. Find candidates" with the link.

### G8. A five-position vacancy can be marked filled after one hire

> **DONE.** The modal shows "2 of 5" and asks, without blocking, when short.
`MarkAsFilledModal` shows "Selected hires: N" with no denominator, and the
"Skip, log later" path closes the vacancy recording nothing at all. The only
completeness check in the entire hiring loop is binary: filled with zero
placements logged.

*Fix:* show "2 of 5 hired" in the modal, and when the count is short, ask one
question rather than blocking: did you fill the rest elsewhere, or are you
still looking? The answer is worth more than the guess.

### G9. Nothing connects headcount to invitations
A vacancy needing one person can absorb 500 invitations an hour. Nothing warns.

*Fix:* a soft warning past a sensible multiple of `remaining`, never a hard
block. Over-inviting is sometimes rational; doing it unknowingly is not.

### G10. An expired invitation is a dead end
No re-invite affordance, no "3 expired, want to top up?" prompt. The only
action on a row is Withdraw, and only while it is still open.

*Fix:* "Invite someone else" from an expired row, pre-filtered to the same
match list.

### G11. The employer gets no aggregate signal, ever
Every employer notification is per-seeker and per-event. There is no digest, no
threshold, nothing that says "4 of your 6 invites declined" or "open 30 days,
nobody accepted". A recruiter who is failing finds out by noticing.

*Fix:* one weekly per-vacancy digest, and one threshold alert when a vacancy is
short with no pending invitations left. Both need to be opt-out-able.

---

## What is already good, and should not be disturbed

**The not-selected loop is genuinely excellent** and answers the obvious
question, "what happens to the people who accepted and were not chosen?".

When the employer logs hires, every accepted-but-not-selected seeker receives
`vacancy.outcome.other-hired`, composed per person by
[lib/seeker/vacancy-outcome.ts](../lib/seeker/vacancy-outcome.ts): an honest
lead, what the role wanted, which of those skills their profile did not show,
the dominant decline reason in their profession and province when the cell
clears the k-floor, and a Career Compass link pre-loaded with the gap. It never
names, hints at, or describes the person who was hired.

Two holes in it, though, and both are real:

- **G12. Skip means silence.** The fan-out only happens on the hires path. If
  the employer takes "Skip, log later", nobody is told anything, and those
  seekers hold an accepted invitation forever.
- **G13. Closing is not filling.** A vacancy moved to `closed` rather than
  `filled` also tells nobody, even when people accepted.

*Fix for both:* the outcome fan-out belongs on the state transition out of
`open`, not on the hires path. Anyone holding an accepted invitation on a
vacancy that stops being open deserves to be told it is over, even when we
cannot say who got it, and especially when we do not know.

There is also **G14**: `OUTCOME_FANOUT_CAP` silently truncates the fan-out on
large vacancies. The audit records `capped: true`; the people past the cap
simply hear nothing.

---

## What is left

- **G9** soft warning when invites far exceed remaining seats.
- **G10** re-invite from an expired row.
- **G11** the aggregate signal: a weekly per-vacancy digest, and an alert
  when a vacancy is short with nothing pending. The vacancy page now
  shows that state live ("2 still to fill and nobody left to hear
  from"), so the remaining work is purely the out-of-app nudge.
- **G14** `OUTCOME_FANOUT_CAP` still truncates silently past 100
  recipients. The closure fan-out inherits the same cap.

## What "done" means here

A new notification kind, `vacancy.outcome.closed`, carries the honest
ending. It deliberately does NOT reuse the 9.11 composer, which opens
with "filled the role with another candidate": on this path nobody told
us anyone was hired, and saying so anyway would be a polite fiction.
The closure fan-out no-ops when placements exist, so nobody is told
twice in two different registers.
