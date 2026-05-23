@AGENTS.md

# Sebenza  agent context

**Working name:** Sebenza · South African National Talent-Intelligence Platform.
**Companion docs (read together, always):**
- `../TO_START_EVERY_SESSION.md`  non-negotiable rules + tone.
- `../ROADMAP.md`  phased build plan (Phase 0 → deployment).
- `../UX_UI_SPEC.md`  design system, screen-by-screen, mock-data layer.

Phase 1 is built. Mock-driven, clickable end-to-end at `/`, `/search`, `/p/[handle]`, `/dashboard`, `/employer`, `/insights`, `/admin`.

## Non-negotiable rules (summary  full text in `../TO_START_EVERY_SESSION.md`)
1. **No-Flash.** Works on a low-end Android over 3G. JS budget ~150KB on key routes. No 3D, no heavy animation.
2. **Location-Not-Nationality.** Talent is matched by residence + skill. Nationality is shown, never a gate.
3. **POPIA-First.** Consents, audit log, field-level encryption, soft-delete from commit one.
4. **Redaction.** Public/search payloads never include IDs, documents, raw contact. `PublicProfile` type enforces this.
5. **Verification-Honesty.** Default is `unverified`. Badges reflect reality  never lie.
6. **Status-Freshness.** Stale statuses (≥90d) are down-ranked in search and flagged in analytics.
7. **Placement-Truth.** A hire is counted only when confirmed via the platform.

## Aesthetic  "Civic Editorial"
Quiet authority of a national institution, warmth of a great editorial product. Fraunces (display) × Hanken Grotesk (body). Warm paper/ink palette + institutional teal brand + one warm ochre accent. **Not** a SaaS card-grid look. Editorial layouts, thick rules, all-caps eyebrows with tracking, DataSpine rails, ordinal pillars, Fraunces tabular numerals. The **Talent Pulse** glyph (status + freshness ring) is the recurring visual signature.

## Stack (pinned)
- Next.js 16.2.6 (App Router, no `src` dir, Turbopack).
- React 19.2.4 · TypeScript strict (+ `noUncheckedIndexedAccess`).
- Tailwind v4 (design tokens in `app/globals.css` via `@theme`).
- next-intl 4.12 (`app/[locale]/...`, `proxy.ts` middleware, deep-merge fallback to English).
- Drizzle ORM 0.36 + Neon serverless (schema present, not yet connected).
- Recharts 3.8 (insights only; client-island, mount-gated to dodge SSR sizing).
- Lucide icons. clsx + tailwind-merge for `cn()`.

## Architecture seams
- **`lib/data/provider.ts`** is THE seam. Phase 1 reads `mockProvider`; Phase 4 flips to `dbProvider` against the same interface. Pages do not change.
- **`lib/audit/logAccess()`** must wrap every PII-touching code path. Already wired into search + profile-view in the mock provider.
- **`lib/auth/guard.ts`** stubs `requireRole()` / `requireOrgVerified()`. Better Auth replaces the stubs in Phase 2; signatures stay stable.
- **`lib/crypto/`** AES-256-GCM with key-id prefix for future rotation. Keys in env (Phase 1) → KMS (Phase 8/9).
- **`db/schema.ts`** mirrors what `lib/mock/types.ts` exposes. Keep them aligned.

## i18n
- Routing locales: `en` (base), `zu`, `xh`, `af` (Tier 1 launch).
- Tier 2/3 listed in `lib/i18n/config.ts` comments; enable in `i18n/routing.ts` when professional translations land.
- **Never machine-translate POPIA / consent / legal copy.** `messages/{zu,xh,af}.json` are stubs marked `__notice`; missing keys fall back to `en` via `i18n/request.ts` deepMerge.

## Commands
```bash
npm run dev        # local dev (Turbopack)
npm run build      # production build (all 27 static pages)
npm run start      # serve build
npm run typecheck  # tsc --noEmit
npm run lint
```

## Environment variables (see `.env.example`)
- `SEBENZA_DATA_PROVIDER`  `mock` (default) or `db`.
- `DATABASE_URL`  Neon Postgres connection string (Phase 4+).
- `SEBENZA_ENCRYPTION_KEY`  base64, 32 bytes. Required as soon as real PII is written.

## When in doubt
Rule wins over instinct. If a "wow factor" instinct conflicts with No-Flash or POPIA-First, the rule wins. Read `../TO_START_EVERY_SESSION.md` again.
