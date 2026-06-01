# Encryption inventory + key rotation runbook

> Every place we encrypt + the procedure for rotating the keys without
> losing access. Read alongside `lib/crypto/index.ts`.

Last updated 2026-06-01 (Phase 13 added the LLM-provider credentials row).

---

## In-transit (TLS)

| Hop | Algorithm | Notes |
|---|---|---|
| Browser ↔ Vercel | TLS 1.3 | Vercel manages cert via Let's Encrypt + auto-renewal. |
| Vercel ↔ Neon | TLS 1.2+ | `sslmode=require` in the connection string. |
| Vercel ↔ Supabase Storage | TLS 1.2+ | HTTPS only; signed-URL flow does not weaken this. |
| Vercel ↔ Resend | TLS 1.2+ | HTTPS API. |
| Vercel ↔ Upstash (Phase 9) | TLS 1.2+ | HTTPS API. |
| Vercel ↔ KYC SaaS (Phase 8+, gated) | TLS 1.2+ | Required by every SA-registered provider. |

## At-rest

| Data | Mechanism | Key location |
|---|---|---|
| Neon Postgres | Provider-side AES-256 (transparent) | Neon-managed. |
| Supabase Storage objects | Provider-side AES-256 (transparent) | Supabase-managed. |
| Vercel build artefacts | Provider-side | Vercel-managed. |

## Application-level (highest sensitivity)

| Column | Algorithm | Key env | Module |
|---|---|---|---|
| `profiles.national_id_enc` | AES-256-GCM with versioned payload | `SEBENZA_ENCRYPTION_KEY` | `lib/crypto/index.ts` |
| `app_user.phone_e164_enc` (Phase 11.4.4) | AES-256-GCM with versioned payload | `SEBENZA_ENCRYPTION_KEY` | `lib/crypto/index.ts` |
| `llm_providers.credentials_enc` (Phase 13.3) | AES-256-GCM with versioned payload over a JSON blob `{ apiKey, modelId, endpointUrl?, extraHeaders? }`. Decrypted in-memory only inside the dispatcher; never returned plaintext to the admin UI (which shows the SHA-256 fingerprint's first 8 hex chars only). | `SEBENZA_ENCRYPTION_KEY` | `lib/crypto/index.ts` + `lib/admin/llm-actions.ts` |
| Passwords | Better Auth's scrypt | `BETTER_AUTH_SECRET` | Better Auth |
| TOTP secrets | Better Auth's twoFactor plugin (encrypted) | `BETTER_AUTH_SECRET` | Better Auth |
| Backup codes | Hashed | n/a | Better Auth |

### `lib/crypto` payload format

Ciphertext is stored as a single string with a version prefix so we can
rotate keys without breaking existing rows:

```
v1.<base64-iv>.<base64-ciphertext>.<base64-authTag>
```

`decryptField` reads the version prefix and picks the right key from
the keyring (currently single-key; multi-key for rotation below).

---

## Key rotation runbook

### Routine rotation (every 12 months, OR after a credential disclosure)

1. **Generate the new key.**
   ```
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
   Store as `ID_ENCRYPTION_KEY_V2` in the production env. Do NOT
   remove `ID_ENCRYPTION_KEY` yet.

2. **Teach `decryptField` about v2.** Extend the keyring map in
   `lib/crypto/index.ts`:
   ```ts
   const KEYS: Record<string, Buffer> = {
     v1: Buffer.from(process.env.ID_ENCRYPTION_KEY!, "base64"),
     v2: Buffer.from(process.env.ID_ENCRYPTION_KEY_V2!, "base64"),
   };
   ```
   `encryptField` writes v2; `decryptField` reads either by prefix.
   Deploy.

3. **Verify both keys decrypt.** Run a smoke test from
   `/api/admin/outcomes-compliance` style  pick three real IDs and
   confirm `decryptField` produces the right plaintext.

4. **Re-encrypt at rest.** Run a one-shot script:
   ```ts
   // scripts/rotate-id-keys.ts
   for each row where national_id_enc LIKE 'v1.%':
     plain = decryptField(row.national_id_enc);  // uses v1 key
     row.national_id_enc = encryptField(plain);  // writes v2 prefix
     update.
   ```
   Run in a transaction per batch of 100 to keep memory bounded.

5. **Retire v1.** Once every row is `v2.%`, remove `v1` from the
   keyring and unset `ID_ENCRYPTION_KEY` from prod env. Deploy.

6. **Audit-log it.** Write a `setting.update` row with
   `meta = { event: "id_key_rotation", from: "v1", to: "v2", rows_affected: N }`.

### Emergency rotation (suspected key compromise)

1. Cut a new key immediately (step 1 above).
2. Deploy step 2 with the new key prioritised in the keyring.
3. Run step 4 (re-encrypt) in a single sustained job  block until
   complete. The compromised key MUST come out of the keyring as soon
   as no row references it.
4. Trigger the breach response runbook (`BREACH_RESPONSE.md`).

---

## Phase 13.3 addendum  LLM provider credential rotation

The `llm_providers.credentials_enc` column is rotated independently of
the row's own lifecycle  the admin can change API keys without touching
the rest of the row via `rotateLlmCredentials({ providerId, newApiKey })`
on `/admin/llm`. The server action decrypts the existing blob (preserves
`modelId` + `endpointUrl` + `extraHeaders`), substitutes the new
`apiKey`, re-encrypts, and writes back  no plaintext ever leaves the
process. The audit row (`admin.llm.credentials.rotated`) carries the
SHA-256 fingerprint's first 8 hex chars of the new key so an auditor
can correlate the rotation event with the upstream provider's own
key-issuance ledger without the secret ever appearing in the audit
trail.

When the team-wide encryption key (`SEBENZA_ENCRYPTION_KEY`) rotates
via the runbook below, the LLM credentials column re-encrypts in lock-
step with the ID and phone columns  same versioned-payload format,
same v1.<base64> wire shape, same `decryptField` lookup. No special
casing.

---

## Open items before commercial launch

- [ ] Move secrets from `.env.local` to a managed secret store (Vercel
      env at minimum; AWS Secrets Manager when we migrate).
- [ ] Implement the keyring + the rotation script (currently single-key).
- [ ] Set the 12-month rotation reminder in the team calendar.
- [ ] Document where Vercel + Neon + Supabase store their own audit
      logs of admin access to our environment, for forensic readiness.
- [ ] Extend the rotation script (`scripts/rotate-id-keys.ts` in the
      runbook above) to walk `app_user.phone_e164_enc` and
      `llm_providers.credentials_enc` alongside `profiles.national_id_enc`
       all three columns use the same key and need to rotate together.
