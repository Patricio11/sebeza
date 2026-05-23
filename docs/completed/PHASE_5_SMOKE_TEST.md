# Phase 5 — Live Smoke Test (Employer Portal)

> Run against your live Neon DB + Supabase bucket. Sign in as Naledi (Discovery Bank, verified org).

---

## 0 · Pre-flight

```bash
npm run dev
```

Sign in as Naledi: `naledi.khumalo@discovery.co.za` / `sebenza-dev-2026` → lands on `/employer`.

---

## 1 · Dossier reveal flow

1. From `/employer` overview, click "Open dossier" on Lerato N.
2. URL: `/employer/dossier/lerato-n`
3. Right rail shows **ContactRevealCard** in the "Contact available" state (consent on file from seed)
4. Click **Reveal contact** → email surfaces with the "Audit-logged" indicator
5. Sign in as Admin in another tab, visit `/admin/audit-log` → `profile.contact.reveal` row with `subject = prof_lerato-n`, `actor = user_naledi-k`, `meta.orgId = org_discovery-bank`
6. Sign in as Lerato (`lerato-n@example.co.za` / `sebenza-dev-2026`), visit `/dashboard/activity` → row shows "Contact details revealed (consent v2.1 on file)"

✅:
- ☐ Reveal succeeds; email shown
- ☐ Audit row visible to admin
- ☐ Seeker sees reveal in their activity ledger
- ☐ Reload `/employer/dossier/lerato-n` — contact card stays in "revealed" state (cached from prior reveal)

---

## 2 · Reveal block when consent revoked

1. As Lerato, `/dashboard/privacy` → toggle `Contact reveal` to revoked
2. Sign back in as Naledi, open `/employer/dossier/lerato-n` in a new tab
3. The card now shows **"Contact withheld"** with the lock icon
4. The "Reveal contact" button is disabled

✅:
- ☐ Disabled state + honest explanation
- ☐ Prior reveal still visible (audit history doesn't disappear; the cache may still show the cached value — fine)

---

## 3 · Document download (audited)

1. As Lerato, `/dashboard/qualifications` → upload a PDF for a verified qualification (or use seed-verified one)
2. As Naledi, `/employer/dossier/lerato-n` → qualifications section shows a "Download" button next to each verified row that has a file
3. Click Download → opens the PDF in a new tab (signed URL, 60s TTL)
4. Admin's `/admin/audit-log` → `profile.document.download` row with `meta.qualificationId` + `meta.title`
5. Revoke `document_sharing` consent in Lerato's `/dashboard/privacy` → reload dossier → buttons flip to "Withheld" chip

✅:
- ☐ Download streams the PDF
- ☐ Audit row exists
- ☐ Withheld state when consent revoked

---

## 4 · Mark as hired (Placement-Truth gate)

1. As Naledi on `/employer/dossier/lerato-n`, scroll to **Mark as hired** card
2. Card shows the form (because of the prior reveal in the last 30 days)
3. Fill role + city + date → Confirm hire
4. Card flips to "Hire logged" receipt
5. Visit `/employer/placements` → row appears with the candidate + role + city + delete button
6. Visit `/insights` (may take 5 min for ISR refresh, or trigger by hitting the URL) → confirmed-hires count bumps by 1
7. Admin audit log shows `placement.confirm`

8. **Gate test:** Open `/employer/dossier/sipho-k` (you've never revealed Sipho). Mark-as-hired card should show the disabled state with copy "You need to reveal this candidate's contact within the last 30 days before logging a hire."

✅:
- ☐ Hire logs successfully after a reveal
- ☐ Receipt card shows
- ☐ `/employer/placements` shows the new row
- ☐ `/insights` confirmed-hires increments
- ☐ Gate blocks marking a hire without a prior reveal

---

## 5 · Delete placement

1. `/employer/placements` → click trash icon on a placement
2. Confirm in the browser dialog
3. Row disappears; `/insights` count drops back

✅:
- ☐ Placement deleted + audit row written
- ☐ Insights count reflects the delete

---

## 6 · Saved searches CRUD

1. `/employer/saved-searches` → click "Save a search"
2. Name: "Developers in Gauteng", query: `developer`, province: `gauteng` → Save
3. Row appears with `1 match` (or whatever the live search returns)
4. Click the refresh button → count updates
5. Click "Run search →" → navigates to `/search?query=developer&province=gauteng` with the saved filters applied
6. Click trash → confirm → row disappears

✅:
- ☐ Create + run + delete all work
- ☐ Run search link applies the filters on /search

---

## 7 · Shortlist pools CRUD

1. `/employer/shortlists` → "New pool"
2. Name: "Q3 engineering hires", description: "Senior dev candidates for the Sandton office"
3. Pool appears with `0` members + "No members yet" empty state
4. Delete pool → confirm → row disappears

For now adding members happens from the dossier in a Phase 5 follow-up; for the smoke we can prove the round-trip with the `addToPool` server action directly via `db:studio` if needed. The pool CRUD itself is verified.

✅:
- ☐ Create + delete pool round-trip
- ☐ Empty-state copy is honest

---

## 8 · Org verification gate

1. As Admin, in `npm run db:studio`, flip `organizations.verification` for Discovery Bank → `unverified`
2. Sign in as Naledi → click any dossier link
3. Should redirect to `/employer/organisation` (verifyOrgVerified bounces)
4. Flip back to `verified` in db:studio → reload dossier → works

✅:
- ☐ Unverified org bounces from dossier
- ☐ Verified org can reveal

---

## 9 · Sanity tail

- ☐ `npm run typecheck` clean
- ☐ `npm run build` clean — `/employer/dossier/[handle]` shows ƒ dynamic
- ☐ All 8 employer routes accessible only to verified employer or admin
- ☐ Mobile 360px: dossier right-rail stacks below the main column; all action cards readable

---

## When every box ticks

Phase 5 is verified end-to-end. Phase 6 (analytics + skills-gap engine) opens.

---

## If something fails

- **Reveal returns "no organisation membership"** — Naledi's `organization_members` row is missing or her `verification` flag on the org is `unverified`. Check via `db:studio`.
- **`audit_log` rows don't appear in `/admin/audit-log`** — admin page reads `recentAuditEventsFromDb`; check the table directly in `db:studio` to confirm the rows exist.
- **`/insights` doesn't update after placement** — ISR runs every 5 min, or trigger refresh by visiting the URL after the revalidate window. You can also restart the dev server to force.
- **Download button does nothing** — open browser console; the signed URL might have failed if Supabase isn't configured. Check `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
- **"Mark as hired" gate too strict** — gate is 30 days; if you tested across a date boundary or seeded an old reveal, may not trigger. Make a fresh reveal first.
