# Phase 3 — Live Smoke Test (Profile CRUD + Storage)

> Run after the Phase 2 smoke passes. Every box ticked = Phase 3 verifiably works end-to-end against the live Neon DB + Supabase bucket.

---

## 0 · Pre-flight

```bash
npm run dev
```

In Supabase Dashboard → Storage, confirm:
- Bucket `sebenza-private` exists
- **Public** column shows the bucket is **OFF** (private)

Then open `http://localhost:3000/sign-in` and log in as **Andile** (`andile-z@example.co.za` / `sebenza-dev-2026`).

---

## 1 · Profile basics save round-trips

1. Visit `/dashboard/profile`
2. In the **Identity basics** section, change the **Display name** to e.g. `Andile Z. (test)` → click **Save changes**
3. Page reloads with the new value showing
4. Refresh — value still there
5. In **Location**, change Province → city dropdown updates → click Save → reloads with new city
6. In **Professional**, edit the **bio** to something obviously different (>40 chars to bump completeness) → Save
7. Look at the completeness number — should reflect the new bio
8. Visit `/admin/audit-log` (sign out, sign in as Admin) — you should see `profile.update` rows for each save

✅:
- ☐ Each save persists across reload
- ☐ Completeness updates after bio edit
- ☐ `profile.update` events appear in audit log

---

## 2 · Skills (controlled-vocab + replace-on-save)

1. As Andile, visit `/dashboard/profile` → scroll to the **Skills** section
2. Click an X next to one existing skill → it disappears
3. Pick a new skill from the dropdown → click **Add** → it appears
4. Click some proficiency dots to change levels
5. Click **Save skills**
6. Reload — the skills state is exactly what you set
7. Audit log shows `profile.skills.update`

✅:
- ☐ Add / remove + proficiency change all hold across reload
- ☐ Catalog-only constraint: only the dropdown skills can be added (no free text)

---

## 3 · National ID — encrypted, never echoed back

1. As Andile, visit `/dashboard/profile` → scroll to **National ID**
2. If ID already on file: shows "ID number on file · encrypted, never shown back"
3. Click **Change**
4. Try entering a deliberately wrong number (e.g. `1234567890123`) → should fail with "Checksum doesn't match"
5. Enter a valid SA ID (any well-formed 13-digit number that passes Luhn — e.g. `9001015009087` is a known valid test format)
6. Click **Save & encrypt** → returns to the "on file" view; **the value is never displayed back**
7. Audit log: `profile.national_id.update`

8. Click **Remove** → confirm → ID disappears from "on file" view
9. Audit log: `profile.national_id.remove`

10. (Optional) Verify with `npm run db:studio`: open the `profiles` table → `national_id_enc` column. After step 6 it carries a `v1.` prefixed base64 blob. After step 8 it's `null`.

✅:
- ☐ Bad checksum rejected with clear error
- ☐ Valid ID saves and is encrypted (visible in db:studio as `v1.<base64>`)
- ☐ Remove clears the cell
- ☐ Both events show in audit log

---

## 4 · Status engine + nudge banner

This needs a stale-status seeded profile to actually see the banner. Easiest path:

1. Sign in as **Sipho K.** (`sipho-k@example.co.za` / `sebenza-dev-2026`) — the seed sets his status confirmed in Jan 2026, so against today (2026-05-22) he's ~130 days stale
2. Visit `/dashboard` — you should see the **red urgent banner** at the top: "It's been 127 days…"
3. Click **Yes, still accurate** in the banner → banner disappears, Talent Pulse card shows "fresh"
4. Audit log: `profile.status.reconfirm`

5. Now click **Update** in the Talent Pulse card → status picker opens
6. Pick a different status → it saves immediately → card re-renders with the new state + fresh band
7. Audit log: `profile.status.update`

For Andile (statusConfirmedAt set to ~10 days ago in the seed), the banner won't show — he's fresh. That's the correct behaviour.

✅:
- ☐ Stale profile shows red banner with day count
- ☐ "Yes still accurate" flips to fresh and dismisses banner
- ☐ Status change persists; audit log records both reconfirm and change

---

## 5 · Experience CRUD

