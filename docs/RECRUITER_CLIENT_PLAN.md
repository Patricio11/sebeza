# Recruiters, client companies, and the congrats-invite link

Founder request, 2026-08-22. Today the platform cannot tell a
recruitment agency from a company hiring for itself, so an agency's
vacancy claims the agency IS the employer, and a congrats invite
(filled-from-elsewhere) can only point at the inviting org. This
closes all three gaps:

```
signup ──"own company / recruiting for clients"──▶ organizations.org_kind

agency vacancy ──client picker──▶ client_org_id (linked, card shown)
                              └─▶ client_name/city/contact (free text
                                   when the client isn't on Sebenza)

congrats invite ──accept──▶ direct employer: current employer set +
                            placement logged automatically (both sides
                            asserted the hire: employer at mark-filled,
                            seeker by joining through that exact link)
                            agency: current employer set to the LINKED
                            client org only; placement stays manual
```

## Design decisions

- **org_kind lives on organizations** (`direct_employer` |
  `recruitment_agency`, text column, default direct). Existing orgs are
  companies; agencies self-declare at signup and can correct it on
  /employer/organisation. Shown to the admin in vetting.
- **Client picker reuses the 9.22 org-search machinery.** Typing the
  client's name searches existing orgs (registered or verified); a
  selection collapses the manual fields into a company card and stores
  `client_org_id`, a real FK. No match = free-text `client_name` (+
  optional city/contact). Client CONTACT is org-private: never in any
  seeker-facing or public payload (9.8.8 posture).
- **Attribution is honest.** A seeker facing an agency vacancy reads
  "Agency X · recruiting for Client Y". The verification badge belongs
  to the AGENCY; the client line is presented as the agency's claim.
- **Auto-link only where truth is two-sided.** Congrats invites now
  carry `congrats_role` + `congrats_vacancy_id`. On accept:
  - direct employer → set the new profile's current employer to the
    vacancy's org AND log the placement against the vacancy
    (Placement-Truth upgraded: employer asserted at mark-filled,
    seeker confirmed by joining through the token link).
  - agency → set current employer to the LINKED client org if one
    exists (the seeker is confirming "I work at Client Y"); never to
    the agency; NO auto-placement (an agency asserting a client's
    placement would pollute the client's stats).
  - Any failure degrades to a plain join: the account always wins.

## Implementation notes (surfaces mapped 2026-08-22)

- **Signup**: `EmployerSignUpForm` → `signUpEmployer` (lib/auth/actions.ts);
  org row insert is in its transaction. The org-kind question sits at the
  top of the Organisation section, required, no default.
- **Org editing**: /employer/organisation is READ-ONLY by design (9.13);
  the canonical edit surface is /employer/onboarding
  (`OrgOnboardingForm` → `submitOrgOnboarding` in lib/employer/vetting.ts).
  Org kind is displayed on the organisation page and correctable on the
  onboarding form; `getMyOrgVettingState` carries it.
- **Admin vetting**: `OrgReviewRow` / `OrgReviewDetail`
  (lib/admin/org-vetting.ts) + `OrgReviewModal` get the kind, rendered
  as an AGENCY chip so KYC review knows what it is looking at.
- **Client picker**: reuses the 9.22 machinery -
  `listEmployerOptions(query)` (lib/profile/employment.ts; registered OR
  verified orgs, picker limit 40) + the `ComboboxField` typeahead, same
  as the seeker's current-employer picker. Selection → `client_org_id` +
  company card, manual fields collapse; "not on Sebenza" → free-text
  client_name/city/contact. `createVacancy`/`updateVacancy` re-verify
  the picked org is picker-visible (anti-FK-probing, same as
  `updateCurrentEmployment`) and null all client fields for
  direct-employer orgs.
- **Placements**: no shared helper exists - `markAsHired`
  (lib/employer/placements.ts) and `markVacancyFilledAndLogHires`
  (lib/employer/vacancies.ts) each insert. The congrats-accept path adds
  a third, deliberately minimal insert (source `employer_confirmed`,
  actor = the inviter, vacancy linked) - the reveal-gate is N/A because
  the hire happened OFF-platform and both sides asserted it.
- **Attribution**: `getMyInvitation` already joins vacancies +
  organizations; adding client fields + org kind is a select/type/mapper
  change (both detail + list get it). Public /apply page attribution is
  DEFERRED - it renders through the 9.8.8 carve-out
  (lib/vacancy/public.ts) and self-apply is still flag-OFF dark; adding
  client name there is a follow-up decision, not an accident.

## TASKS

- [x] Migration 0075: organizations.org_kind, vacancies.client_* (+ client_org_id FK + partial index), seeker_invitations.congrats_role/congrats_vacancy_id; schema.ts; test DB
- [x] Employer signup: required "own company / recruiting for clients" select → signUpEmployer stores org_kind
- [x] /employer/organisation shows org kind; onboarding form can correct it; admin vetting shows an AGENCY chip (OrgReviewRow + modal)
- [x] VacancyForm agency branch: client typeahead (listEmployerOptions + ComboboxField) → company card (fields collapse) OR free-text client fields; create/update validation (agency needs linked client or a name; direct employers get client fields nulled)
- [x] Seeker attribution: invitation detail reads "recruiting for {client}" with claim framing (list row too); public apply page deferred (see notes)
- [x] Congrats invite carries role + vacancy (MarkAsFilledModal → inviteSeeker → row, inviter's-own-vacancy verified)
- [x] acceptSeekerInvitation: employment link + auto-placement per the decision table above (failure degrades to plain join)
- [x] i18n en/zu/xh/af for every new string (signup question, onboarding, vacancy client section, attribution line)
- [x] Tests: agency vacancy validation, accept-path linking (direct vs agency-with-linked-client vs no-link), congrats vacancy scoping

## VERIFY

- [x] Full suite + build green (569 tests, 63 files)
- [x] Screenshots r01-r06 in test-results/ (cookie bar dismissed): signup question, client typeahead, company card, manual client fields, invitation attribution, organisation type; congrats accept → employment + placement covered by integration tests
- [x] Migration applied to Neon (columns verified)
