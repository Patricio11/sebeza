/**
 * Phase 34  Self Apply, end to end (docs/PHASE_34_SELF_APPLY_PLAN.md
 * §VERIFY  the three flag-ON boxes).
 *
 * Rides the seeded showcase vacancy (db/seed.ts):
 *   "IT Support Technician" @ Discovery Bank, selfApplyEnabled with the
 *   FIXED demo token  /apply/sa-demo-it-support-2026-fixed01
 *   skills: customer-service + excel + sql (most seeded seekers lack at
 *   least one → the congrats skills-gap nudge has content).
 *
 * Coverage:
 *   1. Flag OFF (dark ship): the public link renders the calm
 *      "not accepting" panel  zero regression.
 *   2. Flag ON, anonymous: full Civic-Editorial dossier WITHOUT the
 *      salary band (D2).
 *   3. Signed-in seeker: salary visible → Apply → confirm dialog with
 *      the D4 disclosure → congrats dialog (skills-gap nudge) → row in
 *      the seeker inbox as "You applied" → re-visit shows the
 *      already-applied panel. DB-asserts origin/state.
 *   4. Employer: public-link panel with the token, "Self-applied" chip
 *      in the pipeline, accept-rate strip NOT inflated by the
 *      self-apply, edit form shows the Self Apply toggles.
 *   5. New-user funnel: /sign-up/apply/[token] pre-fills profession +
 *      province from the vacancy, the one-tap skills chips save to the
 *      profile, the application row exists AT SIGN-UP (before email
 *      verification), and the congrats dialog routes to /verify-email.
 *
 * Self-resetting: demo-vacancy invitations + the funnel-created user
 * are deleted at start + end; the flag is removed (default OFF) after.
 */
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import postgres from "postgres";

const SEED_PASSWORD = "sebenza-dev-2026";
const SEEKER_EMAIL = "andile-z@example.co.za";
const EMPLOYER_EMAIL = "naledi.khumalo@discovery.co.za";

const FLAG = "feature_flag_vacancy_self_apply";
const TOKEN = "sa-demo-it-support-2026-fixed01";
const APPLY_PATH = `/en/apply/${TOKEN}`;
const VACANCY_ID = "vac_it-support-technician";
const NEW_USER_EMAIL_PREFIX = "e2e-self-apply-";

let sql: ReturnType<typeof postgres> | null = null;

async function setFlag(on: boolean) {
  if (!sql) return;
  await sql`
    INSERT INTO platform_settings (key, value)
    VALUES (${FLAG}, ${on ? "true" : "false"}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = ${on ? "true" : "false"}::jsonb
  `;
}

async function cleanup() {
  if (!sql) return;
  // All invitations on the demo vacancy are test artefacts (seed ships none).
  await sql`DELETE FROM vacancy_invitations WHERE vacancy_id = ${VACANCY_ID}`;
  // The funnel-created account (cascades profile/consents/skills via FKs).
  await sql`
    DELETE FROM app_user WHERE email LIKE ${NEW_USER_EMAIL_PREFIX + "%"}
  `;
}

test.beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing  see playwright.config.");
  sql = postgres(url, { max: 1 });
  await cleanup();
  await sql`DELETE FROM platform_settings WHERE key = ${FLAG}`;
});

test.afterAll(async () => {
  if (!sql) return;
  await cleanup();
  await sql`DELETE FROM platform_settings WHERE key = ${FLAG}`;
  await sql.end();
  sql = null;
});

async function shoot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: `test-results/screenshots/${testInfo.project.name}/${name}.png`,
    fullPage: false,
  });
}

async function dismissCookieBanner(page: Page) {
  await page
    .getByRole("button", { name: /accept all/i })
    .click({ timeout: 8_000 })
    .catch(() => {});
}

