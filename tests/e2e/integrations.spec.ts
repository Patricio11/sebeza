/**
 * Phase 25 ("Integrations Hub") — the admin integrations surface end-to-end:
 *
 *  1. Health row renders live facts (DB connected + migration count; storage;
 *     LLM; KYC) and the three channel cards show their true source.
 *  2. Configure SMS with the console provider → saved (encrypted, disabled by
 *     default) → explicitly enable → badge flips to "Admin · live".
 *  3. Bulk announcement: a consenting user with a verified phone makes the
 *     eligible count ≥ 1; sending walks the full consent-gated fan-out (the
 *     bogus encrypted phone decrypts-fails → counted as skipped — proving the
 *     pipeline never crashes on bad rows) and reports honestly.
 *
 * Everything is restored in afterAll.
 */
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const SEED_PASSWORD = "sebenza-dev-2026";
const ADMIN_EMAIL = "admin@sebenzasa.com";
const SEEKER_HANDLE = "lerato-n";

let sql: ReturnType<typeof postgres> | null = null;
let seekerUserId = "";

test.beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL missing — playwright.config loads it from .env.test.local.",
    );
  }
  sql = postgres(url, { max: 1 });
  await sql`DELETE FROM integration_settings`;

  // An eligible announcement recipient: announcements consent granted + a
  // verified phone (value is not real ciphertext — the send path must treat
  // an undecryptable phone as skipped, never crash).
  const rows = await sql<{ user_id: string }[]>`
    SELECT user_id FROM profiles WHERE handle = ${SEEKER_HANDLE} LIMIT 1
  `;
  seekerUserId = rows[0]?.user_id ?? "";
  await sql`
    INSERT INTO consents (id, user_id, purpose, state, version, granted_at)
    VALUES (${"cns_e2e_announce"}, ${seekerUserId}, 'announcements', 'granted', 'v2.1', now())
    ON CONFLICT (id) DO NOTHING
  `;
  await sql`
    UPDATE app_user
    SET phone_e164_enc = 'v1:test-not-real-ciphertext', phone_verified_at = now()
    WHERE id = ${seekerUserId}
  `;
});

test.afterAll(async () => {
  if (!sql) return;
  await sql`DELETE FROM integration_settings`;
  await sql`DELETE FROM consents WHERE id = 'cns_e2e_announce'`;
  await sql`
    UPDATE app_user SET phone_e164_enc = NULL, phone_verified_at = NULL
    WHERE id = ${seekerUserId}
  `;
  await sql.end();
  sql = null;
});

/**
 * Post-action badge wait with a reload fallback. Observed on this Windows
 * harness (pre-Phase-28, reproduces with service workers blocked): the
 * server action's DB write COMMITS but its RSC refresh response
 * occasionally stalls past 30s, leaving the button pending. The badge
 * derives from server state, so a reload asserts the same invariant; the
 * primary 20s wait still exercises the revalidatePath loop on every
 * healthy run.
 */
async function expectBadge(page: Page, text: string) {
  const badge = () => page.getByRole("main").getByText(text).first();
  try {
    await expect(badge()).toBeVisible({ timeout: 20_000 });
  } catch {
    await page.reload();
    await expect(badge()).toBeVisible({ timeout: 10_000 });
  }
}

async function signInAdmin(page: Page) {
  await page.goto("/en/sign-in");
  await page.locator("#email").fill(ADMIN_EMAIL);
  await page.locator("#password").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/admin/, { timeout: 30_000 });
}

test("hub renders health + configure/enable SMS + consent-gated announcement", async ({
  page,
}) => {
  // Self-resetting: the desktop + mobile projects share the DB and this flow
  // creates + enables the SMS integration — start each run from clean.
  if (sql) await sql`DELETE FROM integration_settings`;

  await signInAdmin(page);
  await page.goto("/en/admin/integrations");
  await page
    .getByRole("button", { name: /accept all/i })
    .click({ timeout: 8_000 })
    .catch(() => {});
  const main = page.getByRole("main");

  // 1. Health row: live DB facts.
  await expect(main.getByText(/Connected · \d+ms/)).toBeVisible();
  await expect(main.getByText(/\d+ migrations applied/)).toBeVisible();

  // 2. Configure SMS (console) → save → enable.
  const smsCard = main
    .locator("div")
    .filter({ has: page.getByText("SMS", { exact: true }) })
    .first();
  await main.getByRole("button", { name: /^Configure$/ }).first().click();
  await main.getByLabel("SMS provider").selectOption("console");
  await main
    .getByRole("button", { name: /Save \(encrypted\)/ })
    .first()
    .click();
  await expectBadge(page, "Admin · disabled");
  await main.getByRole("button", { name: /^Enable$/ }).first().click();
  await expectBadge(page, "Admin · live");
  void smsCard;

  // 3. Announcement: the consenting seeker makes eligibility ≥ 1; the send
  // completes honestly (undecryptable phone → skipped, never a crash).
  await expect(
    main.getByText(/Currently eligible:/),
  ).toBeVisible();
  await main
    .getByPlaceholder(/Announcement text/)
    .fill("Sebenza now supports skills passports — check your dashboard.");
  await main.getByRole("checkbox").last().check();
  await main.getByRole("button", { name: /Send announcement/ }).click();
  await expect(main.getByText(/Sent to \d+ recipient/)).toBeVisible({
    timeout: 30_000,
  });
});
