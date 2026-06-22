# Sebenza on AWS Cape Town  EC2 + Docker + PostgreSQL step-by-step

> **Region**: `af-south-1` (Cape Town). **Stack**: EC2 (Ubuntu 24.04 LTS) + Docker + PostgreSQL 16 self-hosted in a container. **Goal**: a working Sebenza on AWS in one focused day.

> **Companion**: [AWS_MIGRATION_RUNBOOK.md](AWS_MIGRATION_RUNBOOK.md) covers the managed-RDS path. This guide is the **self-hosted EC2** path  cheaper for a pilot, more operator work day-to-day. Pick whichever fits your team. Both end with the same Sebenza running against an `af-south-1` Postgres.

> **Audience**: someone who has used a terminal but may not have used AWS before. Every step has a concrete command. No "click around the AWS console and figure it out" hand-waving.

---

## 0. Before you start

### Cost expectation (rough monthly, USD)

| Resource | Spec | Monthly cost (af-south-1) |
|---|---|---|
| EC2 `t4g.small` (ARM) | 2 vCPU, 2 GB RAM | ~$15 |
| EBS gp3 root volume | 30 GB | ~$3 |
| EBS gp3 data volume | 50 GB | ~$5 |
| Daily EBS snapshots | 35-day retention | ~$3 |
| Elastic IP (when attached) | 1 IPv4 | free while attached |
| Data transfer out | ~10 GB/month (pilot scale) | ~$1 |
| **Total pilot** | | **~$27 / month** |

For launch scale, bump to `t4g.medium` (~$30/mo) + 100 GB data volume (~$10/mo). RDS-managed equivalent is roughly 2-3× this; the saving is the trade for "you're the DBA now."

### What you need before opening the console

