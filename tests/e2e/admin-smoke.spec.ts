/**
 * Admin workspace smoke walk (docs/ADMIN_AUDIT_2026_08.md).
 *
 * One signed-in admin visits EVERY admin surface and the suite fails
 * on any of the four smells that mean "not working smoothly":
 *   1. the route error boundary rendered ("Something went wrong")
 *   2. the 404 boundary rendered (a nav entry pointing at nothing)
 *   3. a console/page error fired during render (incl. next-intl
 *      MISSING_MESSAGE - the raw-i18n-key bug class from Phase 25.4)
 *   4. the page has no main landmark or no heading at all
 *
 * This is deliberately a WALK, not a workflow test - the admin
 * workflows themselves are covered by their own specs
 * (admin-custom-skills, admin-learning-paths, admin-skill-prereqs,
 * integrations, ai-coach-switch, testimonials, taxonomy integration
 * suite). The walk is what catches the page nobody has opened since a
 * refactor.
 *
 * Screenshots land in test-results/screenshots/<project>/admin-smoke-*
 * so a human can eyeball every surface after a run.
 */
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const SEED_PASSWORD = "sebenza-dev-2026";
const ADMIN_EMAIL = "admin@sebenzasa.com";

/** Every admin surface, incl. representative dynamic detail pages. */
const ADMIN_ROUTES: ReadonlyArray<{ path: string; name: string }> = [
  { path: "/en/admin", name: "overview" },
  { path: "/en/admin/verifications", name: "verifications" },
  { path: "/en/admin/moderation", name: "moderation" },
  { path: "/en/admin/taxonomy", name: "taxonomy" },
  { path: "/en/admin/taxonomy/suggestions", name: "taxonomy-suggestions" },
  { path: "/en/admin/curriculum", name: "curriculum" },
  { path: "/en/admin/learning-paths", name: "learning-paths" },
  { path: "/en/admin/custom-skills", name: "custom-skills" },
  { path: "/en/admin/skill-prereqs", name: "skill-prereqs" },
  { path: "/en/admin/integrations", name: "integrations" },
  { path: "/en/admin/llm", name: "llm" },
  { path: "/en/admin/crisis-resources", name: "crisis-resources" },
  { path: "/en/admin/testimonials", name: "testimonials" },
  { path: "/en/admin/audit-log", name: "audit-log" },
  { path: "/en/admin/oversight", name: "oversight" },
  { path: "/en/admin/users", name: "users" },
  { path: "/en/admin/users/user_andile-z", name: "user-detail" },
  { path: "/en/admin/notifications", name: "notifications" },
  { path: "/en/admin/help", name: "help" },
  {
    path: "/en/admin/help/suggestion-workflow-user-other-entries",
    name: "help-article",
  },
  { path: "/en/admin/settings", name: "settings" },
  { path: "/en/admin/account", name: "account" },
];

async function shoot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: `test-results/screenshots/${testInfo.project.name}/${name}.png`,
    fullPage: false,
  });
}

test("admin smoke walk: every surface renders clean", async ({
  page,
}, testInfo) => {
  test.setTimeout(240_000);

  // Console + page error capture across the whole walk, attributed to
  // the route that was loading when they fired.
  const errors: string[] = [];
  let currentRoute = "(sign-in)";
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(`[${currentRoute}] console: ${msg.text().slice(0, 300)}`);
    }
  });
  page.on("pageerror", (err) => {
    errors.push(`[${currentRoute}] pageerror: ${String(err).slice(0, 300)}`);
  });

  // Sign in as the seeded admin.
  await page.goto("/en/sign-in");
  await page
    .getByRole("button", { name: /accept all/i })
    .click({ timeout: 8_000 })
    .catch(() => {});
  await page.locator("#email").fill(ADMIN_EMAIL);
  await page.locator("#password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/admin(\/|$|\?)/, { timeout: 30_000 });

  for (const route of ADMIN_ROUTES) {
    currentRoute = route.name;
    const response = await page.goto(route.path, {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status(), `${route.path} HTTP status`).toBe(200);

    const main = page.getByRole("main");
    await expect(main, `${route.path} must have a main landmark`).toBeVisible({
      timeout: 15_000,
    });

    // Neither boundary may render.
    await expect(
      page.getByText("Something went wrong"),
      `${route.path} rendered the error boundary`,
    ).toHaveCount(0);
    await expect(
      page.getByText(/isn't in the register/i),
      `${route.path} rendered the 404 boundary`,
    ).toHaveCount(0);

    // Some heading must exist (a blank shell is a broken page too).
    expect(
      await page.getByRole("heading").count(),
      `${route.path} has no headings at all`,
    ).toBeGreaterThan(0);

    await shoot(page, testInfo, `admin-smoke-${route.name}`);
  }

  // MISSING_MESSAGE is the raw-i18n-key bug class; any console/page
  // error during an admin render is a finding, not noise.
  expect(errors, errors.join("\n")).toEqual([]);
});
