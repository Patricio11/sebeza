# Client Onboarding & KYC — Implementation Blueprint

A portable, stack-aware design + implementation guide for a complete client signup → email verification → KYC onboarding → admin vetting flow. Distilled from the Seairo Cargo build (B2B logistics, ~15 files, every edge case battle-tested).

**Designed for**: Next.js App Router · Better Auth · Drizzle ORM · Postgres · Supabase Storage · Tailwind + shadcn/ui. The architecture and decisions generalise; file paths and library specifics will need adaptation if you swap any layer.

---

## What you get

End-to-end:

1. **Signup with minimum info** — name, email, company name, password. No KYC at signup.
2. **Email verification** — Better Auth handles the token, custom landing page handles error states + provides resend.
3. **Onboarding form** — collected post-verification: registration number, physical address, country, VAT (optional), plus **admin-managed document requirements** (each one uploads to Supabase storage).
4. **Admin vetting queue** — tabbed list filtered by state, search, refresh.
5. **Admin review modal** — see every field + every uploaded doc inline, Approve / Reject (with reason) / Request Changes (with admin note) / Resend Verification / Mark Verified (break-glass).
6. **Admin-managed requirements** — add/edit/reorder document requirements (with optional fillable templates the user downloads).
7. **Status pages for the client** — email-pending, onboarding-form, pending-review, approved-redirect, rejected-with-reason.
8. **Account-number auto-assignment** on approval.
9. **Full email fan-out** — verification, submission confirmation, admin alert, approval (with account number), rejection (with reason), request-changes (with admin note).
10. **Dashboard gate** — only `APPROVED` clients can access `/dashboard/*`.

