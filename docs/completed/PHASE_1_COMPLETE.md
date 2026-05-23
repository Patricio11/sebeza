# Phase 1  Public face & search · ✅ COMPLETE

**Shipped:** 2026-05-21
**Goal at the start:** A national platform that demos end-to-end  *clickable, mock-driven, production-grade UI*.

---

## What shipped

### Task 1.1  Landing page (`/`)
- Clear value prop: "Find skilled people. Near you. For real."
- One prominent hero search bar (profession + location)  no 3D, no hero video
- Live national-pulse strip: active profiles · confirmed hires · skills tracked, with freshness-confidence chip
- Trust strip: POPIA-first / WCAG 2.2 AA / Works on 3G / 4 launch languages
- Dual CTA: Find talent (employer) · Get started (seeker) + a government insights panel

### Task 1.2  Search (`/search`)
- Profession + location autocomplete from the controlled taxonomy
- Filters: skill, location (province → city), employment status, seniority, verification level, optional nationality highlight
- Editorial talent roster (not a card grid) with status chip + freshness + verification + completeness
- Ranking: text relevance × status confidence × completeness × optional citizen highlight
  - Implemented in `lib/mock/helpers.rankProfiles`  mirrors the SQL Phase 4 will use
- **Redaction enforced at the type layer**  `PublicProfile` literally cannot expose IDs, documents, or contact details
- Mobile-first results; skeleton loading; data-light pagination

### Task 1.3  Public profile (`/p/[handle]`)
- Read-only "civic dossier" layout: headline · skills · experience timeline · qualifications · gated panels
- Documents + contact gated behind `verified employer + consent + audit log`  "Recorded access" panels render where the gate sits
- "Report profile" affordance (will feed the Phase 7 moderation queue)

---

## Verification at the time of shipping

- `npm run build` clean  27 static pages × 4 locales = 108 pre-rendered HTML files
- Every route returned 200 under `next start`
- Mock-data ranking matched the Phase 4 SQL contract (verified by `rankProfiles` unit test)
- A11y: keyboard nav through search → result → profile worked; status chips carry text + ARIA, never colour-only

---

## What Phase 1 left for later (by design)

- **Real search backend**  Phase 4 swaps `mockProvider` for `dbProvider` using Postgres FTS + `pg_trgm`
- **Real reveal flow**  Phase 5 wires the "Request contact reveal" button on the profile page
- **Real `searchEvents` capture**  Phase 6 turns the captured queries into the skills-gap signal
- **Public insights aggregation layer**  Phase 6 materialises views; mock data feeds the demo until then
