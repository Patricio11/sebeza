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

## VERIFY

- [x] Full suite + build green (588 tests, 66 files; production build green)
- [x] Harness screenshots on01-on06 (on05 = rendered nudge email, on06 = one-row province/city before a province is picked) in test-results/: signup step 3 city select, dashboard next steps (no ID/certificate asks, live skills count), grow page without the Learning paths section or help chip, /admin/settings Launch tab flag row. Push card renders nothing on the harness (web-push flag OFF there), so it is exercised by the existing PushOptIn behaviour on prod
- [x] Neon: nothing to migrate (no schema change); flag lands OFF via DEFAULTS
