# Seeker onboarding polish: location at signup, honest next steps, the 50% nudge, push opt-in, learning paths behind a flag

Founder request, 2026-08-26. Five asks, one theme: the first week of
a seeker's life on Sebenza must be smooth and honest.

```
signup ─────▶ province AND city captured up front (people forget later)
next steps ─▶ derived from what is TRUE today: no ID ask while
              collection is dormant, no certificate-upload ask (evidence
              uploads are retired), skills count includes custom skills,
              a location step when the city is missing
50% nudge ──▶ one gentle email + bell 24h after signup when the profile
              is under 50% complete; once, ever (never a nag)
push ───────▶ the real opt-in card on the first dashboard visits; the
              browser prompt only ever fires from the person's own tap
learning ───▶ /dashboard/grow "Learning paths" section behind
              feature_flag_learning_paths, OFF by default (admin toggle)
```

## Design decisions

- **Signup city is a real select** (province -> its cities, same list
  the profile editor uses), optional so nobody is blocked; the profile
  step nudges when it is still missing. City is stored as the LABEL,
  matching profiles.city everywhere else.
- **Next steps never lie.** Each step is derived from live state and
  gated by the same flags the features are: the ID step renders only
  when feature_flag_id_verification_enabled is ON; the qualification
  step asks for a qualification record, not an upload; the skills step
  counts canonical + custom skills (a seeker whose skills sat in the
  custom table was told "Add 5 more").
- **The nudge is a cron, not a signup side effect**: nobody is emailed
  at the moment they sign up. Daily `profile-completeness-nudge`:
  seeker profiles older than 24h, completeness < 50, not deleted, no
  prior `profile.completeness.nudge` notification. In-app + email ON,
  push OFF (a nudge is not a clock). Once ever per profile.
- **Push opt-in stays gesture-driven** (Phase 35 rule): the existing
  PushOptIn card, which renders nothing when push is flagged off or
  unsupported, is mounted on the dashboard overview so new seekers meet
  it on their first visits. No signup checkbox that pretends to enable
  a browser permission it cannot grant.
- **Learning paths ship dark**: feature_flag_learning_paths (default
  OFF) hides the Career Compass "Learning paths" section; the admin
  curation page stays so the catalogue keeps growing behind the flag.

## TASKS

- [x] feature_flag_learning_paths: SettingKey + DEFAULTS + validator + enum list + SettingsForm row (Launch tab); grow page section gated
- [x] Dashboard next steps: ID step flag-gated; qualification step reworded (no upload); skills count = canonical + custom; location step when city missing
- [x] Signup: city select (province-dependent, optional, slug convention), schema + insert; i18n en/zu/xh/af
- [x] Nudge: notification kind `profile.completeness.nudge` (generic email template) + cron route + vercel.json (07:00 daily) + seeker prefs list + audit kind
- [x] Push opt-in card on the dashboard overview (signup already records `wantsPushNotifications`; the card is where the browser permission is actually granted)
- [x] Tests: nudge cron (secret, 24h grace, once-ever, threshold) written; runs on the Docker harness
- [x] i18n for every new seeker-facing string (step3.cityLabel/cityHint/cityLater)

### Follow-up (founder, 2026-08-26 afternoon)

- [x] Migration 0077: `profiles.profile_complete_notified_at` (NULL = never nudged) + partial index; the cron reads and sets it (marker on the profile, not the bell)
- [x] Nudge trigger widened: a day after signup, fire when completeness < 50% OR any main info is missing (summary, 3+ skills, city); never repeated
- [x] Bespoke nudge email: checklist of what is missing with a one-line why each, "Finish your profile" CTA, only-reminder note
- [x] Signup step 3: province + city on one row; city disabled with a "pick a province first" hint until a province is chosen
- [x] Tests: marker set on send, main-info trigger at high completeness, complete profile never nudged

### Follow-up 2 (founder, 2026-08-26): phone-channel consents behind the admin flags

The SMS, WhatsApp and Platform-announcement consent cards on /dashboard/privacy
showed for everyone even though no channel can send until the admin flips
`feature_flag_sms_channel_enabled` / `feature_flag_whatsapp_channel_enabled`
(both default OFF). Signup step 2 never offered them; the account panel already
said "Coming soon". Now the privacy page follows the same flags.

- [x] /dashboard/privacy: hide messaging_channel_sms + announcements while the SMS flag is off, messaging_channel_whatsapp while the WhatsApp flag is off; an already-granted consent stays visible so it can be revoked (POPIA s.11(3))
- [x] /admin/settings hints say the flags also reveal the consent cards
- [x] Harness screenshot on08: privacy page with both flags off (six cards)

### Follow-up 3 (founder, 2026-08-28): skills that never reached the database

The founder's own profile showed 3 skills + 19 awaiting review in the editor while the
dashboard said "Add 5 more skills". The database had ZERO rows: the editor restores an
unsaved session draft on every visit, the only save was a button at the bottom, and
the page-level note says "Autosaves as you type". Skills now autosave.

- [x] SkillsEditor autosaves 900ms after any change (fingerprint vs last accepted list, lib/profile/skills-draft.ts); explicit Save stays as an immediate save and is disabled when nothing is unsaved
- [x] Honest status chip: Unsaved changes / Saving / Saved HH:MM / Could not save (en + zu/xh/af); beforeunload warning while unsaved
- [x] A restored draft counts as unsaved and is written on arrival (fixes the founder's case without asking anyone to re-add skills)
- [x] Harness: sa01 (draft autosaved on arrival, survives reload), sa02/sa03 (chip states), sa04 (dashboard "Skills set is strong")

### Follow-up 4 (founder, 2026-08-28): completeness jumps, the mid-page Save, the 20-skill wall

The founder clicked the basics "Save changes" on an untouched form and completeness
went 36% -> 69%. Only three code paths recomputed completeness; adding skills,
qualifications or experience left the stored number stale until something else
recomputed it. Separately his 22 skills never saved because updateSkills capped the
list at 20 and the autosave retried the rejected save every second.

- [x] refreshProfileCompleteness after updateSkills, addQualification, deleteQualification, addExperience, updateExperience, deleteExperience (integration test poisons the stored value and expects each action to recompute)
- [x] Skill cap raised to MAX_PROFILE_SKILLS = 30 in one pure constant; the picker refuses beyond it, the action says the cap in words, the status row shows "Too many skills: n of 30"
- [x] Autosave never retries a failed attempt until the list changes (lastAttempted fingerprint); same in the basics form
- [x] Basics form autosaves (1.2s debounce) with the Unsaved / Saving / Saved status row; the mid-page primary button is gone; Enter still saves now
- [x] Both editors router.refresh() on success so the Live completeness bar moves immediately
- [x] Harness: ba01 untouched basics (hint, no button), ba02 bio edit autosaved with the bar moving, ba03 over-cap draft refused

## VERIFY

- [x] Full suite + build green (588 tests, 66 files; production build green)
- [x] Harness screenshots on01-on06 (on05 = rendered nudge email, on06 = one-row province/city before a province is picked) in test-results/: signup step 3 city select, dashboard next steps (no ID/certificate asks, live skills count), grow page without the Learning paths section or help chip, /admin/settings Launch tab flag row. Push card renders nothing on the harness (web-push flag OFF there), so it is exercised by the existing PushOptIn behaviour on prod
- [x] Neon: nothing to migrate (no schema change); flag lands OFF via DEFAULTS