Out of scope but easy to bolt on:
- Re-vetting on a periodic schedule (annual KYC refresh).
- Multi-step onboarding wizard (we use a single form because it's faster for B2B; consumer flows often want steps).
- Document expiry reminders (e.g. proof-of-address must be < 3 months — we capture but don't auto-flag).
- Admin assignment / collaboration (we treat admin as one team; multi-reviewer needs a `reviewedBy` per-document).

---

## Locked decisions

Argue these once, write them down, don't relitigate.

| Question | Pick | Why |
|---|---|---|
| When does KYC happen? | **Post-signup, post-email-verify, pre-dashboard** | Minimum signup friction; users self-qualify by completing it. |
| Required docs hardcoded? | **No — admin-managed table** | Different jurisdictions, different document sets. Hardcoding traps you. |
| Storage | **Supabase Storage** | Cheap, has signed URLs + RLS. Any S3-equivalent works. |
| Doc upload — server or client? | **Server-side via service role** | RLS is fiddly. Service role bypasses it. (Anon-key client uploads work too but need a permissive INSERT bucket policy — covered below.) |
| Doc upload — one bucket, many folders | **One bucket, prefix by `onboarding/{userId}/`** | Cleaner than one bucket per resource. |
| Email verification | **Better Auth's built-in flow** | Don't reinvent. |
| Auto-sign-in after verify? | **Yes** | One less click, but design for the failure case (see Safe Links section). |
| Vetting state machine | **5 states, single column** | `EMAIL_PENDING` → `ONBOARDING_PENDING` → `PENDING_REVIEW` → `APPROVED` \| `REJECTED`. No parallel flags. |
| Account number | **Auto-generated on approval** | `SRS-{nanoid(8)}`; never reused. |
| Re-submission flow | **Admin can request changes; status reverts to `ONBOARDING_PENDING`** | Cleaner than a separate "needs revision" state. |
| Document set per user | **Replaced on each submission** | Re-submitting wipes old docs and re-uploads. Last submission wins. (Audit trail isn't a v1 requirement; if it is, store revisions.) |
| Approval email content | **Always include the account number** | Users use it as a reference forever. |
| Admin email on submission | **Yes — out-of-band nudge** | In-app notification fires too; the email catches admins not logged in. |

---

## Architecture at a glance

```
SIGNUP
[1] / (auth panel)               name + email + company + password
     ↓ Better Auth signUp.email
     ↓ user row created: vettingStatus = EMAIL_PENDING, emailVerified = false
[2] /auth/check-email             "we sent you a link" page
     ↓ click verification link from email
     ↓ Better Auth verify-email endpoint
[3] /auth/verified                lands here
     │
     ├─ ?error=... → "Link expired" + Resend CTA
     ├─ session exists → role-based redirect
     │   ├─ admin → /admin
     │   └─ client → /auth/onboarding
     └─ no session, no error → "Sign in" CTA

ONBOARDING (client lands here after verify, OR comes back to it)
/auth/onboarding   server-renders based on vettingStatus:
  ├─ EMAIL_PENDING       → "still waiting for verify" + resend button
  ├─ ONBOARDING_PENDING  → company form + per-requirement upload slots
  │                          ↓ submit (POST /api/auth/onboarding)
  │                          ↓ requirements validated; status → PENDING_REVIEW
  ├─ PENDING_REVIEW      → "thanks — under review" status page
  ├─ APPROVED            → auto-redirect to /dashboard
  └─ REJECTED            → read-only screen showing rejection reason

ADMIN VETTING
/admin/users  ← UserVettingTable
  ├─ Tabs: Pending Review · Email Pending · Onboarding · Approved · Rejected · All
  ├─ Search by company / contact / reg number
  └─ Click Review → opens UserReviewModal
       ├─ Company info grid (legal name, reg, country, VAT, address)
       ├─ Document list (each opens in new tab)
       └─ Actions (state-dependent):
            EMAIL_PENDING:    Resend verification email · Mark as verified (break-glass)
            ONBOARDING_PENDING: nothing actionable (waiting on user)
            PENDING_REVIEW:   Approve · Request Changes (note) · Reject (reason)
            APPROVED:         (info only — Disable 2FA if user has it on)
            REJECTED:         (info only — shows previous reason)

ADMIN — MANAGE REQUIREMENTS
/admin/users/requirements
  ├─ Add a requirement: name, description, required?, optional template upload
  ├─ Drag-to-reorder via sortOrder
  └─ Soft-toggle active (existing uploads stay valid; new submissions don't see inactive rows)

DASHBOARD GATE
/dashboard/layout.tsx → requireRole(["client"]) + vettingStatus must be APPROVED.
  Anyone in EMAIL_PENDING / ONBOARDING_PENDING / PENDING_REVIEW / REJECTED
  is redirected to /auth/onboarding which renders the right sub-view.
```

---

## Schema

Three core tables; one enum.

### `vetting_status` enum

```ts
export const vettingStatusEnum = pgEnum("vetting_status", [
    "EMAIL_PENDING",       // signed up, awaiting email verification
    "ONBOARDING_PENDING",  // verified, hasn't completed onboarding (or admin requested changes)
    "PENDING_REVIEW",      // onboarding submitted, awaiting admin
    "APPROVED",            // admin approved → dashboard unlocked
    "REJECTED",            // admin rejected with a reason
]);
```

### `user` (extend the Better Auth user table)

```ts
export const user = pgTable("user", {
    // ... Better Auth core: id, name, email, emailVerified, image, createdAt, updatedAt

    role: roleEnum("role").default("client").notNull(),
    isVetted: boolean("isVetted").default(false).notNull(),
    accountNumber: text("accountNumber").unique(),
    companyName: text("companyName"),
    companyReg: text("companyReg"),

    vettingStatus: vettingStatusEnum("vetting_status").default("EMAIL_PENDING").notNull(),
    vettingRejectionReason: text("vetting_rejection_reason"),
    vettingAdminNote: text("vetting_admin_note"), // shown to user as a yellow banner when admin requests changes
    vettingReviewedAt: timestamp("vetting_reviewed_at"),
    vettingReviewedBy: text("vetting_reviewed_by"),
    companyAddress: text("company_address"),
    companyCountry: text("company_country"), // 2-letter ISO code
    vatNumber: text("vat_number"),
});
```

### `onboarding_requirements` (admin-managed)

```ts
export const onboardingRequirements = pgTable("onboarding_requirements", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),                 // "Tax Clearance Certificate"
    description: text("description"),             // optional helper text shown to the user
    // If set, this requirement is a "fillable template" — admin uploads a
    // file the user downloads, fills in, and uploads back as their submission.
    templateUrl: text("template_url"),
    templateOriginalName: text("template_original_name"),
    templateMimeType: text("template_mime_type"),
    templateSizeBytes: integer("template_size_bytes"),

    required: boolean("required").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    active: boolean("active").default(true).notNull(),  // soft-delete

    uploadedBy: text("uploaded_by").references(() => user.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
    sortIdx: index("onboarding_requirements_sort_idx").on(t.sortOrder),
    activeIdx: index("onboarding_requirements_active_idx").on(t.active),
}));
```

**Why `active` instead of hard-delete**: existing in-flight users still see their previously-uploaded docs via the documents array (which carries the original `requirementId`). Hard-deleting would orphan their submissions.

### `company_documents` (per-user uploads)

```ts
export const companyDocumentTypeEnum = pgEnum("company_document_type", [
    "COMPANY_REG_CERT",
    "PROOF_OF_ADDRESS",
    "RLA_EXPORT_CERT",
    "BANK_CONFIRMATION",
    "DIRECTOR_ID",
    "TAX_CLEARANCE",
    "VAT_CERT",
    "OTHER",
]);

export const companyDocuments = pgTable("company_documents", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    type: companyDocumentTypeEnum("type").notNull(),
    requirementId: text("requirement_id"),   // FK → onboarding_requirements.id; nullable for legacy / OTHER uploads
    originalName: text("original_name").notNull(),
    storedName: text("stored_name"),
    url: text("url").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    notes: text("notes"),                     // admin scratch
    uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
}, (t) => ({
    userIdx: index("company_documents_user_idx").on(t.userId),
    requirementIdx: index("company_documents_requirement_idx").on(t.requirementId),
}));
```

**Why keep `type` enum alongside `requirementId`**: backwards compatibility + a stable enum to query against ("show me everyone's tax clearance"). New uploads also carry the `requirementId` so the admin review modal can label them with the original requirement name. Custom admin-added requirements map to `OTHER`.

---

## Phased rollout

| Phase | Goal | Time |
|---|---|---|
| **A** | Schema + Better Auth signup | ~1h |
| **B** | Email verification flow (incl. `/auth/verified` error handling) | ~2h |
| **C** | Onboarding form + status screens | ~4h |
| **D** | Admin vetting queue + review modal | ~4h |
| **E** | Admin actions (approve / reject / request-changes / resend / mark-verified) | ~3h |
| **F** | Admin-managed requirements (CRUD + template upload + reorder) | ~3h |
| **G** | All email templates | ~2h |
| **H** | Dashboard gate + polish (CLAUDE.md note, copy review) | ~1h |

Critical path: A → B → C unlocks the **client** flow. D → E unlocks the **admin** flow. F + G are polish that can ship same week. H is the gate that makes the whole thing meaningful.

---

## Phase A — Foundation

### Better Auth (`lib/auth/server.ts`)

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const auth = betterAuth({
    baseURL: appUrl,
    trustedOrigins: [appUrl, "http://localhost:3000"],
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: { user, session, account, verification },
    }),
    session: { /* defaults */ },
    databaseHooks: {
        user: {
            create: {
                // Optional — assign a placeholder accountNumber on create
                // (only flipped to a real one on approval). Or leave null until then.
                before: async (user) => ({ data: { ...user } }),
            },
        },
    },
    emailAndPassword: {
        enabled: true,
        requireEmailVerification: true,   // ← critical: blocks login until verified
        sendResetPassword: async ({ user, url }) => { await sendPasswordResetEmail(user.email, url) },
    },
    emailVerification: {
        sendOnSignUp: true,
        autoSignInAfterVerification: true,
        callbackURL: `${appUrl}/auth/verified`,
        sendVerificationEmail: async ({ user, url }) => {
            // Force callbackURL to be absolute + include ?email= so the error
            // branch can offer a one-click resend. See "Safe Links" gotcha below.
            let finalUrl = url;
            try {
                const u = new URL(url);
                u.searchParams.set("callbackURL", `${appUrl}/auth/verified?email=${encodeURIComponent(user.email)}`);
                finalUrl = u.toString();
            } catch { /* malformed, send as-is */ }
            await sendVerificationEmail(user.email, finalUrl);
        },
    },
    user: {
        additionalFields: {
            role: { type: "string", required: false, defaultValue: "client" },
            companyName: { type: "string", required: false },
            accountNumber: { type: "string", required: false },
            isVetted: { type: "boolean", required: false, defaultValue: false },
        },
    },
});
```

### `requireRole` gate (the heart of the dashboard lockout)

```ts
export async function requireRole(allowedRoles: Array<"admin" | "client">) {
    const session = await requireAuth();
    const userRole = session.user.role as "admin" | "client";

    if (!allowedRoles.includes(userRole)) {
        if (userRole === "admin") redirect("/admin");
        else redirect("/dashboard");
    }

    // Vetting gate — only applies when the page asks for client access
    if (userRole === "client" && allowedRoles.includes("client")) {
        const [row] = await db
            .select({ vettingStatus: user.vettingStatus })
            .from(user)
            .where(eq(user.id, session.user.id))
            .limit(1);
        if (!row || row.vettingStatus !== "APPROVED") {
            redirect("/auth/onboarding");
        }
    }

    return session;
}
```

`app/dashboard/layout.tsx` calls `requireRole(["client"])`. Unapproved clients land on `/auth/onboarding` which renders the right sub-view.

### Signup form

In your sign-in/sign-up panel, on signup success:
```ts
await authClient.signUp.email({ email, password, name, companyName });
router.push(`/auth/check-email?email=${encodeURIComponent(email)}`);
```

`companyName` is collected at signup because it's the single most useful thing for the admin reviewing later — but the full company KYC happens in Phase C, not at signup. Keep signup friction low.

---

## Phase B — Email verification

### `/auth/check-email`

Post-signup landing. Reads `?email=...`. Shows:
- "Check your inbox"
- Spam/junk hint with "Mark as Not Spam" copy (matters for B2B from a new sender)
- "Resend verification email" button → `POST /api/auth/resend-verification`
- Numbered "what's next" steps
- Link to "Back to home"

### `/auth/verified`

Three branches in order:

1. **`?error=...`** → friendly error message + Resend CTA (uses the `email` query param so the user doesn't retype).
2. **Session exists** → role-based redirect (admin → `/admin`, client → `/auth/onboarding`).
3. **No session, no error** → "Sign in to continue" CTA (extremely rare given autoSignInAfterVerification).

**Why branch (1) matters**: without it, expired/used tokens silently redirect to a "looks fine" page. See "Outlook Safe Links" gotcha.

### `/api/auth/resend-verification`

```ts
export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => ({}));
    let email = typeof body?.email === 'string' ? body.email.trim() : undefined;
    if (!email) {
        const session = await getSession();
        if (session?.user?.email) email = session.user.email;
    }
    if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

    const baseURL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    await auth.api.sendVerificationEmail({
        body: { email, callbackURL: `${baseURL}/auth/verified` },
    });
    return NextResponse.json({ success: true });
}
```

Accepts email from body OR session — both paths exist (logged-out user from `/auth/check-email`, logged-in user from `/auth/onboarding`'s email-pending screen).

---

## Phase C — Onboarding form

### `/auth/onboarding` — server-rendered, status-driven

The same URL renders one of five sub-views based on the user's `vettingStatus`:

```ts
export default async function OnboardingPage() {
    const session = await getSession();
    if (!session) redirect("/");
    if (session.user.role === "admin") redirect("/admin");

    const [row] = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1);
    if (!row) redirect("/");

    // Lazy bump: email verified but stuck in EMAIL_PENDING → advance
    let status = row.vettingStatus;
    if (status === "EMAIL_PENDING" && row.emailVerified) {
        await db.update(user).set({ vettingStatus: "ONBOARDING_PENDING" }).where(eq(user.id, row.id));
        status = "ONBOARDING_PENDING";
    }

    const requirements = status === "ONBOARDING_PENDING"
        ? await db.select().from(onboardingRequirements)
            .where(eq(onboardingRequirements.active, true))
            .orderBy(asc(onboardingRequirements.sortOrder))
        : [];

    return (/* render one of:
        <EmailPendingScreen> | <OnboardingForm> | <PendingReviewScreen>
        | <ApprovedScreen> | <RejectedScreen>
    */);
}
```

**Why the lazy bump**: if Better Auth's auto-sign-in lands a verified user but the verified page didn't run our state transition, the user would loop. The bump catches them when they next hit `/auth/onboarding`.

### `<OnboardingForm>` (client component)

Form fields (single page, not a wizard):

- Legal company name
- Registration number
- Physical address (textarea)
- Country (2-letter ISO; offer a select)
- VAT number (optional)
- **Per-requirement upload slots** — driven by the `requirements` prop:
  - For each requirement: label, description, optional "Download original" link if `templateUrl` is set, then a file input
  - "Required" requirements have a red asterisk + form validation
  - Optional requirements have an "Optional" tag

Behaviour:

- **Sequential uploads on submit** — each file uploads to Supabase, then the URLs are POSTed to `/api/auth/onboarding`. Show progress: "Uploading 3 of 6..."
- **Pre-fill** from the user row so admin-requested-changes resubmissions start with the previous values.
- **Admin note banner** if `vettingAdminNote` is set: yellow callout at the top "Our team asked you to revise this — see the note below" + the note text. Cleared on submit.

### `POST /api/auth/onboarding`

```ts
export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session) return 401;

    const body = await req.json();
    const { companyName, companyReg, companyAddress, companyCountry, vatNumber, documents } = body;

    const [row] = await db.select().from(user).where(eq(user.id, session.user.id)).limit(1);
    if (!row) return 404;
    if (!row.emailVerified) return 400 "Verify your email first";
    if (row.vettingStatus !== "ONBOARDING_PENDING") return 400 `Cannot submit in ${row.vettingStatus} state`;

    // Validate text fields
    const errors = [];
    if (!companyName?.trim()) errors.push("Legal company name is required");
    // ... etc

    // Validate uploads against active+required requirements
    const activeRequirements = await db.select().from(onboardingRequirements)
        .where(eq(onboardingRequirements.active, true));
    const submittedReqIds = new Set(documents.map(d => d.requirementId));
    for (const r of activeRequirements) {
        if (r.required && !submittedReqIds.has(r.id)) {
            errors.push(`${r.name} is required`);
        }
    }
    if (errors.length) return 400 errors.join("; ");

    // Persist + flip status
    await db.update(user).set({
        companyName, companyReg, companyAddress,
        companyCountry: companyCountry.toUpperCase(),
        vatNumber: vatNumber || null,
        vettingStatus: "PENDING_REVIEW",
        vettingAdminNote: null,  // clear when resubmitting
        updatedAt: new Date(),
    }).where(eq(user.id, row.id));

    // Replace existing docs — resubmits don't pile up
    await db.delete(companyDocuments).where(eq(companyDocuments.userId, row.id));
    await db.insert(companyDocuments).values(/* mapped from body.documents */);

    // Notifications
    await db.insert(adminNotifications).values({ /* "New Onboarding Submission" */ });
    try { await sendOnboardingSubmittedEmail(row.email, companyName); } catch (e) { /* best-effort */ }
    try { await sendAdminVettingNotificationEmail({ /* ... */ }); } catch (e) { /* best-effort */ }

    return NextResponse.json({ success: true, status: "PENDING_REVIEW" });
}
```

### Status screens (`<EmailPendingScreen>`, `<PendingReviewScreen>`, `<ApprovedScreen>`, `<RejectedScreen>`)

Each is a "you've reached this state, here's what to do" screen.

- **EmailPendingScreen** — "We still need you to verify {email}" + Resend button. Same call as `/auth/check-email`.
- **PendingReviewScreen** — "Thanks {companyName}! Application submitted on {date}. We typically approve within one business day." + "what happens next" steps. No actions.
- **ApprovedScreen** — green checkmark + "You're in! Account number: {accountNumber}" + auto-redirect to `/dashboard` after 2s.
- **RejectedScreen** — red callout with `vettingRejectionReason`. Contact-support link.

---

## Phase D — Admin vetting queue

### `/admin/users` → `<UserVettingTable>`

Tabs (`Tab` union: `PENDING_REVIEW | EMAIL_PENDING | ONBOARDING_PENDING | APPROVED | REJECTED | ALL`):

- Each tab shows a count badge: `Pending Review (4)`.
- Default tab: `PENDING_REVIEW` (the actionable queue).
- Filter by search across company name, contact name, email, registration number.
- Manual refresh button (no auto-poll — admin actions immediately refetch).

Columns: Company · Contact (name + email + chips for emailVerified / 2FA) · Reg/VAT · Docs (count) · Status · Action (Review button).

Clicking a row opens `<UserReviewModal>`.

### API: `GET /api/admin/users/vetting`

Returns all clients with their docs joined in one round-trip:

```ts
const rows = await db.select({ id, name, email, companyName, companyReg, /* ... */, vettingStatus, emailVerified })
    .from(user)
    .where(eq(user.role, "client"))
    .orderBy(desc(user.updatedAt));