async function signIn(page: Page, email: string, urlRe: RegExp) {
  await page.goto("/en/sign-in");
  await dismissCookieBanner(page);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(urlRe, { timeout: 30_000 });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Dark ship
// ─────────────────────────────────────────────────────────────────────────────

test("flag OFF: the public link renders the calm not-accepting panel", async ({
  page,
}, testInfo) => {
  await setFlag(false);
  await page.goto(APPLY_PATH);
  await dismissCookieBanner(page);

  await expect(
    page.getByRole("heading", {
      name: /isn.t accepting applications/i,
    }),
  ).toBeVisible();
  // Nothing about the actual vacancy leaks in the dark state.
  await expect(page.getByText("IT Support Technician")).toHaveCount(0);
  await expect(page.getByText(/discovery/i)).toHaveCount(0);
  await shoot(page, testInfo, "self-apply-0-flag-off");
});

// ─────────────────────────────────────────────────────────────────────────────
// 2 + 3. Anonymous dossier → seeker apply arc
// ─────────────────────────────────────────────────────────────────────────────

test("flag ON: anonymous dossier (no salary) → seeker applies → pipeline + inbox", async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await setFlag(true);
  // Fresh run  no prior application by the seeker.
  await sql!`DELETE FROM vacancy_invitations WHERE vacancy_id = ${VACANCY_ID}`;

  // ── Anonymous: full dossier, NO salary (D2) ──────────────────────────
  await page.goto(APPLY_PATH);
  await dismissCookieBanner(page);
  const main = page.getByRole("main");

  await expect(
    main.getByRole("heading", { name: "IT Support Technician" }),
  ).toBeVisible();
  await expect(main).toContainText("Discovery Bank");
  await expect(main).toContainText("Customer service");
  await expect(main).toContainText("Microsoft Excel");
  await expect(main).toContainText("SQL");
  // The salary band NEVER renders anonymously.
  await expect(main.getByText(/R\s?240k/)).toHaveCount(0);
  await expect(main.getByText(/salary/i)).toHaveCount(0);
  await shoot(page, testInfo, "self-apply-1-public-anonymous");

  // ── Sign in via the page's own affordance (next= round trip) ─────────
  await main.getByRole("link", { name: /already on sebenza\? sign in/i }).click();
  await page.waitForURL(/\/sign-in/);
  await page.locator("#email").fill(SEEKER_EMAIL);
  await page.locator("#password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(new RegExp(`/apply/${TOKEN}`), { timeout: 30_000 });

  // Signed-in seeker DOES see the salary (employer left it visible).
  await expect(main.getByText(/R\s?240k/)).toBeVisible();
  await shoot(page, testInfo, "self-apply-2-seeker-sees-salary");

  // ── The apply moment: confirm dialog with the D4 disclosure ──────────
  await main.getByRole("button", { name: /apply now/i }).click();
  const confirm = page.getByRole("dialog", {
    name: /apply for it support technician/i,
  });
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText(
    "Applying shares your profile with Discovery Bank",
  );
  await expect(confirm).toContainText(/R\s?240k/); // summary strip carries it
  await shoot(page, testInfo, "self-apply-3-confirm-dialog");
  await confirm.getByRole("button", { name: /confirm application/i }).click();

  // ── Congrats + the skills-gap nudge ──────────────────────────────────
  const congrats = page.getByRole("dialog", { name: /nicely done/i });
  await expect(congrats).toBeVisible({ timeout: 20_000 });
  await expect(congrats).toContainText("Discovery Bank");
  await shoot(page, testInfo, "self-apply-4-congrats-dialog");

  // DB truth: one row, origin self_apply, born accepted, no inviter.
  const rows = await sql!`
    SELECT origin, state, invited_by_user_id, responded_at
    FROM vacancy_invitations
    WHERE vacancy_id = ${VACANCY_ID}
      AND profile_id = ${"prof_andile-z"}
  `;
  expect(rows.length).toBe(1);
  expect(rows[0]!.origin).toBe("self_apply");
  expect(rows[0]!.state).toBe("accepted");
  expect(rows[0]!.invited_by_user_id).toBeNull();
  expect(rows[0]!.responded_at).not.toBeNull();

  // ── Seeker inbox: "You applied" framing ──────────────────────────────
  await congrats.getByRole("link", { name: /view my applications/i }).click();
  await page.waitForURL(/\/dashboard\/invitations/);
  const inbox = page.getByRole("main");
  await expect(inbox.getByText("You applied").first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    inbox.getByText("IT Support Technician").first(),
  ).toBeVisible();
  await shoot(page, testInfo, "self-apply-5-seeker-inbox");

  // ── Re-visit: honest already-applied panel, no second apply ──────────
  await page.goto(APPLY_PATH);
  await expect(
    page.getByText(/you.ve applied for this role/i),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /apply now/i }),
  ).toHaveCount(0);
  await shoot(page, testInfo, "self-apply-6-already-applied");
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Employer side
// ─────────────────────────────────────────────────────────────────────────────

test("employer: link panel + Self-applied chip + honest accept-rate + form toggles", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await setFlag(true);
  // Ensure exactly one self-applied row exists (idempotent across
  // project runs  desktop seeds it in the previous test; mobile-360
  // may run against a cleaned DB ordering, so insert-if-missing).
  const existing = await sql!`
    SELECT id FROM vacancy_invitations
    WHERE vacancy_id = ${VACANCY_ID} AND profile_id = ${"prof_andile-z"}
  `;
  if (existing.length === 0) {
    await sql!`
      INSERT INTO vacancy_invitations
        (id, vacancy_id, profile_id, invited_by_user_id, origin, state, responded_at)
      VALUES
        (${`inv_e2e_selfapply_${Date.now()}`}, ${VACANCY_ID}, ${"prof_andile-z"},
         NULL, 'self_apply', 'accepted', now())
    `;
  }

  await signIn(page, EMPLOYER_EMAIL, /\/employer(\/|$|\?)/);
  await dismissCookieBanner(page);
  await page.goto(`/en/employer/vacancies/${VACANCY_ID}`);
  const main = page.getByRole("main");

  // Public-link panel with the exact demo URL, marked live.
  const linkPanel = main.getByRole("region", {
    name: /self apply public link/i,
  });
  await expect(linkPanel).toBeVisible({ timeout: 15_000 });
  await expect(linkPanel).toContainText(/live/i);
  await expect(
    linkPanel.getByRole("textbox", { name: /public apply link/i }),
  ).toHaveValue(new RegExp(TOKEN));
  await shoot(page, testInfo, "self-apply-7-employer-link-panel");

  // Pipeline: the applicant carries the Self-applied chip + "Applied" date.
  await expect(main.getByText("Self-applied").first()).toBeVisible();
  await expect(main.getByText(/^Applied /).first()).toBeVisible();
  // Accept-rate honesty: the strip only counts employer invites, and
  // this vacancy has none  so no accept-rate figures render at all.
  await expect(main.getByText(/accept rate/i)).toHaveCount(0);
  await shoot(page, testInfo, "self-apply-8-employer-pipeline");

  // Edit form: the Self Apply section renders (flag ON) with the
  // toggle ticked + the salary-visibility toggle.
  await expect(
    main.getByText("Let seekers apply via a public link"),
  ).toBeVisible();
  await expect(
    main.getByText("Show the salary band to signed-in applicants"),
  ).toBeVisible();
  await shoot(page, testInfo, "self-apply-9-employer-form-toggles");
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. New-user funnel
// ─────────────────────────────────────────────────────────────────────────────

/** Drive the DatePicker (button-calendar, no text input) to a fixed DOB. */
async function pickDob(page: Page, year: number) {
  await page.locator("#dateOfBirth").click();
  const dialog = page.getByRole("dialog").last();
  // days → months → years
  await dialog
    .getByRole("button", { name: "Switch to month picker" })
    .click();
  await dialog.getByRole("button", { name: "Switch to year picker" }).click();
  // Page back until the target year is on the 12-year grid (bounded).
  for (let i = 0; i < 8; i++) {
    const target = dialog.getByRole("button", {
      name: String(year),
      exact: true,
    });
    if (await target.isVisible().catch(() => false)) {
      await target.click();
      break;
    }
    await dialog.getByRole("button", { name: "Previous" }).click();
  }
  await dialog.getByRole("button", { name: /^Jun/ }).click();
  // Day cells are role="option" inside the listbox grid, not buttons.
  await dialog.getByRole("option", { name: "15", exact: true }).click();
}

test("new-user funnel: prefills + one-tap skills + application recorded at sign-up", async ({
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await setFlag(true);
  const email = `${NEW_USER_EMAIL_PREFIX}${testInfo.project.name}@example.co.za`;
  await sql!`DELETE FROM app_user WHERE email = ${email}`;

  // Anonymous Apply → the sign-up funnel with the vacancy pinned.
  await page.goto(APPLY_PATH);
  await dismissCookieBanner(page);
  await page.getByRole("main").getByRole("link", { name: /apply now/i }).click();
  await page.waitForURL(new RegExp(`/sign-up/apply/${TOKEN}`));
  await expect(page.getByText(/you.re applying for/i).first()).toBeVisible();
  await expect(page.getByText("IT Support Technician").first()).toBeVisible();
  await shoot(page, testInfo, "self-apply-10-signup-landing");

  // ── Step 1 ───────────────────────────────────────────────────────────
  await page.locator("#fullName").fill("Enzokuhle Dube");
  await page.locator("#email").fill(email);
  await pickDob(page, 1998);
  await page.locator("#password").fill("e2e-SelfApply-2026!");
  await page.locator("#passwordConfirm").fill("e2e-SelfApply-2026!");
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  // ── Step 2: searchability pre-ticked; accept the T&C contract ────────
  // The Checkbox primitive hides the input (sr-only) behind a styled
  // label  click the label text, then assert the input state.
  await page.getByText(/^I agree to the/).click();
  await expect(
    page.getByRole("checkbox", { name: /i agree to the/i }),
  ).toBeChecked();
  await page
    .getByRole("button", { name: /grant consent & continue/i })
    .click();

  // ── Step 3: vacancy prefills + the one-tap skills chips ─────────────
  // Combobox + CustomSelect render button triggers; values show as text.
  await expect(page.locator("#profession")).toContainText(/help desk/i);
  await expect(page.locator("#province")).toContainText("Gauteng");
  const skillsBox = page.getByRole("group", { name: /skills for this role/i });
  await expect(skillsBox).toBeVisible();
  await expect(skillsBox).toContainText("IT Support Technician");
  await skillsBox
    .getByRole("button", { name: /customer service/i })
    .click();
  await skillsBox
    .getByRole("button", { name: /microsoft excel/i })
    .click();
  await shoot(page, testInfo, "self-apply-11-signup-skills-chips");
  await page.getByRole("button", { name: /create my profile/i }).click();

  // ── Congrats dialog (new-user variant) → /verify-email ───────────────
  const congrats = page.getByRole("dialog", { name: /nicely done/i });
  await expect(congrats).toBeVisible({ timeout: 30_000 });
  await expect(congrats).toContainText("Verify your email");
  await expect(congrats).toContainText("Complete your profile");
  await shoot(page, testInfo, "self-apply-12-signup-congrats");
  await congrats.getByRole("button", { name: /verify my email/i }).click();
  await page.waitForURL(/\/verify-email/);

  // ── DB truth: recorded AT SIGN-UP, before any email verification ─────
  const users = await sql!`SELECT id FROM app_user WHERE email = ${email}`;
  expect(users.length).toBe(1);
  const userId = users[0]!.id as string;

  const profiles = await sql!`
    SELECT id FROM profiles WHERE user_id = ${userId}
  `;
  expect(profiles.length).toBe(1);
  const profileId = profiles[0]!.id as string;

  const invRows = await sql!`
    SELECT origin, state FROM vacancy_invitations
    WHERE vacancy_id = ${VACANCY_ID} AND profile_id = ${profileId}
  `;
  expect(invRows.length).toBe(1);
  expect(invRows[0]!.origin).toBe("self_apply");
  expect(invRows[0]!.state).toBe("accepted");

  // The tapped chips landed on the PROFILE (not just the application).
  const skills = await sql!`
    SELECT skill_slug FROM profile_skills WHERE profile_id = ${profileId}
    ORDER BY skill_slug
  `;
  expect(skills.map((s) => s.skill_slug)).toEqual([
    "customer-service",
    "excel",
  ]);

  // Audit evidence: the D4 disclosure travelled with the signup source.
  const audit = await sql!`
    SELECT meta FROM audit_log
    WHERE kind = 'vacancy.self_apply' AND actor = ${userId}
  `;
  expect(audit.length).toBe(1);
  const meta = audit[0]!.meta as Record<string, unknown>;
  expect(meta.source).toBe("signup");
  expect(String(meta.disclosure)).toContain("Discovery Bank");
});
