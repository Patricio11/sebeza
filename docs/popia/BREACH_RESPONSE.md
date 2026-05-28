# Breach response runbook

> POPIA Section 22 requires notification of the Information Regulator
> and affected data subjects "as soon as reasonably possible" after a
> breach involving personal information. This runbook is what we follow
> when that happens.

Last updated 2026-05-23.

---

## What counts as a breach

Any of the following, suspected or confirmed:

1. Unauthorised access to the database or a user account.
2. Leak of national ID ciphertext together with the encryption key.
3. Misconfigured Supabase Storage bucket exposing private documents.
4. A privileged employee credentials being phished or stolen.
5. A sub-processor (Neon, Supabase, Resend, KYC SaaS) disclosing a
   breach that touches our data.

A near-miss (caught before exfiltration) is NOT a notifiable breach but
is documented in this folder all the same.

---

## Containment (first 60 minutes)

1. **Stop the bleed.** If a credential is compromised, rotate it
   immediately. Revoke the affected user's session via
   `auth.api.signOut` on every device. Suspend an exposed admin via
   `suspendUser`.
2. **Snapshot the audit log.** `SELECT * FROM audit_log WHERE at >
   <suspected start>` → write to a separate location for the forensic
   timeline. Do not let the rolling retention prune it.
3. **Page the Information Officer.** Phone, not email. They own the
   external comms decision.
4. **Confirm the boundary.** Is it our infrastructure or a sub-
   processor? Different notification paths.

## Assessment (first 24 hours)

1. **What was disclosed?** Read the audit log + Sentry + the
   sub-processor's incident report. Categorise:
   - Identifying data (name + email + handle)
   - Special-category (national ID, qualification documents)
   - Aggregated only (no individual recovery possible)
2. **How many subjects?** Count distinct profile_ids in the disclosed
   audit rows.
3. **Materiality assessment.** Per POPIA, notification is required if
   the breach is likely to result in harm. Document the assessment in a
   timestamped file in `docs/popia/incidents/<YYYY-MM-DD>-summary.md`.

## Notification (within 72 hours of confirmed materiality)

1. **Information Regulator**  Form for breach notification published by
   the Regulator. Submit electronically. Reference incident ID + scope.
2. **Affected data subjects**  direct email via the existing transport
   (`lib/email/send.ts`). Template at the bottom of this file. Plain
   language, no PR padding. Include: what happened, what data, what
   we've done, what they should do, who to contact.
3. **Public-surface note**  if material to ALL users (e.g. service-
   wide credential rotation needed), banner on the landing page until
   the incident is closed.

## Recovery + post-mortem

1. Force a password reset for affected users.
2. Revoke + reissue every secret in `.env.example` for production.
3. Write a public post-mortem within 30 days describing what happened
   and what we changed. Link from the Privacy Policy footer.
4. Update this runbook with whatever the incident taught us.

---

## Notification template (data subject)

> Subject: Important  there was a security incident at Sebenza
>
> Hi {{name}},
>
> On {{date}} we detected unauthorised access to a Sebenza system that
> contained the following information about you: {{scope}}.
>
> We have already: {{containment actions}}.
>
> You should: {{recommended actions  likely reset your password and
> review your audit log at /dashboard/activity}}.
>
> We have notified the Information Regulator. The incident reference is
> {{incident_id}}.
>
> If you have questions, reply to this email or write to
> popia@sebenzasa.com. Our Information Officer responds within 5
> business days.
