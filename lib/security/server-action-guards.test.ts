/**
 * Phase 32.1.3 (security remediation)  THE STRUCTURAL GUARD.
 *
 * A function exported from a module carrying the `"use server"`
 * directive is not a private helper: Next.js compiles it into a PUBLIC
 * HTTP ENDPOINT with a stable, guessable action id. Anyone on the
 * internet can POST to it. Two such functions shipped without any
 * session check (the Phase 32 audit):
 *
 *   - `supersedeEmploymentVerifications`  anonymous, destructive: it
 *     flipped any seeker's employment verification to `superseded`.
 *   - `matchVacancyCandidates`  anonymous read of nationality-split
 *     supply counts + raw private-bucket storage keys.
 *
 * Both were internal helpers that trusted their caller and crossed the
 * `"use server"` boundary by accident. Code review did not catch it
 * twice, so this test exists: it walks every Server Action module,
 * extracts each exported async function, and fails the build unless
 * that function's own body establishes the caller's identity.
 *
 * WHEN THIS TEST FAILS, the fix is almost never "add it to the
 * allowlist". It is one of:
 *   1. add the right guard (`verifyRole` / `verifyAdmin` / …) as the
 *      FIRST meaningful statement; or
 *   2. move the helper into a plain module with no `"use server"`
 *      directive (see `lib/profile/employment-verification-internal.ts`
 *      and `lib/employer/invitations-cron.ts` for the pattern).
 *
 * Only add an ALLOWLIST entry when the endpoint is deliberately public,
 * and write down why  the reviewer of the next PR is relying on it.
 */
import { describe, expect, test } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");
const SCAN_DIRS = ["lib", "app"];

/**
 * Anything that establishes WHO is calling. `getSessionUser` counts
 * because the house pattern is `const s = await getSessionUser(); if
 * (!s) return fail(...)`: the null-check is what makes it a guard, and
 * every current call site does it. `isAuthorizedCron` is the shared
 * secret gate for the 20 cron routes.
 */
const GUARDS = [
  "verifySession",
  "verifyRole",
  "verifyAdmin",
  "verifyGov",
  "verifyEmployer",
  "verifyOrgVerified",
  "getSessionUser",
  "requireSession",
  "requireRole",
  "requireAdmin",
  "requireOrgVerified",
  "requireEditRole",
  "requireEditableVacancy",
  "requireEditableForPlacement",
  "requireOwner",
  "isAuthorizedCron",
  "getMyVacancy", // org-scoping primitive; itself calls verifyEmployer()
  "getMyOrgRole", // ditto
  "ownedProfileId",
  "loadOwnedProfile",
  "getMyProfileId",
];

/**
 * Deliberately public or otherwise-authenticated endpoints. Each entry
 * MUST carry the reason it is safe.
 */
const ALLOWLIST: Record<string, string> = {
  // ── Unauthenticated by definition: these CREATE the session. ──
  "lib/auth/actions.ts::signUpSeeker":
    "public sign-up; validates everything server-side and sets role server-side",
  "lib/auth/actions.ts::signUpEmployer":
    "public employer sign-up; same posture as signUpSeeker",
  "lib/auth/actions.ts::acceptSeekerInvitation":
    "token-authenticated: the signed invite token IS the proof; email comes from the DB row, never the client",
  "lib/auth/actions.ts::signIn": "public sign-in endpoint",
  "lib/auth/actions.ts::requestPasswordReset":
    "public; deliberately non-enumerating (always returns ok)",
  "lib/auth/actions.ts::completePasswordReset":
    "token-authenticated by Better Auth's reset token",
  "lib/auth/actions.ts::resendVerificationEmail":
    "public; deliberately non-enumerating",
  "lib/auth/actions.ts::signOut": "ending a session needs no session",

  // ── Token-authenticated (the token is the proof). ──
  "lib/profile/employment-verification.ts::respondToVerification":
    "public endpoint hit from the emailed link; single-use verification token is the proof",
  "lib/employer/seeker-invitations.ts::declineSeekerInvitation":
    "invite recipient has no account yet; signed token is the proof",
  "lib/employer/seeker-invitations.ts::reportSeekerInvitation":
    "same: signed token is the proof",
  "lib/employer/seeker-invitations.ts::loadInviteByToken":
    "verifyInviteToken() IS the authorization: HMAC signature + expiry checked before any read",
  "lib/seeker/report-invite.ts::reportInvitation":
    "same: signed token is the proof",

  // ── Deliberately anonymous, product decision. ──
  "lib/admin/moderation.ts::flagProfile":
    "abuse reports may be filed anonymously by design; stores reporterUserId=null and resolves the target by PUBLIC handle",
  "lib/profile/employment.ts::listEmployerOptions":
    "feeds the PUBLIC seeker sign-up page; returns employer-directory data only (name/city/verification), no PII",

  // ── Cookie-jar only: no DB, no PII, no cross-user reach. ──
  "lib/cookies/consent.ts::readCookieConsent":
    "reads the visitor's own cookie-consent cookie; no DB, no PII",
  "lib/cookies/consent.ts::setCookieConsent":
    "writes the visitor's own cookie-consent cookie; no DB, no PII",
  "lib/cookies/welcome-back-actions.ts::recordDashboardSeen":
    "writes the visitor's own UI-state cookie; no DB, no PII",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** True when the file's own directive (not a nested closure) is "use server". */
function isServerActionModule(src: string): boolean {
  const firstCode = src
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("//") && !l.startsWith("/*") && !l.startsWith("*"));
  return firstCode === '"use server";' || firstCode === "'use server';";
}

