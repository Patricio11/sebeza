# PLAN - SPOKEN + WRITTEN LANGUAGES ON PROFILES

*Founder request (2026-08-15): seekers add the languages they speak and write, each with a spoken
level and a written level, "really nicely." Orgs sometimes look for seekers with specific
languages; the levels are mainly for recruiters to SEE when reviewing (not a search gate).
Languages must count toward profile completeness.*

## Decisions

- **D1 - Levels**: one plain four-step scale for both dimensions: Basic · Intermediate · Fluent ·
  Native. No CEFR jargon; honest and readable on a 360px screen. Self-declared, so it renders as
  plain information, never as a "verified" claim (Verification-Honesty).
- **D2 - Language list**: a fixed constant of the 12 official languages (including South African
  Sign Language) + ~14 common additional languages (regional + migrant + business). No admin
  suggestion queue in v1: the list covers the real population; extending it later is a two-line
  constant + migration change (the private-colleges precedent).
- **D3 - Where it shows**: the seeker's profile editor (new Languages section), the public
  profile /p/[handle] (a Languages section with per-language spoken/written level chips), and the
  employer dossier which reads the same public payload. Cap: 6 languages.
- **D4 - Completeness**: languages term added to the ONE shared engine (`computeCompleteness`):
  +3 per language, capped at +6 (two languages = full marks). The engine already `min(100)`s.
- **D5 - NOT in v1**: language as a search filter/ranking signal (levels are review-time info per
  the founder; a filter is a natural follow-up phase), languages at sign-up (keep sign-up light;
  the editor + completeness nudge pull them in), verification of language claims.

## TASKS

- [x] `lib/mock/taxonomy.ts`: `LANGUAGES` constant (slug + label, official 12 first) +
  `LANGUAGE_LEVELS` (basic/intermediate/fluent/native + labels).
- [x] Migration `0064_profile_languages.sql` (+ journal idx 64): `language_level` enum,
  `profile_languages` table (profileId cascade, languageSlug, spokenLevel, writtenLevel, unique
  (profileId, languageSlug)). Idempotent. Applied to live Neon DB (additive-only).
- [x] Types: `LanguageRef` + optional `languages?: LanguageRef[]` on `PublicProfile` (optional so
  mock fixtures stay valid).
- [x] Read path: `loadLanguages(profileId)` joined into `findProfileByHandleQuery` (public +
  dossier both consume this payload).
- [x] Write path: `updateLanguages` Server Action in `lib/profile/actions.ts` (guarded; validates
  slugs against the constant, levels against the enum, cap 6, delete-then-insert in a
  transaction, recomputes completeness, `profile.update` audit).
- [x] `LanguagesEditor` island on /dashboard/profile (combobox add + per-row spoken/written
  segmented selects + remove; SkillsEditor pattern, BrandDialog not needed).
- [x] Public profile /p/[handle]: Languages section - language label + "Spoken · level" and
  "Written · level" chips, Civic-Editorial, hidden entirely when empty.
- [x] Completeness: `computeCompleteness` gains optional `languages` input (+3 each, cap +6);
  live recompute paths count `profile_languages` (`lib/profile/actions.ts` +
  `lib/profile/completeness-internal.ts`).
- [x] Seed: showcase languages for the flagship profiles (andile, lerato + cohort sample) so
  demos and E2E have real data.
- [x] i18n: `profile.languages.*` keys in en.json (labels; deep-merge fallback).

## VERIFY

- [x] Migration applies clean from zero (integration harness) AND on the live Neon DB.
- [x] Unit: completeness languages term (0/1/2/3 languages → +0/+3/+6/+6).
- [x] Editor saves + re-renders; public profile shows the section; empty profile shows nothing.
- [x] typecheck + lint + unit + integration green; screenshots for the founder.
