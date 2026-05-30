# Sebenza Security Architecture

> Single source of truth for **how authentication and authorisation work** on Sebenza. Read this before touching `lib/auth/*`, adding a new protected page, or writing a Server Action.

Built per:
- [Next.js Authentication guide](https://nextjs.org/docs/app/guides/authentication) (canonical patterns: DAL + Server Components > middleware)
- [Better Auth Next.js integration](https://www.better-auth.com/docs/integrations/next) (explicit warning: `getSessionCookie` is NOT secure)

---

## TL;DR

Three layers, fail-closed:

| Layer | File(s) | Purpose | Security boundary? |
|---|---|---|---|
| 1  Edge proxy | `proxy.ts` | Bounce obvious-unauth requests to `/sign-in` fast (UX) | **No** |
| 2  Page DAL | `lib/auth/dal.ts` called from every protected page | Authoritative session validation | **Yes** |
| 3  Server Actions | Every action in `lib/profile/*`, `lib/auth/actions.ts` | Validate session before mutating | **Yes** |

**Layer 2 is the real gate.** Removing the proxy would not weaken security  it would just slow down the unauth redirect by one server roundtrip.

---

## Layer 1  Edge proxy (UX only)

`proxy.ts` runs at the Edge before any page render. It calls Better Auth's `getSessionCookie(request)` which **only checks for the cookie's presence  it does NOT validate it.** Better Auth's own docs put it bluntly:

> "THIS IS NOT SECURE! This is the recommended approach to optimistically redirect users."

We use it because:
- A POST to a protected route from a logged-out user gets bounced at the Edge in ~10 ms instead of running the full Server Component render.
- A user clicking a protected link without a session gets the sign-in page faster.

We do NOT use it because:
- A forged cookie sails right through (the Edge can't validate signatures without a DB lookup).
- Any code path that bypasses the proxy (RSC payloads, direct fetches) needs its own check.

So the proxy is a UX speedup, not a gate.

### Cookie name gotcha (don't repeat)

We tried `cookiePrefix: "sebenza"` in `lib/auth/server.ts` once. The proxy's `getSessionCookie(request)` (no opts) silently defaulted to `cookiePrefix = "better-auth"` and looked for the wrong cookie  every authenticated user was bounced back to `/sign-in` in an infinite loop.

**Fix:** dropped the custom prefix. We use Better Auth's defaults everywhere. If you ever re-introduce a custom prefix, you MUST pass `{ cookiePrefix }` to every `getSessionCookie` call.

---

## Layer 2  Page DAL (the real gate)

Every protected page calls one of these guards from [`lib/auth/dal.ts`](../lib/auth/dal.ts) **as the first line of the function body**, right after `setRequestLocale(locale)`:

| Guard | Use on | Behaviour on miss |
|---|---|---|
| `verifySession()` | Generic signed-in routes | `redirect("/sign-in")` |
| `verifyRole("seeker")` | `(seeker)/dashboard/*` | Wrong role → `redirect(roleHome)` |
| `verifyRole("employer")` | `(employer)/employer/*` (read-only org pages) | Wrong role → `redirect(roleHome)` |
| `verifyOrgVerified()` | Employer pages that reveal PII (Phase 5+) | Unverified org → `redirect("/employer/organisation")` |
| `verifyEmployer()` | Employer pages that need org context but tolerate unverified state | Returns `{ orgId?, verification? }` |
| `verifyAdmin()` | `(admin)/admin/*` | Wrong role → `redirect(roleHome)` |

### Why DAL, not `layout.tsx`

Next.js's own docs are explicit:

> "Due to Partial Rendering, be cautious when doing checks in Layouts as these don't re-render on navigation, meaning the user session won't be checked on every route change. Instead, you should do the checks close to your data source or the component that'll be conditionally rendered."

So **never** put `verifyRole()` in a `layout.tsx`. Always at the top of the page.

### Memoisation

`getSessionUser()` is wrapped in React's [`cache()`](https://react.dev/reference/react/cache). Multiple calls within the same render pass (a layout, a page, and a leaf component all checking session) hit Better Auth exactly once. Better Auth's own 5-min `cookieCache` further reduces DB roundtrips across requests.

### Pattern

```tsx
// app/[locale]/(admin)/admin/users/page.tsx
import { setRequestLocale } from "next-intl/server";
import { verifyAdmin } from "@/lib/auth/dal";

export default async function UsersPage({ params }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await verifyAdmin();          // ← the real gate
  // …everything below this line runs only for verified admins
}
```

### Adding a new protected page  checklist

1. **Add the guard** as the first awaited call after `setRequestLocale`.
2. **Pick the right one**: `verifyAdmin` / `verifyRole("seeker"|"employer")` / `verifyOrgVerified` for PII reveal.
3. **Don't trust client input**  even after the guard, validate IDs, scope queries to the session user's profile.
4. **Run the audit**: `npm run build` → confirm your route shows `ƒ` (dynamic), not `●` (static). Static pages bypass `verify*` entirely.

---

## Layer 3  Server Actions

Every Server Action is a public-facing endpoint  anyone with the action's signature can invoke it. From Next.js docs:

> "Treat Server Actions with the same security considerations as public-facing API endpoints, and verify if the user is allowed to perform a mutation."

### Pattern

```ts
"use server";
import { getSessionUser } from "@/lib/auth/dal";

export async function doSomething(input: Input): Promise<ActionResult> {
  const session = await getSessionUser();
  if (!session) return fail("Not signed in.");
  // …validate input via Zod, scope all DB writes to session.id
}
```

### Current coverage (verified)

- `lib/auth/actions.ts`  `signUpSeeker` / `signUpEmployer` / `signIn` / `signOut` / password reset are intentionally public (they're the auth flows); `revokeConsent` / `regrantConsent` check session via `auth.api.getSession()`.
- `lib/profile/actions.ts`  all 7 (`updateProfileBasics`, `updateSkills`, `setStatus`, `reconfirmStatus`, `changeNationalId`, `removeNationalId`) check session.
- `lib/profile/experience.ts`  all 3 (`addExperience`, `updateExperience`, `deleteExperience`) check session AND verify ownership via `ownedProfileId`.
- `lib/profile/qualifications.ts`  all 3 (`addQualification`, `uploadQualificationDocument`, `deleteQualification`) check session AND verify ownership.
- `lib/profile/photo.ts`  both (`uploadProfilePhoto`, `removeProfilePhoto`) check session.

### Ownership rule (Phase 3+)

For actions that mutate row-keyed resources (e.g. `deleteExperience(id)`), the session check is NOT enough  we must also verify the row belongs to the session's profile. Every action in `lib/profile/*` does this via:

```ts
const profile = await ownedProfileId(db, session.id);
if (!profile) return fail("Profile not found.");
// then scope every WHERE clause: and(eq(table.id, id), eq(table.profileId, profile))
```

Without this, a logged-in seeker could delete *anyone else's* experience by passing their row id.

---

## Audit log  the receipts

Every PII-touching action calls `logAccess()` (`lib/audit/index.ts`). Writes to both:
1. The `audit_log` Postgres table (canonical, `/admin/audit-log` reads from here)
2. An in-memory ring buffer (fallback for dev-without-DB)

POPIA-First Rule (`TO_START_EVERY_SESSION.md §4`): an audit-log write failing MUST NEVER break the request path. The try/catch around the DB write swallows errors and logs to stderr; the ring buffer always succeeds.

### Audit kinds (extend `AuditKind` in `lib/audit/index.ts` when adding new ones)

- Auth: `auth.signin`, `auth.signup`, `auth.signout`
- Consent: `consent.grant`, `consent.revoke`
- Profile self-edits: `profile.update`, `profile.skills.update`, `profile.status.*`, `profile.national_id.*`, `profile.experience.*`, `profile.qualification.*`, `profile.photo.*`
- PII access (Phase 5): `profile.view`, `profile.contact.reveal`, `profile.document.download`
- Search / analytics: `search.profiles`, `analytics.export`

---

## Storage security (Phase 3)

Uploads go through `lib/storage/upload.ts`:

1. **Service-role key never touches the client.** `lib/storage/supabase.ts` is marked `"server-only"`; a stray client import errors at build time.
2. **Private bucket only.** `sebenza-private` has Supabase's "Public bucket" toggle OFF. Reads require a server-issued signed URL.
3. **Content-type allow-list + magic-byte sniff.** We never trust the browser's `Content-Type`  the file's actual bytes must match. A renamed `.pdf → .jpg` is rejected.
4. **Size limits.** 5 MB photos, 10 MB documents.
5. **Per-user rate limit.** 5 uploads / 10 min, in-memory. Phase 9 replaces this with Upstash.
6. **Signed URLs are short-lived.** 60 s for documents (download), 5 min for photos (render). Long-cache buster.
7. **Object path is namespaced.** `{userId}/{kind}/{id}.{ext}`  no overwrite collisions, ownership is the path itself.

---

## Encryption (Phase 0+)

Special-category PII (only national ID numbers, for now) is encrypted at rest with **AES-256-GCM** before being written. See [`lib/crypto/index.ts`](../lib/crypto/index.ts).

- Wire format carries a `v1.` key-version prefix so Phase 9 key rotation is non-breaking.
- Key lives in `SEBENZA_ENCRYPTION_KEY` (base64, 32 bytes). Rotated via KMS in Phase 9.
- IDs are **never** echoed back to the client  not even a last-4 hint. The "ID on file · encrypted" UI is the most we expose.

---

## Things we deliberately have NOT done yet

These are documented gaps with a phase number against each, not oversights:

| Gap | Phase that closes it |
|---|---|
| 2FA enforcement for employer/admin sign-in | Phase 7 task 7.2 |
| Virus scan on uploads (ClamAV / Supabase Edge fn) | Phase 8 |
| KYC partner for employer org verification | Phase 8 |
| SAQA + Home Affairs verification for `academic_profiles` + nationalIdEnc | Phase 8 |
| Cron-driven status nudge emails (banner only today) | Phase 8 |
| Rate limiting via Upstash (in-memory today) | Phase 9 |
| Encryption key rotation tested end-to-end | Phase 9 + Phase 12 |
| Postgres → AWS Cape Town (`af-south-1`) for in-country residency | Phase 9 |
| Pen-test / dependency audit | Phase 9 |
| WCAG 2.2 AA audit | Phase 10 |
| E2E security tests (Playwright)  assert no PII leaks in payload | Phase 12 |

---

## Common mistakes to avoid

1. **Adding a new page in `(seeker)/(employer)/(admin)/` and forgetting `verifyRole()`.** The proxy will redirect unauth users, but a forged cookie sails through. Always add the guard.
2. **Calling `auth.api.getSession()` directly in app code.** Use `getSessionUser` from `@/lib/auth/dal`  it's cached and consistent.
3. **Trusting client-passed user/profile/row IDs.** Always scope DB writes to `session.id` AND verify ownership.
4. **Logging full PII to stdout in dev.** The audit log writes `actor` and `subject` (handles, ids) but never raw email/ID number/document contents.
5. **Setting `useSecureCookies: false` in production.** Don't. The current setup uses `process.env.NODE_ENV === "production"` to gate it correctly.
6. **Putting auth checks in `layout.tsx`.** Layouts don't re-render on sibling navigation (Partial Rendering). The check stays stale. Put it on each page.
7. **Adding a custom `cookiePrefix` without auditing every `getSessionCookie` call-site.** The default works fine  don't drift unless you have to.