const docs = await db.select().from(companyDocuments)
    .where(inArray(companyDocuments.userId, rows.map(r => r.id)));

// Resolve requirement names (so the modal can label legacy uploads cleanly)
const reqIds = Array.from(new Set(docs.map(d => d.requirementId).filter(Boolean)));
const requirements = await db.select({ id, name }).from(onboardingRequirements)
    .where(inArray(onboardingRequirements.id, reqIds));

// Build the response with docs grouped by userId + requirementName resolved
return NextResponse.json({ users: rows.map(...) });
```

### `<UserReviewModal>`

Big dialog (~680px wide, max-height 90vh, scrollable). Sections:

1. **Header** — company name + user id (mono, small) + state pill.
2. **Status-specific context cards** — yellow "user hasn't verified yet" / blue "email verified, waiting on form" / red "previous rejection" / amber "admin note still visible".
3. **Company info grid** — legal name, reg, country, VAT, address. `<InfoRow>` helper.
4. **Documents list** — one row per doc with the *requirement name* (resolved server-side) as the primary label and the original filename below; click → opens the URL in a new tab.
5. **Action prompts** — yellow textarea when collecting a reject reason or admin note.
6. **Footer actions** — buttons depend on `vettingStatus`:

```
EMAIL_PENDING:    [Mark as verified] (amber outline) [Resend verification email] (blue)
ONBOARDING_PENDING: (none — waiting on user)
PENDING_REVIEW:   [Request Changes] (amber) [Reject] (red outline) [Approve] (emerald)
APPROVED:         (read-only)
REJECTED:         (read-only, shows previous reason)
```

Plus a left-side "Disable 2FA" button (red ghost) for break-glass if the user has 2FA on. See [2FA blueprint](2FA_BLUEPRINT.md) Phase E.

---

## Phase E — Admin actions

Five endpoints, all `PATCH` (except disable-2fa which is `POST`), all `requireAdmin`-gated.

### `PATCH /api/admin/users/[id]/approve`

```ts
const { session, error } = await requireAdmin();
const { id } = await params;
const [target] = await db.select().from(user).where(eq(user.id, id)).limit(1);
if (!target) return 404;
if (target.role !== "client") return 400 "Only clients";
if (target.vettingStatus === "APPROVED") return 400 "Already approved";

