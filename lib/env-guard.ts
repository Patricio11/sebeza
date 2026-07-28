import "server-only";

/**
 * Phase 32.3.3 (security remediation)  fail-closed guard for the E2E
 * test escape hatch.
 *
 * `SEBENZA_E2E_HTTP=1` weakens TWO real controls so the Playwright
 * suite can run the production build over plain http on localhost:
 *
 *   1. `lib/auth/dal.ts`  exempts admins from the production 2FA
 *      hard-require (dropping them back to `feature_flag_2fa_enforced`,
 *      which defaults to FALSE, i.e. password-only admin access);
 *   2. `proxy.ts`  drops `upgrade-insecure-requests` from the CSP.
 *
 * Until now the only thing standing between that and production was a
 * code comment saying "must never be set in a real deployment". The
 * variable was not even listed in `.env.example`, so an audit of the
 * environment surface would not have surfaced it. Anyone with access to
 * project settings (or a CI token, or a copy-pasted env block from the
 * E2E config) could silently disable admin 2FA platform-wide, with no
 * log line and no visible symptom.
 *
 * A comment is not a control. This throws at module load instead: in a
 * genuine production environment the process refuses to start rather
 * than starting insecurely. Loud failure beats silent weakening  and a
 * deploy that crashes gets noticed in minutes, where a quietly disabled
 * second factor might never be noticed at all.
 */
export function assertNoTestEscapeHatchesInProduction(): void {
  if (process.env.SEBENZA_E2E_HTTP !== "1") return;

  // `VERCEL_ENV` is the deployment-truth signal on Vercel
  // ("production" | "preview" | "development"); NODE_ENV is
  // "production" for any production BUILD, including the local E2E
  // server, so it cannot be the discriminator on its own.
  const isRealDeployment =
    process.env.VERCEL_ENV === "production" ||
    process.env.VERCEL_ENV === "preview";

  if (isRealDeployment) {
    throw new Error(
      "FATAL: SEBENZA_E2E_HTTP=1 is set in a deployed environment " +
        `(VERCEL_ENV=${process.env.VERCEL_ENV}). This flag exists ONLY for the ` +
        "local Playwright harness: it exempts admins from the 2FA hard-require " +
        "and strips upgrade-insecure-requests from the CSP. Remove it from the " +
        "environment and redeploy.",
    );
  }
}
