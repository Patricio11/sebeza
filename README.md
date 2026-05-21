# Sebenza

South Africa's talent-intelligence platform — a fast, accessible, POPIA-compliant
search and analytics surface for matching people to work by skill and location.

> The trustworthy, real-time layer ESSA never had.

This is the **Phase 1** build: clickable end-to-end on mock data. Backend slots in
behind a typed `dataProvider` seam — see [lib/data/provider.ts](lib/data/provider.ts).

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (27 static pages across 4 locales)
npm run typecheck
```

## What's in here

| Surface | Route | Status |
|---|---|---|
| Landing (editorial hero + national pulse) | `/` | mock |
| Talent search (filters + roster) | `/search` | mock |
| Public profile (civic dossier, redacted) | `/p/[handle]` | mock |
| Seeker dashboard (Talent Pulse confirm) | `/dashboard` | mock |
| Employer portal (saved searches, hires) | `/employer` | mock |
| Insights (analytics + skills gap) | `/insights` | mock |
| Admin (audit log viewer) | `/admin` | partial |

All routes are localised at `/[locale]/...` for `en`, `zu`, `xh`, `af`. Non-English
catalogs are placeholders pending professional translation — never machine-translate
POPIA / consent / legal copy.

## Documentation

The three documents in the parent directory are load-bearing:

1. **`../TO_START_EVERY_SESSION.md`** — non-negotiable rules and tone.
2. **`../ROADMAP.md`** — the phased build plan.
3. **`../UX_UI_SPEC.md`** — design system + screen-by-screen UX.

Read them together. Every architectural choice in this repo traces back to one
of those documents. See also [CLAUDE.md](CLAUDE.md) for a per-session brief.

## License & data residency

Privacy Policy + PAIA manual must be published before any real users are onboarded.
Confirm Neon region and document POPIA cross-border posture (ROADMAP Task 0.1)
before flipping `SEBENZA_DATA_PROVIDER=db`.
