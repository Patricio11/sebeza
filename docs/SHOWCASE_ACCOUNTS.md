# SHOWCASE ACCOUNTS  log in and see everything working

*Seeded by `db:seed` (Phase 23.6). Every account's password is the seed password:*
**`sebenza-dev-2026`** *(dev/test only  never a production credential).*

| Role | Email | What you'll see |
|---|---|---|
| **Seeker (student flagship)** | `andile-z@example.co.za` | Complete profile (Johannesburg · BSc CS @ Wits, final year); "Who's viewed you" with real Discovery Bank views; Career Compass with live demand recommendations + the **real** student lane (live programmes, curriculum-vs-market, **real destinations from 11 confirmed cohort placements**); learning loop with one item **in progress at 50%** + one accepted; **2 earned badges**; outcomes-research consent granted (city hotspots demo when `feature_flag_city_demand` is on). |
| **Seeker (senior flagship)** | `lerato-n@example.co.za` | Senior Software Developer (Gauteng)  full skills+years, experience, qualifications, pool rank, badge (90-day status streak). |
| **Seeker (feedback story)** | `wits-bsc-cs-2026-06@example.co.za` | Was invited to the Graduate Programme vacancy (with `vacancy_matching` consent), accepted, **wasn't selected**  the honest `vacancy.outcome.other-hired` feedback notification is in their bell, linking to the Career Compass. |
| **Employer** | `naledi.khumalo@discovery.co.za` | Verified org (Discovery Bank) with the full vacancy lifecycle: **2 open vacancies** (live invites in every state: invited / accepted / declined / accepted-with-notice / expired) + **1 FILLED vacancy** ("Graduate Software Developer Programme") with the three hired seekers' confirmed placements linked and the not-hired invitees notified. Placements ledger, saved searches, shortlists, team. |
| **Admin** | `admin@sebenzasa.com` | Everything: verification queue, moderation, taxonomy (+ custom-skills promotion), learning-path editorial + freshness rail, crisis resources, LLM providers + AI-coach switch, settings (all feature flags), audit + oversight logs. |

## Feature flags worth flipping for a full demo (`/admin/settings`)
All default OFF (ship-dark). Flip ON to see: `feature_flag_seeker_skill_journey` (The Climb 
andile's 50% progress + rank payoff), `feature_flag_seeker_demand_pulse`, `feature_flag_living_catalog`
(path reviews), `feature_flag_seeker_custom_skills`, `feature_flag_skill_prereqs` ("Requires:" pills +
Unlocks-next), `feature_flag_city_demand` (andile's Johannesburg hotspots). The AI coach
(`feature_flag_seeker_ai_coach`) is **safety-ack gated on `/admin/llm`**  see
`docs/PHASE_22_AI_COACH_SAFETY_PLAN.md` before enabling anywhere real.

## Honesty notes
- The destinations table on andile's student lane is computed from **real seeded
  employer-confirmed placements** (11 across the Wits cohort  above the k-floor of 10).
- The not-hired feedback notification mirrors the real Phase-9.11 outcome fan-out copy.
- Nothing in the showcase is rendered from constants at runtime; it's all rows in Postgres.