// Auto-assign account number on first approval
let accountNumber = target.accountNumber;
if (!accountNumber) accountNumber = `SRS-${nanoid(8).toUpperCase()}`;

await db.update(user).set({
    isVetted: true,
    vettingStatus: "APPROVED",
    vettingReviewedAt: new Date(),
    vettingReviewedBy: session.user.id,
    vettingRejectionReason: null,
    vettingAdminNote: null,
    accountNumber,
    updatedAt: new Date(),
}).where(eq(user.id, id));

await db.insert(clientNotifications).values({ /* welcome notification */ });
try { await sendApprovalEmail(target.email, accountNumber, target.companyName ?? target.name); } catch {}
return NextResponse.json({ success: true, accountNumber });
```

### `PATCH /api/admin/users/[id]/reject`

Body: `{ reason }`. Sets `vettingStatus = REJECTED`, stamps `vettingRejectionReason`, fires rejection email with the reason verbatim. **Doesn't delete the user** — they can be re-vetted later.

### `PATCH /api/admin/users/[id]/request-changes`

Body: `{ note }`. The "soft reject" — sets `vettingStatus = ONBOARDING_PENDING`, stamps `vettingAdminNote`. The user lands back on the form with a yellow banner showing the note ("Your proof of address is older than 3 months — please upload a recent one"). Fires `sendRequestChangesEmail`.

### `PATCH /api/admin/users/[id]/resend-verification`

Re-fires `auth.api.sendVerificationEmail()` with `callbackURL = ${baseURL}/auth/verified`. No state change.

### `PATCH /api/admin/users/[id]/mark-verified`

Break-glass. Use case: Outlook Safe Links pre-consumed the verification token, or the user lost the email. Constraints:

- Caller must be admin.
- Target must be a client (admin → admin promotion not allowed).
- Target must currently be unverified (no-op rejected with a clear message).

Side effects:
- Sets `emailVerified = true`
- Advances `vettingStatus` from `EMAIL_PENDING` → `ONBOARDING_PENDING`
- In-app notification "Email verified by support" so the user knows
- **Does NOT auto-sign-in the user** — an admin shouldn't silently land in someone else's session.

---

## Phase F — Admin-managed requirements

### `/admin/users/requirements` → `<OnboardingRequirementsTable>`

Drag-to-reorder list (use `@dnd-kit`). Each row:

- Display name
- Description (optional)
- "Has template" pill if `templateUrl` is set
- "Required" / "Optional" pill
- Sort order (auto-maintained)
- Action menu: Edit · Upload/Replace template · Active toggle

### CRUD endpoints

| Endpoint | Verb | Purpose |
|---|---|---|
| `/api/admin/onboarding-requirements` | GET | List (admin-only sees inactive; client form only sees `active=true`) |
| `/api/admin/onboarding-requirements` | POST | Create |
| `/api/admin/onboarding-requirements/[id]` | PATCH | Update fields (name, description, required, active) |
| `/api/admin/onboarding-requirements/[id]` | DELETE | Hard-delete. Refuses if any `company_documents.requirementId` references it. Otherwise use the active toggle. |
| `/api/admin/onboarding-requirements/[id]/template` | POST | Multipart upload of a fillable template (uploaded to Supabase storage under `templates/`); persists `templateUrl`, `templateOriginalName`, `templateMimeType`, `templateSizeBytes`. |
| `/api/admin/onboarding-requirements/[id]/template` | DELETE | Remove the template (set fields to null; the file in storage is left orphaned — accept this for v1). |
| `/api/admin/onboarding-requirements/reorder` | POST | Body: `{ ids: string[] }` in the new order. Updates `sortOrder` in one transaction. |

### Template flow

When `templateUrl` is set:
- The verification email lists the templates inline ("Documents to download and fill in") with download links.
- The onboarding form, for that requirement, shows: requirement name + description + **Download original** link → user fills the file → uploads back as their submission.

This is great for forms that need wet signatures, structured layouts (credit applications, T&Cs acknowledgments), or jurisdiction-specific paperwork.

---

## Phase G — Email templates

Six templates, all in one file, all use a shared `emailLayout(...)` for tone consistency.

| Function | When | To | Subject |
|---|---|---|---|
| `sendVerificationEmail(to, url, templates?)` | Better Auth signup hook | User | "Verify your email — {App Name}" |
| `sendPasswordResetEmail(to, url)` | Better Auth password reset hook | User | "Reset your password — {App Name}" |
| `sendOnboardingSubmittedEmail(to, companyName)` | After `POST /api/auth/onboarding` | User | "We received your application — {App Name}" |
| `sendAdminVettingNotificationEmail({ companyName, contactName, contactEmail, userId, submittedAt })` | After onboarding submit | `ADMIN_ALERT_EMAIL` env | "New onboarding submission — {companyName}" |
| `sendApprovalEmail(to, accountNumber, companyName)` | After approve | User | "🎉 You're approved — welcome" |
| `sendRejectionEmail(to, reason, companyName)` | After reject | User | "Application update — {App Name}" |
| `sendRequestChangesEmail(to, adminNote, companyName)` | After request-changes | User | "We need some updates — {App Name}" |

**Shared layout** — gradient header, white card body, footer with support email + year. Each template picks an accent color (emerald for verify/approve, amber for request-changes, blue for default, red for rejection).

**Verification email gotcha** — include the raw URL as plain text below the button:

```html
<p>Button not working? Copy this link into your browser:</p>
<a href="${verificationUrl}">${verificationUrl}</a>
```

Some email clients strip buttons. Some pre-fetchers (Safe Links) consume the button URL on its way to the inbox. The plain-text URL gives users a second path.

**SMTP**: We use `nodemailer` with generic SMTP env vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_FROM_NAME`). Works with any provider (Resend, SendGrid, Mailgun, your own SMTP).

