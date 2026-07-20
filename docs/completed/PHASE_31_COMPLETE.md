# PHASE 31 COMPLETE — DATA MINIMISATION: DORMANT ID COLLECTION + TWO-CLASS CITIZEN CAPTURE ✅ 2026-07-19

*Plan (authoritative, with the full STATUS ledger): `docs/PHASE_9_19_PLAN.md` — drafted under that
number, ships as **Phase 31** because "9.19" was already used by the shipped vacancy-match-enrichment
phase (whose completion doc is `PHASE_9_19_COMPLETE.md` in this folder — hence this file's name).
The plan file stays at its original path because code comments reference it.*

*Responsible party for the POPIA representation: **Yetotec (Pty) Ltd**.*

> **One-line summary**: Sebenza now launches holding ZERO newly-collected ID/passport numbers —
> the entire collection surface is dormant behind an ack-gated admin flag (default OFF; removal
> rights never gated) — and nationality capture is reduced to the single two-class
> "South African citizen? Yes/No" the analytics and Citizen-Visibility ranking actually consume.

**Commit:** `37e8e0e` (+ the ledger-closing follow-up commit).

## What shipped
- `feature_flag_id_verification_enabled` (default **OFF**) + ack-gated `IdVerificationSwitch`
  on /admin/verifications → Seeker IDs. While OFF: the profile editor shows a Date-of-birth-only
  section; `changeNationalId` / `uploadIdDocument` / `submitMyIdForVerification` hard-refuse
  BEFORE validation. **`removeNationalId` / `revokeMyKyc` are never gated** (data-subject
  erasure rights). Seekers with pre-existing ID data keep status + remove-only affordances; the
  admin review queue keeps working for already-submitted documents. Flipping ON restores the
  full 9.16 opt-in KYC flow unchanged — a toggle, not a rebuild.
- **Amendment (2026-07-20, operator feedback after live testing):** capture is a HYBRID —
  answering **No** reveals the canonical country picker (ZA excluded), because nationality
  displays on the public profile + search rows. Labels always derived server-side (citizens →
  "South Africa"); the `nationality` column stays (planned drop withdrawn). DPIA R-26.2a.
- Sign-up asks one i18n'd "Are you a South African citizen? Yes/No" (segmented control;
  `signUpSeeker` takes `isCitizen: boolean` + a conditional country code; the invited path
  inherits it). Citizens never see a country picker; the profile editor keeps its citizen
  checkbox with the same conditional picker, and the old free-text nationality field stays
  retired (labels are always derived from the picked ISO code).
- DPIA addendum **R-26**: the risk REDUCTION recorded (supersedes register entries assuming ID
  capture at profile time) + the verify-and-discard commitment for the ON state.

## Verification
- Vitest (dormant-gate suite): collection endpoints refuse before validation when OFF; removal
  never gated; the gate opens when ON; nationality analytics emit ONLY `sa_citizen` /
  `foreign_national` (never a raw country label); structural guard fails the build if any
  asylum/refugee/permit/visa/immigration column is ever added.
- E2E `tests/e2e/id-minimisation.spec.ts`: the citizen question at sign-up, both flag states on
  the profile editor, the ack-gated admin switch — desktop + 360px, screenshots `idmin-1..4`.