/**
 * Extract each exported async function's REGION: from its declaration
 * to the start of the next top-level declaration (or EOF).
 *
 * Deliberately region-based rather than brace-matched. Brace matching
 * has to cope with destructured parameters (`{ profileId }`), object
 * type annotations (`Promise<ActionResult<{ … }>>`), template literals
 * and regex literals: every one of which produced false positives when
 * tried. A region is slightly permissive (a private helper sitting
 * between two exports is attributed to the one above it) but it cannot
 * produce a FALSE PASS for the case that matters: a function whose
 * whole region contains no guard call at all.
 */
function functionRegions(
  src: string,
  onlyExported: boolean,
): Array<{ name: string; body: string }> {
  const decl = onlyExported
    ? /^export\s+async\s+function\s+([A-Za-z0-9_$]+)/gm
    : /^(?:export\s+)?async\s+function\s+([A-Za-z0-9_$]+)/gm;
  // Any top-level declaration ends the previous region.
  const boundary = /^(?:export\s+)?(?:async\s+)?(?:function|const|class|interface|type)\s/gm;

  const starts: Array<{ name: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = decl.exec(src))) starts.push({ name: m[1]!, index: m.index });

  return starts.map(({ name, index }) => {
    boundary.lastIndex = index + 1;
    const next = boundary.exec(src);
    const end = next ? next.index : src.length;
    return { name, body: src.slice(index, end) };
  });
}

/**
 * Does this region establish the caller's identity, directly, by
 * delegating to Better Auth with the forwarded request headers, or by
 * calling a guarded helper defined in the same module?
 *
 * The `auth.api.*({ headers })` case is real delegation: Better Auth
 * resolves and verifies the session from those headers server-side
 * (this is how `lib/auth/two-factor.ts` works). The same-file case
 * covers the thin-wrapper pattern: e.g. the four
 * `lib/seeker/invitations.ts` responders all funnel into `respond()`,
 * whose first line is `verifyRole("seeker")`.
 */
function establishesIdentity(
  body: string,
  siblings: Map<string, string>,
  seen: Set<string> = new Set(),
): boolean {
  if (GUARDS.some((g) => body.includes(`${g}(`))) return true;
  if (body.includes("auth.api.") && body.includes("headers")) return true;
  for (const [name, siblingBody] of siblings) {
    if (seen.has(name)) continue;
    if (!new RegExp(`\\b${name}\\s*[({<]`).test(body)) continue;
    seen.add(name);
    if (establishesIdentity(siblingBody, siblings, seen)) return true;
  }
  return false;
}

describe("Server Action authorization guard (Phase 32.1.3)", () => {
  const modules = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d)))
    .map((file) => ({ file, src: readFileSync(file, "utf8") }))
    .filter(({ src }) => isServerActionModule(src));

  test("the scanner actually finds the Server Action modules", () => {
    // Guards the guard: a regression in `isServerActionModule` must not
    // silently turn this whole suite into a no-op.
    expect(modules.length).toBeGreaterThan(30);
  });

  test("every exported Server Action establishes the caller's identity", () => {
    const unguarded: string[] = [];

    for (const { file, src } of modules) {
      const rel = path.relative(ROOT, file).replace(/\\/g, "/");
      const siblings = new Map(
        functionRegions(src, false).map((f) => [f.name, f.body] as const),
      );
      for (const { name, body } of functionRegions(src, true)) {
        const key = `${rel}::${name}`;
        if (key in ALLOWLIST) continue;
        if (establishesIdentity(body, siblings, new Set([name]))) continue;
        unguarded.push(key);
      }
    }

    expect(
      unguarded,
      `Exported Server Action(s) with no authorization guard, these are PUBLIC HTTP endpoints.\n` +
        `Either add a guard as the first meaningful statement, or move the helper into a plain\n` +
        `module with no "use server" directive (see lib/profile/employment-verification-internal.ts).\n` +
        `Only allowlist it if it is deliberately public, and say why.\n\n` +
        unguarded.map((u) => `  - ${u}`).join("\n"),
    ).toEqual([]);
  });

  test("the two Phase 32 criticals stay fixed", () => {
    // Belt-and-braces: these exact regressions must never come back,
    // even if someone edits the generic scanner above.
    const evSrc = readFileSync(
      path.join(ROOT, "lib/profile/employment-verification.ts"),
      "utf8",
    );
    expect(
      evSrc.includes("export async function supersedeEmploymentVerifications"),
      "supersedeEmploymentVerifications must NOT be exported from a \"use server\" module",
    ).toBe(false);

    const internal = readFileSync(
      path.join(ROOT, "lib/profile/employment-verification-internal.ts"),
      "utf8",
    );
    expect(
      isServerActionModule(internal),
      "employment-verification-internal.ts must never gain a \"use server\" directive",
    ).toBe(false);

    const vacSrc = readFileSync(path.join(ROOT, "lib/employer/vacancies.ts"), "utf8");
    expect(
      /matchVacancyCandidates\(\s*vacancyId: string/.test(vacSrc),
      "matchVacancyCandidates must take a vacancy ID (re-resolved org-scoped), never a caller-supplied row",
    ).toBe(true);
  });
});