---

## Phase H — Dashboard gate + polish

The gate is one line in `app/dashboard/layout.tsx`:

```ts
await requireRole(["client"]);  // Throws/redirects if not APPROVED client
```

Polish pass:
- Copy review across signup/verify/onboarding/admin emails — pick one tone (we use a warm, slightly informal B2B tone).
- Add a "what's next" sidebar to `/auth/onboarding` so users understand the timeline.
- Add the spam/junk hint to `/auth/check-email` (first emails from a new sender often land there in B2B).
- Configure `ADMIN_ALERT_EMAIL` env var — if unset, the admin notification skips silently.

---

## File / surface area

```
lib/
  db/
    schema/
      users.ts                            ← + vettingStatus enum + KYC columns
      onboarding-requirements.ts          ← NEW
      company-documents.ts                ← NEW
      notifications.ts                    ← admin + client notifications
  auth/
    server.ts                             ← Better Auth + requireRole
    client.ts                             ← authClient
  email.ts                                ← all 7 templates
  supabase/
    client.ts                             ← Supabase client init
    upload.ts                             ← uploadFile helper

app/
  auth/
    check-email/page.tsx                  ← post-signup screen
    verified/page.tsx                     ← post-verify landing (handles ?error)
    onboarding/page.tsx                   ← single URL, 5 sub-views
  api/
    auth/
      [...all]/route.ts                   ← Better Auth catch-all
      onboarding/route.ts                 ← GET state + POST submit
      resend-verification/route.ts        ← POST resend
    admin/
      users/
        vetting/route.ts                  ← GET list
        [id]/approve/route.ts             ← PATCH
        [id]/reject/route.ts              ← PATCH
        [id]/request-changes/route.ts     ← PATCH
        [id]/resend-verification/route.ts ← PATCH
        [id]/mark-verified/route.ts       ← PATCH
      onboarding-requirements/
        route.ts                          ← GET / POST
        [id]/route.ts                     ← PATCH / DELETE
        [id]/template/route.ts            ← POST / DELETE
        reorder/route.ts                  ← POST
  dashboard/
    layout.tsx                            ← requireRole(["client"]) gate

components/
  auth-panel.tsx                          ← signup/signin slide-over
  auth/
    onboarding-form.tsx                   ← the KYC form
    onboarding-status-screens.tsx         ← email/pending/approved/rejected views
    resend-verification-button.tsx        ← inline button for error states
  admin/
    user-vetting-table.tsx                ← tabbed queue
    user-review-modal.tsx                 ← review individual user
    onboarding-requirements-table.tsx     ← manage requirements (drag-to-reorder)
```

