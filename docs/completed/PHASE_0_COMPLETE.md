# Phase 0  Foundations & POPIA spine · ✅ COMPLETE

**Shipped:** 2026-05-21
**Convention note:** Every phase that ships gets a `PHASE_N_COMPLETE.md` here. The active phase keeps its planning in `PHASE_N_PLAN.md`. Both are linked from `ROADMAP.md`.

---

## What shipped

### Task 0.1  Project skeleton
- Next.js 16.2.6 (App Router, **no `src/`**, React 19, Turbopack)
- TypeScript strict (`noUncheckedIndexedAccess`)
- Tailwind v4 with design tokens via `@theme` in `app/globals.css`
- Lucide React icons
- Folder layout exactly as the brief: `app/[locale]/(public|seeker|employer|admin|auth)/…`, `db/`, `lib/`, `components/`, `messages/`, `emails/`, `docs/`
- next-intl 4.12 wired (`app/[locale]/…` + `proxy.ts` for Next 16)
- Tier-1 locale catalogs scaffolded (en + zu/xh/af with deep-merge fallback)
- Neon project + Drizzle client scaffolded (`db/client.ts`, `drizzle.config.ts`)  live connection deferred to Phase 2

### Task 0.2  POPIA infrastructure (built from commit one)
- `consents` table + `lib/consent` state machine (granted / revoked, versioned, purpose-specified)
- `audit_log` table + `lib/audit.logAccess()` helper (ring-buffer impl + admin viewer ready; persistent table swap is a Phase 2 follow-up)
- `lib/crypto`  AES-256-GCM field encryption with key-id prefix for future rotation
- Soft-delete convention (`deleted_at` columns) + erasure job stub
- `lib/auth/guard.ts`  `requireRole()` / `requireOrgVerified()` signatures locked so Phase 2 fills them without touching call sites

### Task 0.3  Design system v1 (later upgraded to "Mzansi National" in Phase 1.5)
- Trust-forward tokens via `@theme`
- Fraunces (display) + Hanken Grotesk (body), subset latin, `font-display: swap`
- Reusable: `VerificationBadge`, `StatusChip` (with freshness), `ProfileCompleteness`, `EmptyState`, `TalentRosterItem`, `StatCard`, `DataSpine`, `Skeleton`
- No-Flash budget: JS < ~150 KB on key routes; documented in `CLAUDE.md`

---

## Verification at the time of shipping

- `npm run build` clean  all routes generated for en/zu/xh/af
- `npm run typecheck` clean
- POPIA primitives unit-testable (encryption round-trip, consent state machine, audit log writes)

---

## What Phase 0 left for later (by design)

- **Live Neon connection**  Phase 2 (`PHASE_2_PLAN.md` carries the bootstrap commands)
- **Real audit-log persistence**  Phase 2 (ring buffer is the dev tail)
- **Encryption key rotation**  Phase 9
- **POPIA cross-border posture**  documented as a Phase 9 milestone (migrate to AWS Cape Town `af-south-1` on Docker)
