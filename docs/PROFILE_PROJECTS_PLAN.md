# Work & projects on the seeker profile (2026-08-19)

**Founder ask:** seekers show what they've actually built or done. A link (a system, a
portfolio, published work) AND/OR photos (a welder's finished job, a chef's plate), each
with a **contribution note** in their own words ("I did the backend", "I was part of a
four-person team"). Adaptive empty-state copy per profession so it lands for non-technical
users too.

**Decided (founder + Claude):**
- Projects **never** count toward completeness or ranking. A domestic worker or security
  officer often has no shareable link; rewarding links would push exactly the people we
  exist to serve further down the results. Projects persuade a human reader, not the sort.
- Self-declared, labelled as such. NEVER a verified badge (Verification-Honesty).
- Images ride the existing WebP pipeline: re-encoded, EXIF/GPS stripped, capped, plus the
  256px thumb. **Max 5 images per project**, max 6 projects.
- **No link previews / og:image fetching**  SSRF vector + page weight (No-Flash).
- Link scheme allow-list: http(s) ONLY. `javascript:`/`data:` blocked; `mailto:`/`tel:`
  blocked too because they bypass the audited contact-reveal flow.
- The contribution note is PII-screened (phone/email shapes refused) for the same reason.
- Ships dark behind `feature_flag_seeker_projects`.

## TASKS
- [x] Migration 0070: `profile_projects` (+ image_keys text[]); schema; apply test + LIVE
- [x] Settings flag `feature_flag_seeker_projects` (union + DEFAULTS + validator + enum)
- [x] Upload: `project-images` kind through the WebP branch (thumb + sweep on delete)
- [x] `lib/profile/projects.ts`  add/update/delete/reorder + addImage/removeImage, all
      guard-first, capped, audited (`profile.project.*`); link + note validation in
      `lib/profile/project-links.ts` (pure, unit-tested)
- [x] Adaptive empty-state hint by profession (pure fn + unit test)
- [x] `ProjectsEditor` on /dashboard/profile (flag-gated)
- [x] Public profile `/p/[handle]` section + employer dossier section (thumbs, hostname
      shown, nofollow/noopener, self-declared label)
- [x] Tests: link/note validation, caps, image sweep, public payload shape
- [x] E2E visual walk + screenshots; docs + memory

## VERIFY
- [x] Flag OFF: nothing renders, actions refuse
- [x] Flag ON: add project w/ link + note + 2 images; renders on editor, public profile,
      dossier; images are WebP with thumbs; delete sweeps storage
- [x] Blocked schemes + PII notes refused with friendly copy
- [ ] role-arcs + admin-smoke green desktop + 360px
