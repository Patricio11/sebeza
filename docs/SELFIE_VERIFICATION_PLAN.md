# Selfie verification + qualification-evidence retirement (2026-08-18)

**Founder decisions:** the green **Verified** profile badge is earned by a **live selfie**
(active liveness), not by document review. Qualification evidence uploads are **retired**:
qualifications are self-declared and honestly labelled unverified; badges already earned stay.
Goal: verify humans, store fewer files.

**Architecture (decided with founder, from his open-source shortlist):** Google **MediaPipe
Face Landmarker running fully in the browser** — the user's device does the liveness check
(random gesture challenge: turn head / blink / smile), so **no face data is ever processed on
our servers** (no biometric special-personal-information processing under POPIA §26; the
passing frame simply becomes the profile photo through the existing WebP pipeline, which
strips all metadata). Server stores ONE new fact: `profiles.selfie_verified_at`. DeepFace /
CompreFace / InsightFace were rejected: server-side biometrics + separate infra.
**Honest limit (documented, accepted):** browser liveness deters bots/photos/casual fakes,
not a determined attacker with a modified client. The badge claims a live selfie, not
identity. Escalation path if abuse emerges: commercial liveness provider behind the same
flow.

Ships DARK behind `feature_flag_selfie_verification` (default OFF, /admin/settings).

## TASKS
- [x] Migration 0067: `profiles.selfie_verified_at` + `selfie_challenges` table (server-issued
      one-time gesture challenges, 5-min expiry); journal idx 67; apply to test + LIVE Neon
- [x] Settings key `feature_flag_selfie_verification` (union + DEFAULTS + validator + enum)
- [x] Self-hosted MediaPipe assets: `@mediapipe/tasks-vision` npm, wasm → `public/mediapipe/wasm`,
      `face_landmarker.task` model → `public/models/` (CSP-clean, no external calls)
- [x] `lib/profile/selfie.ts`: `startSelfieVerification` (flag-gated, mints challenge,
      max 5/10min) + `completeSelfieVerification` (challenge must be mine/unused/unexpired;
      photo through `uploadPhoto`; sets `selfieVerifiedAt`; roll-up; audit `profile.selfie.verified`)
- [x] Verification roll-up (9.14) extended: `verified ⇔ live selfie OR ≥1 verified qual`
- [x] `SelfieVerificationCard` + `SelfieLivenessDialog` (BrandDialog): consent note → camera
      (getUserMedia, capture-only) → lazy-load MediaPipe → calibrate → 2 random gestures
      (3-frame hold) → capture frame → submit. Mounted on /dashboard/profile by the photo.
- [x] Qualification retirement: evidence upload refused server-side + upload UI replaced with
      "qualifications are self-declared" note; pending backlog still reviewable in admin
- [x] Tests: integration (flag gate, challenge lifecycle, roll-up via selfie, qual-evidence
      refusal); suites + typecheck green
- [x] Docs: TO_START entry + memory

## VERIFY
- [x] Flag OFF: card hidden, actions refuse
- [x] Flag ON (harness): challenge → complete → `selfie_verified_at` set, profile flips
      `verified`, Verified pill renders (existing badge surfaces, no new UI)
- [x] Qual evidence upload refused; new quals stay `unverified`; roll-up unchanged for
      legacy verified quals
- [x] admin-smoke + role-arcs green, desktop + 360px

## Follow-ups (not this phase)
- [ ] Human-reviewed zu/xh/af copy for the dialog (biometric-adjacent consent copy is
      English-only by the translation hold rule until reviewed)
- [ ] Optional cleanup cron: delete stored qualification evidence files for already-decided
      rows (founder call; keeps audit basis if kept)
- [ ] Camera-driven E2E with Playwright fake media stream (unit/integration cover the server)

## Production incident: "stuck on loading the checker" (2026-08-19)
A user reported the dialog spinning forever on *Starting camera and loading the
checker*; 7 challenges had been minted and ZERO completed.

**Root cause:** the production CSP shipped `script-src 'self' 'unsafe-inline'`
with no `'wasm-unsafe-eval'`, so Chrome/Edge refuse `WebAssembly.instantiate`
and MediaPipe never finishes loading. Dev worked only because `'unsafe-eval'`
(dev-only, for Turbopack HMR) implies wasm permission.

**Fixes:**
- `proxy.ts`: added `'wasm-unsafe-eval'` to script-src in BOTH environments, plus
  `worker-src 'self' blob:`. `wasm-unsafe-eval` permits WebAssembly compilation
  only  it does NOT re-open JavaScript `eval()`, so the XSS backstop holds.
- `SelfieVerification.tsx`: a 25s wall-clock timeout around the loader. A stuck
  checker must surface as an honest, retryable error, never an endless spinner.
- E2E now asserts the flow REACHES the calibrating stage ("Look straight at the
  camera"), which proves the wasm actually compiled. The previous assertion also
  accepted "starting camera", so it passed while the feature was broken  and the
  committed screenshot showed the stuck state without anyone noticing.

**Lesson:** any browser feature needing wasm, workers or blob URLs must be
E2E-asserted PAST the loading state, because the E2E server runs the production
build (production CSP) while `npm run dev` does not.

## Open decision: what does the Verified badge mean? (raised 2026-08-19)
A live seeker shows Verified without doing the selfie. That is the roll-up
working as specified (`verified ⇔ selfie OR >=1 verified qualification`): an
admin approved 4 of her uploaded certificates on 2026-08-18 (audit
`verification.approve` x4). Nothing is broken  but the badge now carries two
different claims ("a real human" vs "a credential was checked") with one label.
Founder to choose:
  (a) keep as is;
  (b) profile badge = selfie ONLY, qualification verification stays on the
      qualification row where it already renders;
  (c) two distinct labels.