---

## Storage / RLS gotchas (Supabase-specific)

If you use Supabase Storage with the anon key from the browser, you **will** hit:

> `new row violates row-level security policy`

Two fixes, pick one:

### Option A: Server-side upload with service role key (recommended for new builds)

- Upload goes through a server route that uses `SUPABASE_SERVICE_ROLE_KEY`.
- Bypasses RLS entirely.
- Slightly more code (a POST endpoint per upload context) but cleaner security model.

### Option B: Permissive INSERT policy on the bucket (anon-key client uploads)

In Supabase Dashboard → Storage → your bucket → Policies → New Policy:

```sql
-- Allow authenticated users to upload to the onboarding/ prefix
CREATE POLICY "Authenticated can upload onboarding docs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'your-bucket' AND (storage.foldername(name))[1] = 'onboarding');
```

You also need a SELECT policy if files are served via public URL — or use signed URLs (`createSignedUrl`).

### File naming

Storage keys can't contain spaces, parens, accents, etc. Sanitise + uniquify:

```ts
export function generateUniqueFileName(originalName: string, preferredBase?: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    const dotIdx = originalName.lastIndexOf('.');
    const ext = dotIdx >= 0 ? originalName.slice(dotIdx) : '';
    const baseSource = preferredBase ?? (dotIdx >= 0 ? originalName.slice(0, dotIdx) : originalName);
    const base = baseSource
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-zA-Z0-9-_]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase()
        .substring(0, 60) || 'file';
    return `${base}-${timestamp}-${random}${ext}`;
}
```