1. As Andile, visit `/dashboard/experience`
2. Click **Add** → form appears
3. Fill: Role / Organisation / City / Started (YYYY-MM) / Description; toggle **Current role**
4. Click **Add role** → it appears at the top of the list
5. Click the pencil on a row → form pre-fills → change something → **Save changes** → row updates
6. Click the trash icon on a row → confirm via the action → row disappears
7. Audit log: `profile.experience.add`, `profile.experience.update`, `profile.experience.delete`

8. Try end-date earlier than start-date → form rejects "End date can't be before the start date"

✅:
- ☐ Add / edit / delete all persist across reload
- ☐ Date-order validation kicks in
- ☐ Three audit-log kinds visible

---

## 6 · Qualifications + document upload

1. As Andile, visit `/dashboard/qualifications`
2. Click **Add** → fill Title / Institution / Year → **Add**
3. Row appears with badge **unverified** and no "Document on file" indicator
4. Click the **Upload** button on the new row → pick a PDF (or JPEG/PNG) up to 10 MB
5. Spinner shows briefly → badge flips to **pending** + "Document on file" indicator appears
6. Audit log: `profile.qualification.add`, `profile.qualification.document.upload`

7. In Supabase Dashboard → Storage → `sebenza-private` → navigate `<your-user-id>/documents/` — your file is there
8. Click the row's **Replace** button → upload a different file → old object cleaned up; new key on the row

9. Try uploading a file >10 MB → rejected client-side won't even POST; server-side: "File is larger than 10 MB."
10. Rename a `.pdf` to `.jpg` and try to upload as a JPEG → rejected: "Mismatched file content — please re-upload." (magic-byte sniff catches it)

11. Click trash → row deletes; Supabase object cleaned up best-effort

✅:
- ☐ Upload succeeds; bucket shows the file
- ☐ Badge flips unverified → pending after upload
- ☐ Replace works; old file gone
- ☐ Size + type + content-mismatch all rejected
- ☐ Delete removes both row and storage object

---

## 7 · Profile photo upload

1. As Andile, visit `/dashboard/profile` → top **Photo** section
2. Click **Upload photo** → pick any JPEG/PNG/WebP (any size — it'll be downsized client-side to 512 px)
3. Avatar preview updates immediately; brief "Uploading…" state
4. Refresh — photo is still there (signed URL is freshly minted)
5. Supabase Storage → `<your-user-id>/photos/avatar.jpg` exists
6. Click **Change photo** → pick a different image → old object swapped
7. Click **Remove** → avatar reverts to initials; bucket object cleaned up
8. Audit log: `profile.photo.upload` and `profile.photo.remove`

✅:
- ☐ Upload works; photo renders on the editor
- ☐ Resize-to-512 visible in the network tab (request body is much smaller than the original picked file)
- ☐ Change + Remove both work
- ☐ Two audit-log kinds visible

---

## 8 · Sanity tail

- ☐ `npm run typecheck` clean
- ☐ `npm run build` clean
- ☐ Mobile view (360 px) of `/dashboard/qualifications` and `/dashboard/experience` — no horizontal scroll, tap targets ≥44 px
- ☐ Sign out works from sidebar AND mobile top strip (from Phase 2 polish)

---

## When every box ticks

Tell Claude **"Phase 3 smoke passes"**. I'll then commit with `Phase 3 complete + Phase 4 opens` per the convention.

---

## If something fails

- **"Supabase Storage isn't configured"** — check `.env.local` has both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; restart dev server (env vars only re-read on boot)
- **"new row violates row-level security policy"** — you pasted the anon key instead of the service-role key. Decode the JWT payload; if `role: anon`, swap for the service_role key from Supabase Dashboard → Project Settings → API
- **Upload succeeds but bucket is empty** — confirm `SUPABASE_STORAGE_BUCKET=sebenza-private` matches the bucket name you created
- **"File is larger than 10 MB" on a small file** — check the browser's network tab; some encodings (PNG of a photo) blow up to >10 MB even when the picked file looked smaller. Re-export as JPEG.
- **Status banner doesn't show as expected** — bands are date-driven; if you're running this in May 2026 and your seed timestamps were set further back, the math may already put everyone at stale. The seed is dated relative to Andile being ~10 days fresh and Sipho being ~130 days stale on 2026-05-22.
- **Audit-log page is empty** — `recentAuditEventsFromDb()` reads from the `audit_log` table; if you wiped the DB between phases, prior events are gone. Trigger fresh events by editing your profile.
