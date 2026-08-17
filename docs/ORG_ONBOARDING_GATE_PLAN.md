# Org onboarding gate + admin-managed document requirements

**Founder decisions (2026-08-17), inspired by the SRS/Seairo KYC blueprint
(`ONBOARDING_KYC_BLUEPRINT.md` in the srs repo):**

1. Employers/recruiters never reach the workspace until their organisation is
   approved: the whole workspace is hard-gated to `/employer/onboarding`.
2. The registration pipeline is trackable in admin end to end: email verified →
   onboarding submitted (pending review) → approved/rejected. (Already true on
   /admin/verifications → Organisations: Drafts carry the owner's
   email-verified state, then Pending / Rejected / Verified groups.)
3. On approval the whole team gets a branded email with a sign-in CTA.
4. **The admin configures which documents an org must upload** (SRS locked
   decision: "Required docs hardcoded? No - admin-managed table. Different
   jurisdictions, different document sets. Hardcoding traps you.")
5. Full email fan-out (SRS pattern): submission confirmation to the owner,
   out-of-band alert to admins, rejection with reason, request-changes with
   the admin note.

Out of scope for v1 (bolt-ons later, per the blueprint): fillable templates
per requirement, periodic re-vetting, document expiry flags.

## TASKS

- [x] `(workspace)` route group: dashboard/dossier/vacancies/invites/
      placements/shortlists/saved-searches/organisation/team moved inside;
      gate layout redirects any non-verified org to /employer/onboarding.
      Onboarding, account, notifications, help stay reachable.
- [x] `org.verified` email (all active members, CTA "Sign in to your
      workspace") wired into approveOrg.
- [x] Migration 0066: `org_document_requirements` (name, description,
      required, sort_order, active) seeded with the four current SA-standard
      documents; `organization_documents.requirement_id` added + backfilled
      from the legacy enum kinds.
- [x] Admin CRUD actions (`lib/admin/org-requirements.ts`): list, save
      (create/edit), toggle active, reorder. Audited
      (`org.requirements.update`), verifyAdmin-guarded.
- [x] Admin UI: "Documents orgs must upload" manager on
      /admin/verifications?tab=organisations.
- [x] Onboarding form renders upload slots FROM the configured requirements
      (required badge + helper text); submit validates every active required
      requirement has a document; "other" stays as the optional extra slot.
- [x] Review modal labels documents by requirement name (legacy enum label
      fallback).
- [x] Email fan-out: submission confirmation (owner), admin alert (all
      admins), rejected (reason), changes requested (note).

## VERIFY

- [x] Typecheck + full unit suite green.
- [x] Migration applies clean on the Docker test DB and on live Neon.
- [x] Harness walk: unverified owner signs in → lands on onboarding (direct
      /employer/vacancies hit also bounces); admin adds a requirement → new
      slot appears on the onboarding form; admin approves → org.verified
      email visible on the console transport → owner reaches the dashboard.
- [x] E2E: role-arcs (unverified-org arc) + admin-smoke green.
