# AWS Cape Town `af-south-1` migration runbook

> Triggered when partnership / commercial pilot lands. Until then the
> system runs on Neon (EU). Everything in this runbook is engineered
> to be a one-day operation with zero remaining POPIA work to do 
> all the compliance, encryption, audit-logging, and consent surfaces
> are already shipped against the current DB and stay identical
> against the destination.

Last updated 2026-05-23.

---

## Why this is a clean swap (and not a re-architecture)

Drizzle is driver-agnostic. The migration is a single-file change:

```ts
// db/client.ts (current)
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

// db/client.ts (post-migration)
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
```

The schema, the queries, the seed script, the migrations table  all
identical. The application code never knows we moved.

What also doesn't change on migration day:

- **Privacy Policy** (`/privacy`)  section 7 already promises this
  exact move; no copy edit needed.
- **PAIA manual** (`/paia`)  section 4 already lists the destination.
- **DPIA** (`docs/popia/DPIA.md`)  explicitly notes the move as a
  risk mitigation.
- **Encryption inventory** (`docs/popia/ENCRYPTION_INVENTORY.md`) 
  AES-256-GCM application layer is identical; provider-level
  encryption-at-rest moves from Neon-managed to AWS-managed,
  documented as such.
- **All audit-log retention, consent gates, cron jobs, KYC / SAQA
  adapters**  DB-agnostic; carry over verbatim.

What DOES change:

- The `DATABASE_URL` env var (host + port + SSL config).
- The connection driver in `db/client.ts`.
- The PITR retention window (Neon: 7 days; RDS default: 35 days).
- The backup-storage location (in-country instead of EU).

---

## Pre-cutover checklist (T-7 days)

- [ ] AWS account provisioned in `af-south-1` with IAM lock-down
      (engineering team only, audited via CloudTrail).
- [ ] RDS Postgres 16 (matching Neon's PG version exactly) instance
      sized for current data volume + 12-month growth projection.
      Recommend `db.t4g.small` for pilot, `db.t4g.medium` for launch.
- [ ] Multi-AZ deployment for HA. Encrypted at rest with a
      customer-managed KMS key in `af-south-1`.
- [ ] Automated daily snapshots → S3 bucket in `af-south-1` (not
      cross-region). Retention 35 days minimum; 90 days recommended.
- [ ] Performance Insights + Enhanced Monitoring on.
- [ ] Security group: inbound only from Vercel egress IPs +
      operator bastion. Outbound limited.
- [ ] Run `npm run db:generate && npm run db:migrate` against a
      staging RDS instance to confirm every migration in
      `db/migrations/` applies cleanly to a fresh PG 16.
- [ ] DPA + sub-processor agreement on file with AWS for the
      `af-south-1` region  confirm POPIA alignment in writing.

## Cutover day (sized for ~4 hours including verification)

### Step 1  Freeze writes (T+0)
Set `MAINTENANCE_MODE=true` in Vercel env; deploy. The proxy already
has the hook (commented in `proxy.ts`) to return a 503 with a JSON
"maintenance" body for every non-read endpoint.

### Step 2  Final Neon snapshot (T+10 min)
```bash
# Latest Neon backup snapshot via Neon console  this is the rollback.
# Note the snapshot ID + creation timestamp.
```

### Step 3  pg_dump → pg_restore (T+30 min)
```bash
# From an admin laptop with both connection strings in env:
pg_dump "$NEON_URL" \
  --format=custom \
  --no-owner --no-privileges \
  --no-tablespaces \
  --jobs=4 \
  --file=sebenza-cutover.dump

pg_restore \
  --clean --if-exists \
  --no-owner --no-privileges \
  --jobs=4 \
  --dbname="$AWS_URL" \
  sebenza-cutover.dump
```

Re-run `npm run db:migrate` against the AWS DB to confirm the
migrations table state is honest. The `pg_restore` above carries the
source DB's `drizzle.__drizzle_migrations` table verbatim, so this is a
clean no-op when the source bookkeeping is honest. If `db:migrate`
instead tries to re-apply (or silently skips) migrations, the source
table had drifted — diagnose with `npx tsx scripts/diagnose-migrations.mts`
and re-align with `npx tsx scripts/reconcile-migrations.mts` (bookkeeping
only; see `docs/completed/MIGRATION_JOURNAL_RECOVERY_PLAN.md`).

### Step 4  Smoke against staging Vercel preview pointed at AWS
```bash
# Spin up a Vercel preview with DATABASE_URL set to the new instance.
# Confirm /insights renders, /admin loads, /api/lmi returns,
# /api/admin/outcomes-compliance returns ok:true on every check.
```

### Step 5  Cutover (T+2 hours)
- Update production `DATABASE_URL` in Vercel env to AWS RDS.
- Edit `db/client.ts` to use `drizzle-orm/postgres-js`:
  ```ts
  import { drizzle } from "drizzle-orm/postgres-js";
  import postgres from "postgres";
  const sql = postgres(process.env.DATABASE_URL!, { ssl: "require" });
  export const getDb = () => drizzle(sql, { schema });
  ```
- `npm install postgres`, remove `@neondatabase/serverless` from
  `package.json`.
- Push to main → Vercel redeploys.
- Set `MAINTENANCE_MODE=false`; deploy.

### Step 6  Verify (T+3 hours)
- Sign in as admin → run `/api/admin/outcomes-compliance` → confirm
  all 4 assertions pass.
- Trigger a cron manually with the CRON_SECRET header → confirm a
  successful response.
- Confirm `/insights` renders the LMI + outcomes section + heatmap
  with the same numbers as pre-cutover.
- Check Sentry (if wired)  no error spike.

### Step 7  Keep Neon as read-only rollback (30 days)
- Don't deprovision Neon for 30 days.
- If a regression surfaces, revert `db/client.ts` + `DATABASE_URL`,
  redeploy.

---

## Post-cutover updates (T+1 day)

- [ ] Update `docs/TO_START_EVERY_SESSION.md` "Postgres hosting path"
      bullet to past-tense.
- [ ] Update `docs/popia/RETENTION_POLICY.md` "Sub-processor data"
      section: Neon row removed, AWS RDS row added.
- [ ] Update `/privacy` Section 7  change "before commercial launch
      we migrate" to "we host on AWS Cape Town (`af-south-1`)".
- [ ] Update `/paia` Section 6 → Sub-processors → swap Neon for AWS.
- [ ] Tag the commit `aws-cape-town-cutover-YYYY-MM-DD`.

---

## Rollback procedure

If anything is wrong inside the first 30 days:

1. Revert `db/client.ts` to the Neon driver.
2. Revert `DATABASE_URL` to the Neon connection string.
3. Redeploy.
4. Re-run any cron jobs that fired during the AWS window  they're
   idempotent (skill-gap-snapshot, outcome-snapshots, lmi-snapshot
   all just append).
5. Audit-log entries from the AWS window can be `pg_dump`'d and
   appended to Neon  see `pg_dump --table=audit_log`.

---

## What this runbook does NOT require

Anything POPIA-related. The current build is already POPIA-compliant
on Neon (EU). The AWS Cape Town move strengthens the data-residency
posture but adds no new compliance surface. That is the point: it's
just an infrastructure swap.