Always include the timestamp + random suffix — Supabase rejects uploads with `upsert: false` if the key already exists, and retries collide without a suffix.

---

## Risk areas — read before shipping

### 1. Outlook Safe Links pre-consume verification tokens

If a recipient's tenant has Microsoft Defender Safe Links enabled, Outlook GETs the URL server-side **before** the user clicks — to scan it. That GET hits Better Auth's verify endpoint, marks the email verified, and Better Auth's `Set-Cookie` response goes to Microsoft's scanner, not the user's browser. When the user actually clicks for real, the token's already consumed; they land on the callback URL with no session.

**Mitigations**:
- **Plain-text URL below the button** — manually pasted, less likely to be pre-fetched.
- **`/auth/verified` reads `?error=...`** and offers a one-click resend.
- **`Mark as verified` admin break-glass** — when all else fails, admin can verify out-of-band.

### 2. Document upload size limits

Supabase Storage has a default 50MB per file. ID scans / certificates are usually under 5MB. Add a client-side check (`if (file.size > 10 * 1024 * 1024)`) before uploading; surface a clear "max 10MB" error.

### 3. Resubmission wipes old docs

`POST /api/auth/onboarding` does `delete companyDocuments where userId = ...` before re-inserting. If a user accidentally re-submits with fewer docs, the old ones are gone. Two ways to handle:

- **Soft** — keep all submissions, only the latest with `current = true`. More schema work, audit-friendly.
- **Hard** — what we do. Last submission wins. Use the admin "Request Changes" flow to keep the user in `ONBOARDING_PENDING` with their previous values pre-filled, so they edit rather than re-upload from scratch.

### 4. Required-field validation

Validate on the server. Always. Client-side validation is for UX; server is for security. Our validator returns all errors at once (semicolon-joined) so the user fixes everything in one round-trip, not one at a time.

### 5. The vetting state machine is single-column

`vettingStatus` is one column. Don't add parallel flags (`needsReview`, `isPending`) — they desync. If you need a "the admin is currently reviewing X" lock, add a `lockedByAdminId` + `lockedAt` (with a 15-minute timeout to release stale locks).

### 6. Country code validation

We require a 2-letter ISO 3166-1 alpha-2 code. Anywhere you display it (rejection email, admin review modal), keep it as-is (`ZA`, `GB`, `US`) — converting to country name needs a lookup table and can mis-localise.

### 7. Approval is irreversible (by design)

Once `vettingStatus = APPROVED` and an `accountNumber` is assigned, we don't recycle the account number even if you later revert the user. If you need to suspend an approved user, add a separate `suspended boolean` flag — don't roll back the vetting state.

