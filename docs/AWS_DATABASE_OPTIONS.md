# Sebenza on AWS Cape Town  database options

> **Region**: `af-south-1` (Cape Town). **Decision point**: when the partnership confirms, you need to choose between two paths to host Sebenza's PostgreSQL in-country.
>
> This document compares both end-to-end so the choice is informed, not improvised. **Recommendation at the bottom.**

---

## Table of contents

- [Option 1  EC2 + Docker + self-hosted PostgreSQL](#option-1--ec2--docker--self-hosted-postgresql)
- [Option 2  Managed database (Aurora / RDS)](#option-2--managed-database-aurora--rds)
- [Side-by-side comparison](#side-by-side-comparison)
- [Recommendation](#recommendation)

---

# Option 1  EC2 + Docker + self-hosted PostgreSQL

You operate a single EC2 instance running PostgreSQL 16 inside a Docker container, with data on a separate EBS volume.

## Architecture

```
                                ┌─────────────────────────────────┐
                                │  AWS af-south-1                 │
   Vercel (production)          │  ┌───────────────────────────┐  │
   ┌─────────────────┐          │  │ EC2 t4g.small             │  │
   │ Next.js +       │ ───SSL──▶│  │ ┌─────────────────────┐   │  │
   │ Server Actions  │   :5432  │  │ │ Docker container     │   │  │
   │ pg_pool         │          │  │ │ postgres:16.4        │   │  │
   └─────────────────┘          │  │ │                     │   │  │
                                │  │ └──────┬──────────────┘   │  │
                                │  │        │ /var/lib/postgresql│
                                │  │  ┌─────▼──────────┐        │  │
                                │  │  │ EBS gp3 (50GB)│        │  │
                                │  │  │ encrypted (KMS)│        │  │
                                │  │  └─────┬──────────┘        │  │
                                │  └────────┼──────────────────┘  │
                                │   ┌───────▼─────────┐            │
                                │   │ EBS snapshots   │            │
                                │   │ + S3 pg_dumps   │            │
                                │   └─────────────────┘            │
                                └─────────────────────────────────┘
```

## Cost breakdown

### Pilot (≤1K active users)

| Component | $/month |
|---|---|
| EC2 `t4g.small` (2 vCPU, 2 GB RAM, ARM) | $15 |
| EBS gp3 root (30 GB) | $3 |
| EBS gp3 data volume (50 GB) | $5 |
| Daily EBS snapshots (35-day retention) | $3 |
| Elastic IP (when attached) | free |
| S3 backup bucket (~10 GB) | $1 |
| Data transfer out (~10 GB/mo) | $1 |
| **Database total** | **~$28** |

### Soft launch (~10K active users)

| Component | $/month |
|---|---|
| EC2 `t4g.medium` (4 vCPU, 4 GB RAM) | $30 |
| EBS gp3 root + data (100 GB) | $10 |
| Daily EBS snapshots | $5 |
| S3 backups (~20 GB) | $2 |
| Data transfer out (~30 GB) | $3 |
| **Database total** | **~$50** |

### National launch (~50-100K users)

| Component | $/month |
|---|---|
| EC2 `t4g.large` (2 vCPU, 8 GB RAM) | $60 |
| EBS gp3 root + data (200 GB) | $20 |
| Daily EBS snapshots | $10 |
| S3 backups (~50 GB) | $5 |
| Data transfer out (~100 GB) | $9 |
| Second EC2 for warm standby (manual failover) | $60 |
| **Database total** | **~$164** |

## Supporting AWS services for this path

These are the surrounding tools you need to make the self-hosted setup production-grade:

| Tool | Purpose | $/month |
|---|---|---|
| **AWS Secrets Manager** | Stores `DATABASE_URL`, `SEBENZA_ENCRYPTION_KEY`, `BETTER_AUTH_SECRET` with rotation. 3-5 secrets × $0.40 | ~$2 |
| **AWS KMS** (customer-managed key) | At-rest encryption for EBS + S3 backups. 1 key × $1 | $1 |
| **AWS CloudTrail** | Audit log of every AWS console action | free (management events) |
| **AWS CloudWatch** | Custom metrics from your CWAgent on the EC2 | ~$5 |
| **AWS CloudWatch Alarms** | CPU / disk / memory / status alarms | ~$1 |
| **AWS S3** | Backup bucket | ~$1-5 |
| **AWS Route 53** | Optional, for `db.sebenzasa.com` DNS | $0.50 + $0.40 per million queries |
| **AWS GuardDuty** (recommended) | Anomaly detection across your AWS footprint | ~$10-30 |
| **Let's Encrypt** (via Certbot on EC2) | Postgres SSL cert (free) | free |
| **AWS Activate credits** | Up to $100K offsets all of the above for months | covers everything |
| **Supporting total** | | **~$20-50/month** |

## Pros

- ✅ **Cheapest by far** at every scale tier
- ✅ Full Postgres feature set (no vendor restrictions, no Aurora-specific quirks)
- ✅ Single-tenant  your DB isn't sharing infrastructure with anyone
- ✅ Trivial to add extensions, change `postgresql.conf`, tune to your exact workload
- ✅ Snapshot-based DR is solid for Sebenza's data volume (small)
- ✅ Lock-in proof  `pg_dump`/`pg_restore` portable to any Postgres anywhere

## Cons

- ❌ **You are the DBA.** No managed failover, no managed patching, no automated minor-version upgrades
- ❌ **Single-AZ by default**  an AZ outage takes you offline until you manually fail over to the standby (if you've built one)
- ❌ Multi-AZ HA is a multi-day project you have to build (streaming replication + failover automation)
- ❌ Restoration from `pg_dump` of a multi-GB DB takes 5-30 minutes vs RDS PITR's seconds-to-minutes
- ❌ Operating-system maintenance (kernel patches, fail2ban updates, Docker upgrades) is on you
- ❌ Connection pooling: Postgres native handles it OK at low scale; past ~50K connections/day you may need pgBouncer

## Setup walkthrough

Full step-by-step (16 sections + 3 appendices) lives at:

→ **[`docs/AWS_EC2_DOCKER_POSTGRES_GUIDE.md`](AWS_EC2_DOCKER_POSTGRES_GUIDE.md)**

Topics covered: AWS account + IAM, VPC + security groups, EC2 launch, OS hardening, Docker install, EBS data volume, PostgreSQL via docker-compose, migrations, Vercel wiring, TLS, backups, monitoring, smoke verification, rollback, daily operator runbook.

## When this option is right

- You're in **pilot phase** with a confirmed partner and ≤5K users
- You have AWS Activate credits to spend
- You have at least one team member comfortable with Linux + Docker + Postgres
- You want maximum cost efficiency above operational ease
- You're willing to migrate to managed (Option 2) when you outgrow it

---

# Option 2  Managed database (Aurora / RDS)

You let AWS run the Postgres for you. Two sub-options:

- **Aurora Postgres-Compatible** (recommended)  AWS's purpose-built database with 6-way replicated storage across 3 AZs, sub-30s failover, near-free read replicas
- **RDS Postgres**  classic managed Postgres, Multi-AZ tickbox gives you ~60-120s failover, cheaper base cost

## Architecture

```
                                ┌──────────────────────────────────────────┐
                                │  AWS af-south-1                          │
   Vercel (production)          │                                          │
   ┌─────────────────┐          │  ┌──────────────────────────────────┐   │
   │ Next.js +       │ ───SSL──▶│  │ Aurora cluster endpoint          │   │
   │ Server Actions  │  cluster │  │ (writes)                         │   │
   │ pg_pool         │ endpoint │  └─────────┬────────────────────────┘   │
   └─────────────────┘          │            │                            │
                                │  ┌─────────▼────────┐                   │
                                │  │  Writer instance │                   │
                                │  │  (db.t4g.medium  │                   │
                                │  │   or Serverless) │                   │
                                │  └─────────┬────────┘                   │
                                │            │                            │
                                │  ┌─────────▼───────────────────────┐    │
                                │  │ Aurora storage layer            │    │
                                │  │ 6-way replicated across 3 AZs   │    │
                                │  │ KMS-encrypted at rest           │    │
                                │  │ Auto-grow up to 128 TB          │    │
                                │  └─────────────────────────────────┘    │
                                │  ┌────────────────────────┐              │
                                │  │ Optional reader        │              │
                                │  │ instance (analytics)   │              │
                                │  └────────────────────────┘              │
                                │  ┌────────────────────────┐              │
                                │  │ Automated backups +     │              │
                                │  │ PITR (35 days)          │              │
                                │  └────────────────────────┘              │
                                └──────────────────────────────────────────┘
```

## Cost breakdown  Aurora

### Aurora Serverless v2 (scale-to-zero, since 2024)

The smartest pilot choice. Pays per ACU-second. 1 ACU ≈ 2 GB RAM + proportional CPU.

| Configuration | Idle $/mo | Active $/mo | Use case |
|---|---|---|---|
| 0.5-4 ACU range, scale-to-zero ON | ~$0-15 | **~$60-120** | **Pilot to soft launch** |
| 0.5-16 ACU range, scale-to-zero ON | ~$0-15 | **~$80-300** | Soft launch with bursts |
| 1-32 ACU range, no scale-to-zero | ~$95 idle | **~$150-600** | Steady-traffic launch |

Plus:
- Storage: $0.115/GB-month  Sebenza ~5-20 GB → ~$1-3/mo
- I/O: $0.22 per million requests  ~$2-10/mo at launch scale
- Backups: free up to your DB size

### Aurora Provisioned (fixed instance, predictable cost)

| Instance | RAM | $/month | Use case |
|---|---|---|---|
| `db.t4g.medium` (writer only) | 4 GB | **~$73** | Soft launch |
| `db.t4g.large` (writer only) | 8 GB | **~$146** | Launch |
| `db.r6g.large` (writer only) | 16 GB | **~$234** | First scale step |
| `db.r6g.large` + 1 reader | 16 GB ea | **~$468** | National scale |
| `db.r6g.xlarge` + 1 reader | 32 GB ea | **~$934** | 100K+ active users |

Multi-AZ failover is built in by default  no separate cost.

### RDS Postgres (cheaper than Aurora, less HA)

For comparison:

| Instance | RAM | Single-AZ $/mo | Multi-AZ $/mo |
|---|---|---|---|
| `db.t4g.medium` | 4 GB | ~$30 | ~$60 |
| `db.t4g.large` | 8 GB | ~$60 | ~$120 |
| `db.r6g.large` | 16 GB | ~$120 | ~$240 |

## Supporting AWS services for this path

The managed-DB path needs less surrounding work than self-hosted, but the production stack is similar:

| Tool | Purpose | $/month |
|---|---|---|
| **AWS Secrets Manager** | Stores `DATABASE_URL` + secrets; auto-rotation works automatically with RDS/Aurora | ~$2-5 |
| **AWS KMS** (customer-managed key) | At-rest encryption | $1-3 |
| **AWS CloudTrail** | Audit log | free (management events) |
| **AWS CloudWatch** | Aurora ships metrics for free; you add custom + alarms | ~$5-15 |
| **AWS Performance Insights** | DB-specific query analyzer (the killer feature of managed DB) | free (7-day retention) / $0.012/vCPU-hour for long retention |
| **AWS Enhanced Monitoring** | Sub-second OS-level metrics on the DB instances | $0 (free, just toggle on) |
| **AWS GuardDuty** | Anomaly detection | $10-30 |
| **AWS Route 53** | DNS | $1 |
| **AWS WAF** in front of Vercel (optional) | Rule-based protection | $5 + $0.60/M requests |
| **Supporting total** | | **~$25-65/month** |

## Pros

- ✅ **Multi-AZ failover built in** (Aurora: ~30s; RDS Multi-AZ: ~60-120s)  no operator action required
- ✅ **Automated patching** of minor + security versions during your declared maintenance window
- ✅ **PITR** (point-in-time recovery) to any second within retention window  far better than `pg_dump`
- ✅ **Storage auto-grows** (Aurora)  no manual EBS resizing
- ✅ **Performance Insights** + Enhanced Monitoring give DB-specific observability you'd otherwise build by hand
- ✅ **Aurora Serverless v2 with scale-to-zero** makes the pilot bill close to nothing during idle hours
- ✅ Read replicas in minutes (Aurora) for analytics offload
- ✅ **You're not the DBA**  AWS handles backups, failover, patching, monitoring

## Cons

- ❌ **3-4× more expensive** than self-hosted at equivalent capacity
- ❌ Some Postgres extensions are restricted (e.g. anything that needs filesystem access). Sebenza only uses `pg_trgm` + `pg_stat_statements`  both supported, no problem.
- ❌ **Aurora-specific lock-in** if you use Aurora-only features like Global Database. Sebenza doesn't use any; portability preserved.
- ❌ Less control over `postgresql.conf`  most tuning knobs are via "parameter groups" which lag the raw config
- ❌ Cold-start latency on Aurora Serverless v2 scale-to-zero resume (~15s first query of the morning)

## Setup walkthrough (Aurora-specific)

Step-by-step for Aurora Postgres in `af-south-1`. The pre-cutover work (sections 1-2 of the EC2 guide  AWS account, VPC, security groups) is identical.

### 1. Pre-requisites (same as EC2 guide)

Complete sections 1-2 of [`AWS_EC2_DOCKER_POSTGRES_GUIDE.md`](AWS_EC2_DOCKER_POSTGRES_GUIDE.md):
- AWS account + IAM operator user + MFA + CloudTrail
- VPC + security groups + Elastic IP allocation

### 2. Create the Aurora cluster

1. **RDS console** → select `af-south-1` → Databases → **Create database**.
2. Choose a database creation method: **Standard create**.
3. Engine type: **Aurora (PostgreSQL Compatible)**.
4. Engine version: latest **PostgreSQL 16.x** (matches Sebenza's local dev).
5. Templates: **Production** (enables Multi-AZ by default for provisioned).
6. **Capacity type**:
   - **Pilot / soft launch**: pick **Serverless v2** (the scale-to-zero option)
   - **Launch**: pick **Provisioned** for predictable cost
7. DB cluster identifier: `sebenza-prod`.
8. Master username: `postgres`.
9. Master password: generate a 32-char password (`openssl rand -base64 32`)  save in your password manager.
10. **Instance configuration**:
    - Serverless v2: min ACU `0.5`, max ACU `4` (pilot) or `16` (launch)
    - Tick **Scale to zero** if available (newer regions; rolling out)
    - OR Provisioned: pick `db.t4g.medium` for soft launch
11. **Availability & durability**: Create an Aurora Replica in a different AZ → **No** for pilot, **Yes** for production
12. **Connectivity**:
    - VPC: `sebenza-vpc`
    - DB subnet group: create new with 2 subnets across 2 AZs
    - Public access: **No** (we'll add a bastion or use Vercel egress; never publish DB to the internet directly)
    - VPC security group: create new → `sebenza-db-sg`
    - Database port: 5432
13. **Database authentication**: Password authentication (Sebenza uses this); enable IAM database authentication if you want to use IAM tokens later
14. **Additional configuration**:
    - Initial database name: `sebenza`
    - Backup retention period: **35 days**
    - Encryption: enable → use AWS-managed key (or your own KMS key)
    - **Performance Insights**: enable → free 7-day retention
    - **Enhanced Monitoring**: enable → 10 sec granularity
    - Log exports: tick `postgresql` (CloudWatch Logs)
    - Maintenance window: pick a Sunday early morning slot
15. Create database. Wait ~10-15 minutes for "Available" status.

### 3. Configure the security group

You need Vercel (and your operator laptop, temporarily) to reach the cluster endpoint on port 5432.

1. **EC2 console** → Security Groups → `sebenza-db-sg`.
2. Inbound rules → **Add rule**:
   - Type: **PostgreSQL** (port 5432)
   - Source: **My IP** (your laptop, for migration setup  remove after cutover)
3. Save.

For Vercel: if you have Vercel Secure Compute, add Vercel's static-IP CIDRs as additional rules. Without Secure Compute, the pilot-acceptable approach is to allow 0.0.0.0/0 on 5432 + rely on SSL + strong password + non-default user. Lock down to Secure Compute IPs before public launch.

### 4. Create the Sebenza application user

Get the cluster endpoint from the RDS console (Databases → `sebenza-prod` → Connectivity tab → "Endpoint name"). Looks like `sebenza-prod.cluster-xxxxxxxx.af-south-1.rds.amazonaws.com`.

From your laptop:

```bash
psql "postgresql://postgres:<MASTER_PASSWORD>@<CLUSTER_ENDPOINT>:5432/postgres?sslmode=require"
```

In psql:

```sql
-- Create the app user
CREATE USER sebenza WITH PASSWORD '<SEBENZA_DB_PASSWORD>';

-- Grant on the sebenza database (created during cluster setup)
GRANT ALL PRIVILEGES ON DATABASE sebenza TO sebenza;

-- Connect to it
\c sebenza

-- Make sebenza the owner of the public schema (clean ownership for migrations)
ALTER SCHEMA public OWNER TO sebenza;

-- Install extensions Sebenza needs
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

\q
```

### 5. Update Sebenza driver + run migrations

In your local Sebenza repo:

```bash
npm install pg @types/pg
```

Edit `db/client.ts`:

```typescript
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false }, // Aurora cluster endpoint serves AWS root CA
  });
  _db = drizzle(pool, { schema });
  return _db;
}

export { schema };
```

Apply the same change in `db/seed.ts`.

Set `.env.local`:
```
DATABASE_URL=postgresql://sebenza:<SEBENZA_DB_PASSWORD>@<CLUSTER_ENDPOINT>:5432/sebenza?sslmode=require
```

Run migrations:
```bash
npm run db:migrate
```

All 22 migrations apply (`0000` → `0021`).

### 6. Migrate data from Neon

```bash
NEON_URL='postgresql://...neon...?sslmode=require'
AWS_URL='postgresql://sebenza:<SEBENZA_DB_PASSWORD>@<CLUSTER_ENDPOINT>:5432/sebenza?sslmode=require'

pg_dump "$NEON_URL" \
  --format=custom \
  --no-owner --no-privileges \
  --no-tablespaces \
  --jobs=4 \
  --file=sebenza-cutover.dump

pg_restore \
  --no-owner --no-privileges \
  --data-only \
  --jobs=4 \
  --dbname="$AWS_URL" \
  sebenza-cutover.dump
```

### 7. Store the connection string in Secrets Manager

1. **Secrets Manager console** → **Store a new secret**.
2. Secret type: **Other type of secret**.
3. Key/value pairs:
   - `DATABASE_URL`: the full connection string from above
   - `SEBENZA_ENCRYPTION_KEY`: your AES-256-GCM app key (same as current)
   - `BETTER_AUTH_SECRET`: your Better Auth secret (same as current)
   - `CRON_SECRET`: your cron secret (same as current)
4. Secret name: `sebenza/prod`.
5. Auto-rotation: skip for now (configurable later for the DB password).
6. Store.

### 8. Update Vercel environment

1. **Vercel dashboard** → Project → Settings → Environment Variables → **Production** environment.
2. Update `DATABASE_URL` to the Aurora connection string (with `?sslmode=require`).
3. Save.
4. Trigger a redeploy.

### 9. Configure CloudWatch alarms

Four critical alarms on the cluster:

| Alarm | Metric | Threshold |
|---|---|---|
| `aurora-cpu-high` | `CPUUtilization` | > 80% for 15 min |
| `aurora-storage-low` | `FreeableMemory` | < 100 MB for 5 min |
| `aurora-conn-high` | `DatabaseConnections` | > 80 for 10 min |
| `aurora-failover` | `FailoverState` | != "writer" |

Send to an SNS topic with operator email subscribed.

### 10. Smoke test

Same 9-step verification as in the EC2 guide section 13:
1. Sign in as admin
2. `/api/admin/outcomes-compliance` returns `ok: true` for all 18 assertions
3. `/insights` renders
4. `/search` returns results
5. `/employer/onboarding` works
6. `/dashboard/grow` works
7. Trigger a cron manually
8. Test an email send
9. Audit log lands rows

## When this option is right

- You have a **confirmed paying partner** with launch timeline
- You want to spend operator hours on the product, not on database operations
- You're past the pilot stage and traffic is growing
- A 2-minute outage during a Multi-AZ failover is unacceptable (Aurora: 30s; RDS: 60-120s)
- You have AWS Activate credits to absorb the higher base cost

---

# Side-by-side comparison

## Cost at each scale

| Scale | EC2 self-hosted | RDS Multi-AZ | Aurora Serverless v2 | Aurora Provisioned |
|---|---|---|---|---|
| Pilot (≤1K users) | **$28/mo** | $60/mo | $60-80/mo (scale-to-zero) | $73/mo |
| Soft launch (~10K) | $50/mo | $120/mo | $80-150/mo | $146/mo |
| Launch (~50K) | $164/mo (manual HA) | $240/mo | $200-400/mo | $234/mo |
| National (~100K) | $300/mo (manual HA) | $500/mo | $400-800/mo | $468/mo (writer + reader) |
| At scale (~500K) | not recommended | $1,200/mo | $1,000-2,000/mo | $934/mo |

## Operational burden

| Concern | EC2 self-hosted | Managed (RDS / Aurora) |
|---|---|---|
| **Failover** | You build streaming replication + automation (multi-day project) | Built in. Aurora: ~30s. RDS Multi-AZ: ~60-120s |
| **Patching** | Manual `apt upgrade` + `docker compose pull` weekly | Automatic during your declared maintenance window |
| **Backups** | `pg_dump` cron + EBS snapshots  you wire it | Continuous incremental + PITR + 35-day default retention |
| **Monitoring** | CloudWatch Agent on EC2 + custom dashboards | Performance Insights + Enhanced Monitoring built in |
| **Disk growth** | Manually resize EBS volume + `resize2fs` | Aurora storage auto-grows; RDS has storage auto-scaling tickbox |
| **OS maintenance** | Kernel patches, fail2ban, Docker upgrades  yours | AWS handles |
| **Restore from backup** | Restore a `pg_dump` file (5-30 min depending on size) | PITR to any second in retention window (minutes) |
| **Connection pooling** | Postgres-native at low scale, pgBouncer past ~50K conn/day | Aurora's cluster endpoint handles pooling; RDS Proxy add-on if needed |
| **Tuning** | Direct `postgresql.conf` edit + restart | "Parameter group"  slightly less direct but covers 95% of knobs |

## Feature parity

Everything Sebenza uses is supported on both paths:

| Feature | Sebenza dependency | Self-hosted | RDS / Aurora |
|---|---|---|---|
| Postgres 16.x | Yes (drizzle, FTS, custom functions) | ✅ | ✅ |
| `pg_trgm` | Yes (search ranking) | ✅ | ✅ |
| `pg_stat_statements` | Yes (query analysis) | ✅ | ✅ |
| Custom SQL function `sebenza_freshness_confidence` | Yes (migration 0001) | ✅ | ✅ |
| `tsvector` + `websearch_to_tsquery` (FTS) | Yes (search + decline reasons + stall reasons) | ✅ | ✅ |
| Transactions | Yes (sign-up, mark-as-filled, learning completion) | ✅ | ✅ |
| AES-256-GCM (application-layer) | Yes (national_id_enc) | ✅ (lib/crypto) | ✅ (lib/crypto) |
| Row-level security | Not currently used | ✅ | ✅ |
| Logical replication | Not currently used (would be for outbound CDC if added) | ✅ | RDS: ✅; Aurora: ✅ (different mechanism) |

No Postgres feature Sebenza uses is restricted on either path.

---

# Recommendation

## The honest answer depends on three things

1. **Are you in pilot or production?**
2. **Do you have AWS Activate credits?**
3. **Is there a team member who can spend ~2 hours/week on DB ops?**

## Decision tree

```
Are you live with confirmed paying users?
├─ NO  → Stay on Neon Launch ($19/mo). Don't migrate yet.
│        Apply for AWS Activate while you wait.
│
└─ YES → Do you have AWS Activate credits?
         ├─ YES → Aurora Serverless v2 (scale-to-zero) ✅ ← BEST
         │
         └─ NO  → Is at least one teammate comfortable with Linux/Docker/Postgres?
                  ├─ YES → EC2 self-hosted ($28-50/mo) ✅ ← BEST VALUE
                  │
                  └─ NO  → RDS Multi-AZ ($120/mo)  managed, cheaper than Aurora
```

## Phase-by-phase recommendation for Sebenza

| Phase | Best choice | Why | Monthly cost |
|---|---|---|---|
| **Today → first signed partner** | **Neon Launch** | Cheapest, zero infra work, lets you ship the gov pitch | $19 |
| **Partner signed, ≤1K pilot users** | **Aurora Serverless v2 with scale-to-zero** | In-country PII residency + autoscales to zero during idle hours + managed everything. Activate credits cover it. | $60-90 |
| **Soft launch, ~5-10K users** | **Aurora Serverless v2 0.5-8 ACU range** | Same setup, just lets it scale higher. Zero migration. | $100-180 |
| **National launch, ~50K users** | **Switch to Aurora Provisioned db.t4g.large** | At sustained traffic, provisioned beats serverless economics. Migration is in-place (Aurora console). | $150 |
| **Past 100K active users** | **Aurora Provisioned db.r6g.large + 1 read replica** | Read replica offloads `/insights` + `/gov` queries from writer. | $470 |

## Why NOT the EC2 self-hosted path (despite being cheaper)

Honest take: it's the right answer only if **all three** of these are true:

1. You have a strong reason to avoid managed services (none for Sebenza)
2. You have an experienced ops engineer on the team
3. The cost savings ($30-100/mo at pilot scale) actually matter to your budget

For Sebenza specifically, the cost difference is ~$50-100/month vs Aurora Serverless v2 at pilot scale. AWS Activate credits absorb that entirely. The operator hours you'd spend on DB ops are better spent on the product, the gov pitch, and the Phase 10 polish.

**The EC2 path's strongest argument** is the launch-stage cost differential ($164 vs $470 at national launch). But by then you have revenue + you've outgrown the pilot DBA bandwidth anyway.

## The smartest move you can make right now

1. **Apply for AWS Activate** today  <https://aws.amazon.com/activate/>. Sebenza's POPIA + gov story + Phase 9.13 compliance suite is a strong application. Expect $1K-$5K in credits for the Founders tier, up to $100K if you're accepted by a Portfolio partner.
-Already registed just need to do the application when register the company: https://aws.amazon.com/startups/dashboard

2. **Stay on Neon** until a partner confirms. Don't burn money on infrastructure waiting for users.

3. **When the partner confirms, go straight to Aurora Serverless v2**  skip the EC2 self-hosted intermediate step. The migration runbook is shorter, the cutover is cleaner, and you never have to do a "migrate from self-hosted to managed" second migration.

4. **Pin to PostgreSQL 16** (Sebenza's local dev version) on Aurora so version-parity is exact. Aurora's auto-upgrade can be locked to minor versions only.

## TL;DR

| You are... | Pick |
|---|---|
| Pre-partner, still pitching | **Neon Launch**  don't migrate yet |
| Partner signed, pilot scale, want speed + managed | **Aurora Serverless v2** |
| Partner signed, pilot scale, every dollar matters | **EC2 self-hosted** (your guide) |
| Past 50K active users, want predictable cost | **Aurora Provisioned** |
| Stuck choosing between RDS and Aurora | **Aurora** unless your traffic is rock-steady (then RDS Multi-AZ at ~50% of Aurora's cost) |

**One-sentence answer**: Apply for AWS Activate now, stay on Neon until a partner confirms, then go straight to Aurora Serverless v2 in `af-south-1` and don't look back.

---

*Companion docs: [`AWS_EC2_DOCKER_POSTGRES_GUIDE.md`](AWS_EC2_DOCKER_POSTGRES_GUIDE.md) (full step-by-step for the self-hosted path) + [`AWS_MIGRATION_RUNBOOK.md`](AWS_MIGRATION_RUNBOOK.md) (the original RDS-path runbook).*