- An AWS account with billing set up. Free-tier credits cover the first month.
- A laptop with SSH installed (built-in on macOS / Linux; on Windows use the OpenSSH client built into Windows 10+ or use WSL).
- The Sebenza repo cloned locally with `DATABASE_URL` working against Neon (the source DB you're migrating from).
- A copy of your current Neon connection string (you'll `pg_dump` from it in step 9).
- About 4 hours of uninterrupted time for the cutover day. The setup steps (1-7) can be done ahead of time over multiple days.

### Lock in two decisions now

1. **One EC2 instance vs Multi-AZ?** For pilot: one instance is fine; backups are your DR. For launch: read [appendix A](#appendix-a-multi-az-pattern) on the warm-standby pattern.
2. **Pilot data volume:** if the Neon DB is currently under 5 GB, a 50 GB data volume gives you ~12 months of headroom. Resize later is straightforward; underprovisioning storage is the only AWS resource that's painful to fix on a running instance.

---

## 1. AWS account + IAM setup

### 1.1 Pick the right region in the console

Top-right of the AWS console: switch to **Africa (Cape Town)  af-south-1**. Some accounts have to *enable* this region first:

1. Top-right account menu → **Account**.
2. Scroll to "AWS Regions" → find Africa (Cape Town) → click **Enable**.
3. Wait ~5 minutes for the region to propagate.

### 1.2 Create an IAM user for operator access (don't use root)

Root credentials should only be used for billing. Make an IAM user for everything else.

1. **IAM console** → Users → **Create user**.
2. User name: `sebenza-operator`.
3. **Provide user access to the AWS Management Console** → tick. Set a strong password.
4. **Attach policies directly** → for the pilot, attach `AmazonEC2FullAccess` + `AmazonVPCFullAccess` + `CloudWatchFullAccess` + `IAMReadOnlyAccess`. (Tighten later; these are pilot-day permissions.)
5. Create user.
6. After creation: **Security credentials** tab → **Create access key** → choose "Command Line Interface (CLI)" → download the CSV. **Save it somewhere safe  you can't see the secret key again.**

### 1.3 Enable MFA on the operator user

Mandatory. Don't skip.

1. IAM → Users → `sebenza-operator` → Security credentials → **Assigned MFA devices** → Assign MFA.
2. Pick "Authenticator app" (Google Authenticator / 1Password / Authy).
3. Scan the QR + enter two consecutive codes.

### 1.4 Set up CloudTrail (audit log of every AWS action)

POPIA-aligned + cheap insurance.

1. **CloudTrail console** → Create trail → name `sebenza-operator-trail`.
2. Storage location: create a new S3 bucket → `sebenza-cloudtrail-af-south-1`.
3. Log file SSE-KMS encryption: yes, AWS-managed key is fine.
4. Event types: tick **Management events** only (Data events get expensive).
5. Create.

### 1.5 Sign out of root, sign in as `sebenza-operator`

Use the IAM sign-in URL shown on the IAM dashboard (it has your account ID baked in). Bookmark it.

From now on, **never sign in as root** unless you need to change billing.

---

## 2. VPC + security groups

You can use the default VPC if you want speed; for a pilot that's acceptable. The proper setup is a dedicated VPC. We'll do the proper setup since it's not much more work and you only do it once.

### 2.1 Create a VPC

1. **VPC console** → Your VPCs → **Create VPC**.
2. Resources to create: **VPC and more** (this also creates subnets + routing for you).
3. Name: `sebenza-vpc`.
4. IPv4 CIDR: `10.0.0.0/16`.
5. Number of AZs: **2** (gives you HA optionality later).
6. Number of public subnets: **2**.
7. Number of private subnets: **2** (we won't use them in the pilot, but they're free to keep around).
8. NAT gateways: **None** (saves ~$30/mo; not needed for the pilot since our DB is in a public subnet behind a security group).
9. VPC endpoints: **None**.
10. Create.

### 2.2 Create two security groups

#### SG 1  `sebenza-db-sg` (the database)

1. **EC2 console** → Security Groups → **Create security group**.
2. Name: `sebenza-db-sg`.
3. Description: `Sebenza Postgres + SSH access`.
4. VPC: `sebenza-vpc`.
5. **Inbound rules  leave empty for now.** We'll add specific rules after we know our operator's public IP and Vercel's egress IPs.
6. **Outbound rules**: keep the default (all traffic allowed out).
7. Create.

#### Note on Vercel egress IPs

Vercel publishes its egress IP ranges for production deployments here:
- <https://vercel.com/docs/edge-network/regions#egress-ips> (look for the latest list)
- The IPs change occasionally. Setting up a static-IP egress on Vercel ([Vercel Secure Compute](https://vercel.com/docs/security/secure-compute)) is the production-grade solution, but it costs extra.
- **Pilot shortcut**: allow `0.0.0.0/0` on the Postgres port AND require SSL + strong passwords + a non-default username. This is acceptable for a pilot; tighten with Vercel Secure Compute before launch. See [section 11](#11-tls-postgres-over-ssl) for the TLS posture.

### 2.3 Allocate an Elastic IP (static public IP)

The EC2 instance gets a public IP that changes if you stop/start. An Elastic IP is yours forever (as long as it's attached to something).

1. **EC2 console** → Elastic IPs → **Allocate Elastic IP address**.
2. Network border group: `af-south-1`.
3. Allocate.
4. Note the IPv4 address  this is your future `DATABASE_URL` host. Call it `EIP` for the rest of this guide.

---

## 3. EC2 instance: launch

### 3.1 Create a key pair

1. **EC2 console** → Key Pairs → **Create key pair**.
2. Name: `sebenza-ec2-keypair`.
3. Key pair type: **ED25519** (smaller + faster than RSA).
4. Private key format: **.pem** (macOS / Linux / Windows OpenSSH).
5. Create. The `.pem` file downloads automatically. Move it somewhere safe:
   ```bash
   mkdir -p ~/.ssh
   mv ~/Downloads/sebenza-ec2-keypair.pem ~/.ssh/
   chmod 600 ~/.ssh/sebenza-ec2-keypair.pem
   ```

### 3.2 Launch the instance

1. **EC2 console** → Instances → **Launch instance**.
2. Name: `sebenza-db-01`.
3. **Application and OS Images**: **Ubuntu** → **Ubuntu Server 24.04 LTS (HVM)  ARM** (the t4g instance types are ARM-based and cheaper than x86).
4. **Instance type**: `t4g.small` (2 vCPU, 2 GB RAM, ~$15/mo). For launch upgrade to `t4g.medium`.
5. **Key pair**: `sebenza-ec2-keypair`.
6. **Network settings** → **Edit**:
   - VPC: `sebenza-vpc`
   - Subnet: pick one of the **public** subnets created in 2.1
   - Auto-assign public IP: **Enable**
   - **Select existing security group**: `sebenza-db-sg`
7. **Configure storage**:
   - Root volume: 30 GiB, gp3, encrypted (use the default AWS-managed KMS key)
   - **Add new volume**: 50 GiB, gp3, encrypted (this is the data volume; we'll mount it at `/var/lib/postgresql/data` in step 6)
8. **Advanced details** → leave at defaults.
9. Launch.

Wait ~2 minutes for the instance state to be "Running" with all status checks passed.

### 3.3 Attach the Elastic IP

1. **EC2 console** → Elastic IPs → select your EIP → Actions → **Associate Elastic IP address**.
2. Instance: `sebenza-db-01`.
3. Associate.

Now your instance has a permanent public IP.

### 3.4 Open SSH access only from your laptop

1. Find your laptop's public IP: visit <https://ifconfig.me> in your browser. Call it `MY_IP`.
2. **EC2 console** → Security Groups → `sebenza-db-sg` → Inbound rules → **Edit inbound rules** → **Add rule**:
   - Type: **SSH**
   - Source: **My IP** (the console auto-fills your current IP as `MY_IP/32`)
   - Description: `Operator SSH (rotate when laptop IP changes)`
3. Save.

---

## 4. First SSH + OS hardening

### 4.1 SSH in

```bash
ssh -i ~/.ssh/sebenza-ec2-keypair.pem ubuntu@<EIP>
```

(Replace `<EIP>` with your Elastic IP. The default user on Ubuntu AMIs is `ubuntu`.)

First connection asks you to accept the host fingerprint  type `yes`.

### 4.2 Update the OS

```bash
sudo apt update && sudo apt upgrade -y
sudo reboot
```

Wait ~30 seconds, SSH back in.

### 4.3 Set the hostname + timezone

```bash
sudo hostnamectl set-hostname sebenza-db-01
sudo timedatectl set-timezone Africa/Johannesburg
```

### 4.4 Enable the firewall (defence in depth alongside the SG)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 5432/tcp  # Postgres (will be SG-restricted too)
sudo ufw --force enable
sudo ufw status
```

### 4.5 Add a small swap file (Postgres + 2GB RAM is tight)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
sudo swapon --show  # confirm
```

### 4.6 Optional: install fail2ban (auto-bans brute-force SSH attempts)

```bash
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
```

---

## 5. Docker installation

The official Docker repo, not the older Ubuntu repo version.

```bash
# Remove any old versions
for pkg in docker.io docker-doc docker-compose podman-docker containerd runc; do
  sudo apt-get remove -y $pkg 2>/dev/null
done

# Add Docker's official GPG key + repo
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add ubuntu user to docker group so you don't need sudo for every command
sudo usermod -aG docker ubuntu

# Log out + back in for the group change to take effect
exit
```

SSH back in, then verify:

```bash
docker --version            # expect 26.x+
docker compose version      # expect v2.x+
docker run --rm hello-world # should print a success message
```

---

## 6. EBS data volume  mount it at the Postgres data path

The 50 GB volume you attached in 3.2 step 7 is sitting unmounted. Postgres data lives in a directory; if we put that directory on the data volume, we can snapshot/resize/replace it independently of the OS.

### 6.1 Find the volume's device name

```bash
lsblk
```

Output should look like:
```
NAME     SIZE  MOUNTPOINT
nvme0n1   30G  
├─nvme0n1p1
nvme1n1   50G            ← this is the data volume (no mountpoint)
```

If your data volume shows as `nvme1n1`, the device path is `/dev/nvme1n1`. Adjust the commands below if yours is named differently.

### 6.2 Format + mount

```bash
# Format as ext4 (single command, one-time only)
sudo mkfs.ext4 /dev/nvme1n1

# Create the mount point + mount
sudo mkdir -p /var/lib/postgresql
sudo mount /dev/nvme1n1 /var/lib/postgresql

# Make it permanent across reboots
sudo cp /etc/fstab /etc/fstab.bak
UUID=$(sudo blkid -s UUID -o value /dev/nvme1n1)
echo "UUID=$UUID  /var/lib/postgresql  ext4  defaults,nofail  0  2" | sudo tee -a /etc/fstab

# Verify
df -h | grep postgresql
# /dev/nvme1n1   50G  ... /var/lib/postgresql
```

### 6.3 Set ownership

Postgres runs as UID 999 inside the container. The directory needs to be writable by that UID on the host:

```bash
sudo chown -R 999:999 /var/lib/postgresql
sudo chmod 700 /var/lib/postgresql
```

---

## 7. PostgreSQL via Docker Compose

### 7.1 Generate strong passwords

You need TWO passwords:
- The Postgres `postgres` superuser password (for admin tasks only)
- The Sebenza application user password (used in `DATABASE_URL`)

```bash
# Generate two 32-char passwords
openssl rand -base64 32  # ← copy this; this is POSTGRES_PASSWORD
openssl rand -base64 32  # ← copy this; this is SEBENZA_DB_PASSWORD
```

Save both somewhere safe (a password manager). You'll paste them in the next step.

### 7.2 Create the compose file

```bash
mkdir -p ~/sebenza-db
cd ~/sebenza-db
nano docker-compose.yml
```

Paste this, then replace `<POSTGRES_PASSWORD>` + `<SEBENZA_DB_PASSWORD>` with the values you just generated:

```yaml
services:
  postgres:
    image: postgres:16.4
    container_name: sebenza-postgres
    restart: unless-stopped
    environment:
      POSTGRES_PASSWORD: '<POSTGRES_PASSWORD>'
      POSTGRES_DB: postgres
      # Tune for ~2GB RAM. For t4g.medium, bump these proportionally.
      PGDATA: /var/lib/postgresql/data/pgdata
    ports:
      - "5432:5432"
    volumes:
      - /var/lib/postgresql:/var/lib/postgresql/data
      - ./postgresql.conf:/etc/postgresql/postgresql.conf:ro
      - ./pg_hba.conf:/etc/postgresql/pg_hba.conf:ro
    command:
      - postgres
      - "-c"
      - "config_file=/etc/postgresql/postgresql.conf"
      - "-c"
      - "hba_file=/etc/postgresql/pg_hba.conf"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

Save (Ctrl+O, Enter, Ctrl+X).

### 7.3 Create the Postgres config

```bash
nano postgresql.conf
```

Paste:

```conf
# Sebenza Postgres tuning  optimised for t4g.small (2 vCPU, 2 GB RAM).
# For t4g.medium (4 GB RAM): double shared_buffers + effective_cache_size.

listen_addresses = '*'
port = 5432
max_connections = 100

# Memory  conservative for 2 GB
shared_buffers = 512MB
effective_cache_size = 1500MB
maintenance_work_mem = 128MB
work_mem = 8MB

# WAL + durability
wal_level = replica
max_wal_size = 1GB
min_wal_size = 80MB
checkpoint_completion_target = 0.9
synchronous_commit = on

# Connection logging  helpful while pilot-debugging
logging_collector = on
log_destination = 'stderr'
log_min_duration_statement = 500ms
log_connections = on
log_disconnections = on
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '

# Stats
track_io_timing = on
track_functions = pl

# Extensions Sebenza needs (loaded on CREATE EXTENSION in migration 0001)
shared_preload_libraries = 'pg_stat_statements'

# Locale / encoding
default_text_search_config = 'pg_catalog.simple'
```

Save.

### 7.4 Create the host-based authentication file

```bash
nano pg_hba.conf
```

Paste:

```conf
# TYPE  DATABASE     USER         ADDRESS              METHOD
local   all          all                               trust
host    all          postgres     127.0.0.1/32         scram-sha-256
host    all          postgres     ::1/128              scram-sha-256

# Sebenza application user from any host (the SG is the actual gate)
# scram-sha-256 + TLS make this safe even from 0.0.0.0/0
hostssl all          sebenza      0.0.0.0/0            scram-sha-256
hostssl all          sebenza      ::/0                 scram-sha-256

# Local non-SSL fallback for psql from inside the container
host    all          sebenza      127.0.0.1/32         scram-sha-256
```

Save.

> **Note**: `hostssl` requires Postgres to have an SSL cert. We'll generate one in [section 11](#11-tls-postgres-over-ssl). For now, change `hostssl` to `host` to get up + running, then switch back to `hostssl` after section 11.

### 7.5 First boot (without SSL  we'll add it in step 11)

Temporarily swap `hostssl` for `host` in `pg_hba.conf`, then:

```bash
docker compose up -d
docker compose logs -f
```

You should see:
```
postgres-1  | LOG:  database system was shut down at ...
postgres-1  | LOG:  database system is ready to accept connections
```

Ctrl+C to exit the log tail. The container keeps running.

### 7.6 Open Postgres port to your laptop temporarily (for the migration step)

In the EC2 security group `sebenza-db-sg`:
- Inbound rules → **Add rule**:
  - Type: **PostgreSQL** (auto-fills port 5432)
  - Source: **My IP**
  - Description: `Operator psql access (remove after migration)`

This lets you run migrations from your laptop. We'll lock this down again at the end.

### 7.7 Create the Sebenza application user + database

From your **laptop** (not the EC2 instance):

```bash
# Install psql locally if you don't have it:
#   macOS:  brew install libpq && brew link --force libpq
#   Ubuntu: sudo apt install postgresql-client
#   Windows: install Postgres from postgresql.org and add psql to PATH

psql "postgresql://postgres:<POSTGRES_PASSWORD>@<EIP>:5432/postgres"
```

In the psql prompt, run:

```sql
-- Create the app user with a strong password
CREATE USER sebenza WITH PASSWORD '<SEBENZA_DB_PASSWORD>';

-- Create the Sebenza database, owned by the app user
CREATE DATABASE sebenza OWNER sebenza ENCODING 'UTF8';

-- Grant connect
GRANT ALL PRIVILEGES ON DATABASE sebenza TO sebenza;

-- Connect to the new DB so we can install extensions
\c sebenza

-- Sebenza needs these (migration 0001 also tries to create them, but
-- doing it as superuser here means the migration doesn't need superuser
-- privileges later).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Verify the user can connect
\du sebenza
\l sebenza

-- Quit
\q
```

### 7.8 Smoke test from your laptop

```bash
psql "postgresql://sebenza:<SEBENZA_DB_PASSWORD>@<EIP>:5432/sebenza?sslmode=disable" -c "SELECT version();"
```

You should see:
```
PostgreSQL 16.4 (Debian 16.4-1.pgdg120+1) on aarch64-unknown-linux-gnu, ...
```

✅ If you see the version string, Postgres is up + reachable from your laptop. Move on.

---

## 8. Run Sebenza migrations against the new DB

### 8.1 Update the driver in `db/client.ts`

We're switching from the Neon WebSocket Pool driver to the standard `node-postgres` (`pg`) driver. Same Drizzle, different transport. Both support transactions.

In your local Sebenza repo:

```bash
cd /path/to/sebenza_v1
npm install pg @types/pg
```

Edit `db/client.ts`:

```typescript
/**
 * Standard node-postgres driver. Used after the 2026-XX-XX AWS Cape
 * Town migration  identical SQL surface as the previous Neon driver,
 * supports transactions natively, no neonConfig/ws shimming needed.
 */
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

export function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }
  _pool = new Pool({
    connectionString: url,
    // AWS RDS-style SSL: server cert verification + accept self-signed
    // (we'll switch to verify-full once we have a proper cert in step 11)
    ssl: url.includes("sslmode=disable")
      ? false
      : { rejectUnauthorized: false },
  });
  _db = drizzle(_pool, { schema });
  return _db;
}

export { schema };
```

Apply the same change in `db/seed.ts`:

```typescript
// At the top, swap:
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
// ...delete the neonConfig/ws lines

// At the db = drizzle line:
const db = drizzle(new Pool({
  connectionString: url,
  ssl: url.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
}), { schema });
```

> Don't `npm uninstall @neondatabase/serverless ws` yet  keep them until cutover is fully verified, so rollback is one env-var change.

### 8.2 Point local env at AWS + migrate

```bash
# In sebenza_v1/.env.local, set:
DATABASE_URL=postgresql://sebenza:<SEBENZA_DB_PASSWORD>@<EIP>:5432/sebenza?sslmode=disable
```

Then run migrations:

```bash
npm run db:migrate
```

You should see all 22 migrations (`0000` → `0021`) apply. Expected output:

```
✔ 0000_initial_schema.sql applied
✔ 0001_phase4_search.sql applied
✔ 0002_...
...
✔ 0021_phase9_13_programme_skills.sql applied
```

### 8.3 Migrate data from Neon (pg_dump → pg_restore)

```bash
# Set both connection strings in your shell
NEON_URL='postgresql://...neon...?sslmode=require'
AWS_URL='postgresql://sebenza:<SEBENZA_DB_PASSWORD>@<EIP>:5432/sebenza?sslmode=disable'

# Dump from Neon (custom format = parallel restore + compression)
pg_dump "$NEON_URL" \
  --format=custom \
  --no-owner --no-privileges \
  --no-tablespaces \
  --jobs=4 \
  --file=sebenza-cutover.dump

# Restore into AWS  --clean wipes the schema first since 8.2 already
# created it. Use --data-only if you want to keep the schema we just
# migrated and just import rows.
pg_restore \
  --no-owner --no-privileges \
  --data-only \
  --jobs=4 \
  --dbname="$AWS_URL" \
  sebenza-cutover.dump
```

> **If you're starting fresh** (no Neon DB to migrate, e.g. brand-new install): skip 8.3 and just run `npm run db:seed` against `DATABASE_URL=$AWS_URL` to land the demo fixtures.

### 8.4 Verify the data landed

```bash
psql "$AWS_URL" -c "SELECT 
  (SELECT COUNT(*) FROM profiles) AS profiles,
  (SELECT COUNT(*) FROM app_user) AS users,
  (SELECT COUNT(*) FROM audit_log) AS audit_rows,
  (SELECT COUNT(*) FROM vacancies) AS vacancies,
  (SELECT COUNT(*) FROM learning_items) AS learning_items;"
```

Numbers should match the Neon source (or match the seed counts if you started fresh).

---

## 9. Connect Vercel to the new DB

### 9.1 Add the new env var (Production environment only at first)

1. **Vercel dashboard** → your Sebenza project → **Settings** → **Environment Variables**.
2. Add `DATABASE_URL` for **Production** only:
   ```
   postgresql://sebenza:<SEBENZA_DB_PASSWORD>@<EIP>:5432/sebenza?sslmode=require
   ```
   (note: `sslmode=require`, not `disable`  Vercel egress is open internet, never bare TCP)
3. Save.

> Don't delete the old Neon URL yet  keep it as a backup.

### 9.2 Add Vercel egress IPs to the security group

Vercel publishes its egress IPs at <https://vercel.com/docs/edge-network/regions#egress-ips>. Grab the list for your project's primary region.

In `sebenza-db-sg`:
- Inbound rules → **Edit inbound rules** → **Add rule** (one per Vercel IP CIDR):
  - Type: **PostgreSQL** (port 5432)
  - Source: **Custom** → paste the Vercel CIDR (e.g. `76.76.21.0/24`)
  - Description: `Vercel egress  <region>`

Or, for the pilot, use a single `0.0.0.0/0` rule  Postgres-on-public-internet is safe ONLY if you have:
- SSL required (you do  `sslmode=require`)
- Strong password (you do  32-char random)
- Non-default user (you do  `sebenza`, not `postgres`)
- A modern Postgres + `scram-sha-256` auth (you do)

For production, upgrade to Vercel Secure Compute (static-IP egress) and lock the SG to those IPs only.

### 9.3 Deploy + verify

1. In Vercel, trigger a redeploy (Deployments → latest → Redeploy with cleared cache).
2. Open the production URL.
3. Sign in.
4. Hit `/api/admin/outcomes-compliance` (as admin)  confirm all 18 assertions return `ok: true`.
5. Hit `/insights`  confirm numbers render.
6. Try the cell-click path → `/search` → confirm results appear.

### 9.4 If everything works, remove the legacy Neon URL

1. Vercel → Settings → Environment Variables → delete the old Neon entry.
2. Locally:
   ```bash
   npm uninstall @neondatabase/serverless ws @types/ws
   ```
3. Commit the `db/client.ts` + `db/seed.ts` + `package.json` changes.

---

## 10. Daily backups

Two layers: **logical** (pg_dump) + **infrastructure** (EBS snapshots). You want both.

### 10.1 pg_dump cron on the EC2 instance

SSH in:

```bash
sudo mkdir -p /var/backups/postgres
sudo chown ubuntu:ubuntu /var/backups/postgres
```

Create the backup script:

```bash
nano ~/sebenza-db/backup.sh
```

Paste:

```bash
#!/usr/bin/env bash
set -euo pipefail
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR=/var/backups/postgres
BACKUP_FILE="$BACKUP_DIR/sebenza-$TIMESTAMP.dump"

# Dump from inside the container so we don't need pg_dump on the host
docker exec sebenza-postgres pg_dump \
  -U sebenza \
  --format=custom \
  --no-owner --no-privileges \
  sebenza > "$BACKUP_FILE"

# Keep last 14 days locally
find "$BACKUP_DIR" -name 'sebenza-*.dump' -mtime +14 -delete

# Log it
echo "[$(date -Iseconds)] backup ok: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))" \
  >> /var/log/sebenza-backup.log
```

Make it executable + test:

```bash
chmod +x ~/sebenza-db/backup.sh
~/sebenza-db/backup.sh
ls -lh /var/backups/postgres/
cat /var/log/sebenza-backup.log
```

Schedule it (daily at 02:00 SAST):

```bash
crontab -e
# Append:
0 2 * * * /home/ubuntu/sebenza-db/backup.sh
```

### 10.2 Upload backups to S3 (cross-host durability)

Create a bucket:
1. **S3 console** → Create bucket → name `sebenza-db-backups-af-south-1`.
2. Region: `af-south-1`.
3. Block all public access: **on**.
4. SSE: **SSE-S3** (or SSE-KMS if you've set up a customer key).
5. Create.

Create an IAM role for the EC2 instance to write to that bucket:
1. **IAM console** → Roles → **Create role**.
2. AWS service → EC2 → Next.
3. Skip attaching policies for now → name `sebenza-ec2-backup-role` → Create.
4. Click the new role → **Add inline policy** → JSON tab → paste:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": ["s3:PutObject", "s3:GetObject", "s3:ListBucket"],
       "Resource": [
         "arn:aws:s3:::sebenza-db-backups-af-south-1",
         "arn:aws:s3:::sebenza-db-backups-af-south-1/*"
       ]
     }]
   }
   ```
5. Review → name `sebenza-s3-backup` → Create.

Attach the role to the EC2 instance:
1. EC2 console → Instances → `sebenza-db-01` → Actions → Security → **Modify IAM role**.
2. Pick `sebenza-ec2-backup-role` → Update.

Install + configure the AWS CLI on EC2:

```bash
sudo apt install -y awscli
aws s3 ls s3://sebenza-db-backups-af-south-1/  # should return empty (no error)
```

Extend the backup script to upload:

```bash
nano ~/sebenza-db/backup.sh
```

Add at the bottom (before the log line):

```bash
# Upload to S3
aws s3 cp "$BACKUP_FILE" "s3://sebenza-db-backups-af-south-1/$(basename "$BACKUP_FILE")"
```

### 10.3 EBS snapshots (infrastructure-level)

These capture the entire data volume at a point in time. Faster restore than pg_dump for full-DB recovery.

1. **EC2 console** → Lifecycle Manager → **Create snapshot lifecycle policy**.
2. Policy type: **EBS snapshot policy**.
3. Description: `Sebenza DB volume daily snapshots`.
4. Target resource type: **Volume**.
5. Target tag: pick a tag you've set on the data volume (you can tag it now if you haven't  go to EC2 → Volumes → select the 50GB data volume → Tags → add `Backup=true`).
6. Schedule:
   - Frequency: Daily
   - Time: 03:00 UTC (= 05:00 SAST, after pg_dump runs)
   - Retention: 35 snapshots
7. Create policy.

---

## 11. TLS  Postgres over SSL

Currently we're running with `sslmode=disable`. Production must use SSL.

### 11.1 Generate a self-signed cert (good enough for the pilot)

On the EC2 instance:

```bash
cd ~/sebenza-db
sudo mkdir -p certs
sudo openssl req -new -x509 -days 365 -nodes \
  -out certs/server.crt \
  -keyout certs/server.key \
  -subj "/CN=<EIP>"
sudo chown 999:999 certs/server.key certs/server.crt
sudo chmod 600 certs/server.key
sudo chmod 644 certs/server.crt
```

For production: use Let's Encrypt with a DNS name pointed at the EIP (e.g. `db.sebenzasa.com`), not a self-signed cert.

### 11.2 Update docker-compose.yml to mount the certs

Add to the `volumes:` block:

```yaml
      - ./certs/server.crt:/etc/postgresql/server.crt:ro
      - ./certs/server.key:/etc/postgresql/server.key:ro
```

### 11.3 Update postgresql.conf to enable SSL

Add to the bottom:

```conf
ssl = on
ssl_cert_file = '/etc/postgresql/server.crt'
ssl_key_file = '/etc/postgresql/server.key'
```

### 11.4 Switch pg_hba.conf back to hostssl

Edit `pg_hba.conf` and change every `host  ... sebenza` line back to `hostssl  ... sebenza`.

### 11.5 Restart Postgres

```bash
docker compose down
docker compose up -d
docker compose logs --tail 20
```

Look for `LOG:  database system is ready to accept connections` + no SSL errors.

### 11.6 Test SSL from your laptop

```bash
psql "postgresql://sebenza:<SEBENZA_DB_PASSWORD>@<EIP>:5432/sebenza?sslmode=require" \
  -c "SELECT 'SSL OK' WHERE current_setting('ssl') = 'on';"
```

You should see `SSL OK`.

### 11.7 Update Vercel env to require SSL

If you set `sslmode=disable` earlier, change it to `sslmode=require`:

Vercel → Settings → Env Vars → `DATABASE_URL` → edit → ensure it ends with `?sslmode=require`.

Redeploy.

---

## 12. Monitoring + alarms

### 12.1 Install the CloudWatch agent on EC2

```bash
wget https://amazoncloudwatch-agent-af-south-1.s3.af-south-1.amazonaws.com/ubuntu/arm64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i amazon-cloudwatch-agent.deb
```

Attach the CloudWatch IAM policy to the EC2 role:

1. IAM → Roles → `sebenza-ec2-backup-role` → Add permissions → Attach policies → `CloudWatchAgentServerPolicy`.

Create the agent config:

```bash
sudo nano /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
```

Paste:

```json
{
  "metrics": {
    "metrics_collected": {
      "mem": {
        "measurement": ["mem_used_percent"]
      },
      "disk": {
        "measurement": ["used_percent"],
        "resources": ["/var/lib/postgresql"]
      },
      "swap": {
        "measurement": ["swap_used_percent"]
      }
    }
  }
}
```

Start the agent:

```bash
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json -s
```

### 12.2 Create the four critical alarms

CloudWatch console → Alarms → Create alarm. Repeat four times:

| Alarm name | Metric | Threshold | Period |
|---|---|---|---|
| `sebenza-db-cpu-high` | `CPUUtilization` (EC2) | > 80% | 15 min |
| `sebenza-db-disk-high` | `disk_used_percent` (CWAgent) | > 80% | 15 min |
| `sebenza-db-mem-high` | `mem_used_percent` (CWAgent) | > 90% | 15 min |
| `sebenza-db-status-fail` | `StatusCheckFailed` (EC2) | >= 1 | 5 min |

Each alarm sends to an SNS topic  create one called `sebenza-ops` first and subscribe your operator email to it.

---

## 13. Final verification (the smoke check)

From the Vercel production URL, walk through this list. Each must pass.

1. **Sign in** as admin (`admin@sebenzasa.com`, password from seed).
2. **`/admin/outcomes-compliance`**  open the JSON endpoint directly, confirm `"ok": true` for all 18 assertions.
3. **`/insights`**  verify LMI value, freshness band, supply heatmap (no duplicate columns now if you re-seeded).
4. **`/search`**  try a query, confirm results appear. Try clicking a heatmap cell from `/insights`  should land here with rows.
5. **`/employer/onboarding`** as a fresh employer  submit a test KYC application; confirm it lands in `/admin/verifications`.
6. **`/dashboard/grow`** as a seeker  confirm the Career Compass + My Learning section render.
7. **Trigger a cron** manually:
   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/status-stale-warning
   ```
   Confirm `{ok:true}` response.
8. **Email send**  flip `feature_flag_email_notifications` ON in `/admin/settings`, trigger any action that creates a notification, confirm Resend dashboard shows the send.
9. **Audit log**  open `/admin/audit-log`, confirm rows are landing from your test actions.

If all 9 pass, the migration is functionally complete.

---

## 14. Post-cutover housekeeping

- [ ] Remove the operator's SSH IP from the SG (keep only Vercel egress + your bastion if you have one).
- [ ] Remove the `My IP` Postgres rule on port 5432 (operator should always tunnel through SSH for psql access).
- [ ] Tag the commit: `git tag aws-cape-town-cutover-YYYY-MM-DD && git push --tags`.
- [ ] Update `docs/popia/RETENTION_POLICY.md`  Neon row removed, AWS RDS row added.
- [ ] Update `/privacy` Section 7  change "before commercial launch we migrate" to "we host on AWS Cape Town (`af-south-1`)".
- [ ] Update `/paia` Section 6 sub-processors  swap Neon for AWS.
- [ ] Keep Neon snapshot/access for 30 days as rollback insurance.

---

## 15. Rollback procedure

If anything goes wrong inside the first 30 days:

1. **In Vercel**: change `DATABASE_URL` back to the Neon connection string.
2. **In code**: revert `db/client.ts` to import from `@neondatabase/serverless` + `drizzle-orm/neon-serverless`. (Tag `aws-cape-town-cutover-YYYY-MM-DD` makes this a one-line `git revert`.)
3. **Reinstall**: `npm install @neondatabase/serverless ws @types/ws`.
4. **Redeploy** in Vercel.
5. **Re-run idempotent crons** that fired during the AWS window: `skill-gap-snapshot`, `outcome-snapshots`, `lmi-snapshot` are all append-only  safe to re-run.
6. **For audit/notification rows that landed on AWS during the window**: `pg_dump --data-only --table=audit_log --table=notifications` from AWS, `pg_restore` into Neon.

The 30-day Neon retention is the rollback budget.

---

## 16. Day-to-day operator runbook

### Daily (first month  automate later)

- Check the SNS topic for any overnight alarms.
- Glance at `cat /var/log/sebenza-backup.log` (SSH in)  most recent line should be from last night.
- Verify the latest snapshot in `aws s3 ls s3://sebenza-db-backups-af-south-1/ --recursive | tail -1`.

### Weekly

- `docker compose pull && docker compose up -d` to pull the latest Postgres 16.x patch release.
- Review CloudTrail for unexpected console activity.
- Review the audit-log row count growth  anomalous spikes mean either a feature got busier OR something's wrong.

### Monthly

- Restore the latest backup to a throwaway EC2 instance + verify it boots + run `npm run db:migrate` against it (proves the backup is restorable, not just present).
- Rotate the `SEBENZA_DB_PASSWORD`:
  ```sql
  ALTER USER sebenza WITH PASSWORD '<NEW_PASSWORD>';
  ```
  Update Vercel env. Redeploy.

### Restart the DB (rare)

```bash
ssh ubuntu@<EIP>
cd ~/sebenza-db
docker compose restart postgres
docker compose logs --tail 50
```

The app handles connection drops via the Pool's auto-reconnect.

### Restore from a backup

```bash
# Find the backup
ls -lh /var/backups/postgres/

# OR pull from S3:
aws s3 cp s3://sebenza-db-backups-af-south-1/sebenza-YYYYMMDD-HHMMSS.dump ./

# Restore (THIS WIPES THE EXISTING DB  be sure)
docker exec -i sebenza-postgres pg_restore \
  -U sebenza --clean --if-exists \
  -d sebenza < sebenza-YYYYMMDD-HHMMSS.dump
```

### Resize the data volume (online, no downtime)

When `disk_used_percent` hits 70%:

1. **EC2 console** → Volumes → select the 50 GB data volume → Modify → new size 100 GB → Modify.
2. Wait ~5 min for the volume state to be "in-use" again.
3. SSH in: `sudo growpart /dev/nvme1n1 1` (or skip if no partition) → `sudo resize2fs /dev/nvme1n1`.
4. `df -h` confirms the new size.

Postgres doesn't need a restart.

---

## Appendix A  Multi-AZ pattern (when you outgrow the pilot)

For HA, the right pattern is **streaming replication** between a primary + standby in two AZs. Outline:

1. Launch a second EC2 instance in the other public subnet of `sebenza-vpc`.
2. On the standby, restore from a base backup of the primary.
3. Configure `primary_conninfo` in the standby's `postgresql.conf` to stream from the primary.
4. Front them with an NLB on a private IP that fails over via a Lambda triggered by a CloudWatch alarm on `StatusCheckFailed_System` of the primary.

This is genuinely more work than RDS Multi-AZ ($30/mo) does for you in one tickbox. **Strong recommendation**: when you cross the pilot threshold, migrate from this self-hosted setup to RDS Postgres in `af-south-1`. The runbook at [`docs/AWS_MIGRATION_RUNBOOK.md`](AWS_MIGRATION_RUNBOOK.md) is the second migration.

---

## Appendix B  DNS (use a friendly hostname)

Once the pilot is stable, replace `<EIP>` with a hostname. Two options:

1. **Route 53 hosted zone** for `sebenzasa.com`:
   - Create A record `db.sebenzasa.com` → your EIP.
   - Update Vercel env to use `db.sebenzasa.com` instead of the raw IP.
   - Re-issue the SSL cert with Let's Encrypt for the proper CN:
     ```bash
     sudo apt install certbot
     sudo certbot certonly --standalone -d db.sebenzasa.com
     # Update docker-compose volume mounts to point at /etc/letsencrypt/live/db.sebenzasa.com/
     ```

2. **External DNS** (Cloudflare etc.)  same idea, A record pointing at the EIP.

---

## Appendix C  POPIA compliance notes

Nothing in the Sebenza POPIA posture changes with this migration. Restated:

- **Data residency**: PII never leaves `af-south-1`. The Sebenza application encrypts national ID numbers with AES-256-GCM application-side before they hit the database; backups inherit that encryption. EBS volumes + S3 backups are encrypted at rest with an AWS KMS key in `af-south-1`.
- **Sub-processor change**: Neon is removed from `docs/popia/RETENTION_POLICY.md`, AWS Cape Town added. Re-version `/privacy` Section 7  the cookie-banner machinery already handles consent re-prompts on Privacy Policy updates.
- **Audit log**: every PII access still wraps in `logAccess()`. The DB hosting the audit log changed; the contract did not.
- **DPA**: confirm AWS DPA + sub-processor agreement for `af-south-1` is on file before cutover day. Standard AWS terms cover this; the only step is *confirming* you have it.

---

*Step-by-step EC2 + Docker + PostgreSQL self-hosted guide. Companion to the managed-RDS runbook at `AWS_MIGRATION_RUNBOOK.md`. Both end with Sebenza fully working against `af-south-1`.*
