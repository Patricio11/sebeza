# Post-launch backlog

*Opened during Phase 10 (PHASE_10_LAUNCH_PLAN.md). The "things we deliberately did not build before public launch" collection.*

> **The fence**: Phase 10 is polish + audit + go-live. Feature requests that arrive during Phase 10 land here, not in main. Phase 11+ pulls from this list.

---

## How to add an item

Pick the right section. Each item gets:

```
- **Title**  one-line description. _(Origin: who asked, where, when. Optional)_
  Details if needed (1-3 sentences). Link to plan / decision doc if applicable.
```

Keep entries terse  this is a triage list, not a spec.

---

## Quick wins (small, high-leverage)

> Sub-half-day items that could ship as a small Phase 11.x point release.

- _empty for now  add as they arrive_

---

## Accessibility automation

> The Phase 10.5 audit (`A11Y_AUDIT.md`) ships with static scan + manual screen-reader passes; the automated runtime layer is deferred for capacity reasons.

- **Playwright + `@axe-core/playwright` a11y suite**  one spec per route group (`public`, `seeker`, `employer`, `admin`, `gov`); per-test pattern is `new AxeBuilder({ page }).analyze()` against `npm run build && npm run start`, asserting zero serious / critical violations. Setup is `npm i -D @playwright/test @axe-core/playwright && npx playwright install --with-deps chromium`. Land when there's a person to write + maintain the suite; the static + manual layers cover the audit floor until then.

---

## Trust + safety follow-ups

> POPIA, moderation, audit  things that ladder up to the trust posture.

- **Skill suggestion auto-notify**  when admin promotes a skill, fire a `taxonomy.promoted` notification to the user who originally submitted it so they can re-add it to their profile / vacancy. _(Phase 10 ship: skill suggestions land but submitters aren't notified on promotion; they discover it via the picker next time they edit.)_
- **Pending-skill backfill**  decide whether non-canonical "Other" skill submissions should persist to `profile_skills` / `vacancy.skill_slugs` with an `is_pending` flag (vs the current filter-at-save model). Tradeoff: simpler data model now (current) vs auto-recovery after admin promotion.

---

## Performance + scale

> Things to revisit if traffic patterns surprise us at launch.

- **Server-side full-text search**  the current `/search` filters use Postgres ILIKE. At scale this needs a proper FTS index; the `tsvector` columns already exist on profiles. Decide when to flip the query to FTS-first.
- **CDN edge config**  static assets cache fine via Next defaults; revisit if image-heavy public profiles see traffic spikes.

---

## Localisation expansion

> Phase 10.7 scaffolded Tier-2 / Tier-3 catalogs (`messages/{nso,tn,st,ts,ve,ss,nr,pt,fr,sw}.json`) with `__notice` markers. As professional human translations arrive, each crossing the readiness threshold (per `lib/i18n/config.ts:PENDING_LOCALES`) gets enabled in `i18n/routing.ts`.

- **Tier 2 rollout**  Sepedi, Setswana, Sesotho, Xitsonga, Tshivenda, siSwati, isiNdebele.
- **Tier 3 rollout**  Portuguese, French, Swahili.
- **RTL readiness**  not currently needed (none of the planned locales are RTL), but if Arabic / Persian ever join the roadmap, the `<html dir>` attribute logic in `app/[locale]/layout.tsx` becomes load-bearing.

---

## Help center expansion

> Phase 10.1-10.4 shipped four role-specific help centers (employer, seeker, admin, gov). The launch tasks live in Phase 10.5-10.11 (`PHASE_10_LAUNCH_PLAN.md`). Follow-ups:

- **Translation**  help articles are English-only at v1. Once Tier-2 / Tier-3 catalogs cross readiness, key articles (orientation, consent, POPIA rights) translate first.
- **Help-search analytics**  D8 in PHASE_10_1_COMPLETE.md deferred this. If support load patterns suggest the search isn't surfacing the right articles, add minimal anonymised search-query logging (with a privacy story).
- **"What's new"**  D7 in PHASE_10_1_COMPLETE.md deferred a changelog feed. Revisit if users start asking "what changed?".

---

## Operator / admin tooling

> Things that would make Sebenza staff's daily work smoother but don't ship at launch.

- **Skill suggestion bulk-promote**  if the skill-suggestion queue grows past 50 pending, a bulk-promote (or bulk-reject) action saves operator time vs the current per-row UI.
- **Audit log saved views**  saved filter combinations (e.g. "gov-employer-lookups this week") for repeat investigations.

---

## Data + analytics surface

> Gov + employer analytics surfaces ship at launch. Follow-ups:

- **Municipal-level analytics**  `/gov/municipalities` ships dormant in Phase 10; flips on once cell-counts cross the k-anonymity floor across most municipalities. See `content/help/gov/provincial-briefs/cities-coming-soon.tsx`.
- **Quarterly retention report**  the cron job that snapshots placement retention runs but the gov-facing artefact is not yet generated. Pending operator-side review of which timeframes to publish.

---

## Feature requests from users

> Filled in as launch traffic + user feedback arrive.

- _empty for now  add as they arrive_

---

*Maintainer note: keep this file short. Each section is one screen of triage; if a section grows past that, it's a sign the item deserves a real plan doc, not a backlog row.*
