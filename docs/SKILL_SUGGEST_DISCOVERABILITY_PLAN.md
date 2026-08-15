# PLAN - MAKE "SUGGEST A SKILL" DISCOVERABLE IN THE PICKER

*Founder request (2026-08-15, with screenshot): the skills picker shows "Type to search skills…"
with no visible way to add a skill that isn't in the system. The suggest flow EXISTS (typing an
unmatched skill reveals a "Skill not listed?" footer, routes to admin review, pending chip,
approval loop notifies + backfills) but it only reveals itself after 2+ unmatched characters -
zero discoverability before that.*

## TASKS

- [x] `MultiSelectComboboxField`: new optional `otherHint` prop - when `allowOther` is set and
  the "Suggest" footer is NOT yet showing (empty/short/matching query), the popover renders a
  quiet, non-interactive footer line telling the user they can type their own entry. Visible the
  moment the picker opens; swaps to the actionable "Suggest {query}" row as they type.
- [x] SkillsEditor helpText: say it outright - type a skill that isn't listed to send it for
  review; it shows as pending and you're notified when approved (the new approval loop).
- [x] VacancyForm skills helpText: same half-sentence for employers.

## VERIFY

- [x] Picker open with empty query shows the hint; typing an unmatched skill still swaps to the
  actionable Suggest row; keyboard navigation untouched (hint is non-navigable).
- [x] typecheck + unit green; screenshot for the founder.
