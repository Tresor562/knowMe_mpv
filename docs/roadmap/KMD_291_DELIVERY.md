# KMD-291 — Production data export/delete smoke

## Goal

Turn the market-evidence requirement `data_export_delete_validation` into an executable production smoke without touching an existing user account.

## Delivered

- `pnpm release:data-lifecycle:smoke` creates a fresh ephemeral canary account on the configured production origin.
- The smoke exports that canary through the real `/account/export` sensitive-action route and requires a canonical export tied to the same canary.
- The export is rejected if `passwordHash` appears in the account payload.
- The smoke deletes only the canary it created, through the real `/account` deletion route, using the canary password generated in memory.
- The smoke then requires authentication with the deleted username/password to fail with HTTP 401.
- A destructive confirmation string `DELETE_EPHEMERAL_CANARY` is mandatory before any network request.
- The production origin must be a canonical HTTPS origin with no credentials, path, query, or fragment.
- Network timeout is bounded to 500–10000 ms, redirects are refused, JSON responses are bounded to 512 KiB, and the optional evidence artifact is created exclusively with restrictive permissions when supported.
- The artifact contains no access/refresh token, password, canary email, raw username, or raw user id. It retains only a SHA-256 of the canary user id plus bounded pass/fail metadata.
- If a failure occurs after registration but before successful deletion, the script attempts best-effort deletion of that same newly-created canary. The original failure remains authoritative.

## Safety boundary

This smoke is intentionally destructive only to an account that the same invocation created. It never accepts credentials for a pre-existing account and does not provide a mode that targets an arbitrary user id.

The smoke does **not** prove legal compliance, data-controller obligations, downstream processor deletion, object-store lifecycle, database backup expiration, legal holds, or eventual erasure from retained backups. Those remain separate operational/legal evidence.

## Adoption

Run only against the intended production API origin:

```bash
pnpm release:data-lifecycle:smoke \
  --origin https://api.example.com \
  --confirm DELETE_EPHEMERAL_CANARY \
  --timeout-ms 5000 \
  --output ./evidence/data-export-delete.json
```

Retain the exact artifact bytes and their printed SHA-256. A later semantic binder must validate this KMD-291 schema before the market-evidence slot `data_export_delete_validation` can become `VERIFIED`.

## Migration

No Prisma migration and no user-data schema change. The only production write is the temporary canary account and its immediate deletion during an explicitly confirmed smoke invocation.

## Rollback

Revert KMD-291. Existing account export/delete behavior remains unchanged because this block adds only release tooling, tests, and documentation.

## Validation required before merge

- root tests, including `scripts/data-export-delete-smoke.test.mjs`;
- repository build;
- Prisma generate/migrate/drift checks;
- Chromium Web E2E;
- PostgreSQL API E2E;
- no claim that production deletion has been exercised unless a real KMD-291 artifact from the target environment is retained.