### 8. Multiple admins reviewing the same user

No locking in v1. If two admins both click Approve, both updates run. Last writer wins. In practice, single-admin teams; if you grow to multiple, add a `vettingLockedAt` column with the same locking pattern as cron jobs.

### 9. The "Request Changes" loop

The admin can request changes any number of times. Each iteration:
- Admin clicks Request Changes → user → `ONBOARDING_PENDING` + `vettingAdminNote` set
- User re-opens `/auth/onboarding`, sees the yellow banner, edits, resubmits
- Status → `PENDING_REVIEW`, `vettingAdminNote` cleared
- Admin can request again, approve, or reject

No iteration counter — track via `updatedAt` in the admin UI if you need to see who's been ping-ponging.

### 10. Emails are best-effort

Every `sendXxxEmail` call is wrapped in `try {} catch (e) { console.warn(...) }`. SMTP failures must never break the user-facing flow. Add SMTP monitoring separately.

---

## Env vars

| Var | Required? | Purpose |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | yes | Used by Better Auth as baseURL + verification callback URL |
| `NEXT_PUBLIC_SUPABASE_URL` | yes if using Supabase | Storage client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes if using Supabase | Client-side uploads (with permissive bucket policy) |
| `SUPABASE_SERVICE_ROLE_KEY` | optional | Server-side uploads (bypasses RLS) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | yes for emails | nodemailer config |
| `SMTP_FROM_NAME` | optional | Display name on the From header |
| `SUPPORT_EMAIL` | recommended | Linked from email footers |
| `ADMIN_ALERT_EMAIL` | optional | Admin inbox for "new submission" + 2FA-enrolment heads-ups. Unset → those emails are silently skipped. |

---

## Smoke test (manual, end-to-end)

After every phase landing, walk through this:

1. **Signup → email verification**
   - Sign up with a fresh email
   - Land on `/auth/check-email`
   - Click verify link in inbox
   - Land on `/auth/onboarding` (auto-signed-in)

2. **Onboarding submission**
   - Form pre-fills the company name from signup
   - Try submitting empty → all required-field errors shown at once
   - Upload all required docs, fill all fields, submit
   - Status flips to `PENDING_REVIEW`, see the "thanks" screen
   - `/api/admin/users/vetting` returns this user under PENDING_REVIEW
   - Submission confirmation email lands in the user's inbox
   - Admin notification email lands in `ADMIN_ALERT_EMAIL` inbox

3. **Admin approve**
   - Sign in as admin, `/admin/users`
   - Click Review on the new submission
   - See company info + all uploaded docs (open each one — should download/preview)
   - Click Approve → confirm
   - User's row flips to APPROVED with an auto-generated `accountNumber`
   - Approval email lands in user's inbox with the account number
   - User signs in → lands on `/dashboard`

4. **Admin reject**
   - Repeat with a new user, but click Reject → enter a reason → confirm
   - User's row flips to REJECTED with `vettingRejectionReason` set
   - Rejection email lands with the reason
   - User signs in → lands on `/auth/onboarding` showing the RejectedScreen

5. **Admin request changes**
   - New user, submit, then admin clicks Request Changes → enter a note ("Your proof of address is older than 3 months")
   - User's row goes back to ONBOARDING_PENDING with `vettingAdminNote` set
   - Request-changes email lands with the note
   - User signs in → onboarding form shows a yellow banner with the note + their previous values
   - User uploads new docs, resubmits → PENDING_REVIEW, banner clears, `vettingAdminNote = null`
   - Admin approves → done

6. **Admin manage requirements**
   - `/admin/users/requirements` → add a new requirement "Letter of Intent" with a fillable template upload
   - Set it to required
   - New signup flow: the verification email lists the template under "Documents to download and fill in"
   - Onboarding form shows a download link for it + an upload slot

7. **Verification edge cases**
   - Click an expired verification link → land on `/auth/verified?error=EXPIRED_TOKEN` → see the friendly error + Resend button
   - Click resend → fresh link → works
   - Admin Mark as Verified — flips `emailVerified = true` + advances to ONBOARDING_PENDING + fires "verified by support" notification

8. **Dashboard gate**
   - Try opening `/dashboard` while in any non-APPROVED state → redirected to `/auth/onboarding`
   - Admin opening `/dashboard` → redirected to `/admin`

---

## What I'd change next time

- **Soft document history**: keep all submissions with a `revision` field. Audit-friendly, lets admins see how many times someone re-submitted.
- **Document expiry**: add `expiresAt` to `company_documents` with a daily cron that reverts approved users to `ONBOARDING_PENDING` 30 days before expiry. Annual re-vetting becomes automatic.
- **Multi-admin lock**: `lockedByAdminId` + `lockedAt` on the user row so two admins don't both approve simultaneously.
- **Per-requirement instructions** beyond `description` — a small markdown blob so admins can paste paragraph-long instructions.
- **Country dropdown is a select, not a free text 2-letter input** — we typed 2 letters; a real select with country names is friendlier.
- **Optional address-validation API integration** (Google Places / OpenAddresses) so the physical address is parsed and verified, not free text.

---

## License

Use this freely in your projects. No attribution required.
