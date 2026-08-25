# KMD-236 — Media quarantine retry worker

## Goal

Execute the fail-closed retry eligibility policy introduced by KMD-235 with a bounded, opt-in worker while preserving quarantine authority and the KMD-228 market blocker.

## Delivered

- opt-in `MediaQuarantineRetryWorkerService`;
- bounded interval (1 minute to 6 hours) and bounded batch size (1 to 100);
- candidate selection restricted to non-deleted `QUARANTINED` + `UNAVAILABLE` media below the 5-attempt cap with authoritative last-attempt metadata;
- final eligibility re-check through the KMD-235 policy before any scan;
- no overlapping scheduled batch inside one API process;
- automatic rescans use `actorId=null` and audit metadata `source=AUTOMATIC` rather than inventing an administrator identity;
- one asset failure is contained so the remaining bounded batch can continue;
- automatic retries are disabled by default in `.env.example`.

## Security and privacy boundaries

The worker never releases media by itself. It delegates to the existing quarantine rescan path, which reloads private bytes, verifies the persisted SHA-256, invokes the configured scanner, and only makes a media asset `AVAILABLE` after an authoritative `CLEAN` verdict. `INFECTED` and `UNAVAILABLE` remain quarantined.

The worker does not expose a public endpoint, file contents, storage keys, scanner credentials, or user identifiers.

## Migration

No Prisma migration is required. KMD-236 consumes the attempt metadata introduced by KMD-234.

Deployment configuration:

- `MEDIA_QUARANTINE_RETRY_ENABLED=false` by default;
- `MEDIA_QUARANTINE_RETRY_INTERVAL_MS=60000` example;
- `MEDIA_QUARANTINE_RETRY_BATCH_SIZE=10` example.

Enable the worker only after the external scanner, credentials, network egress, capacity and operations policy have been validated in the target environment.

## Rollback

Set `MEDIA_QUARANTINE_RETRY_ENABLED=false` for an immediate operational rollback. Code rollback can then revert KMD-236 without data migration.

## Proof limits

This KMD does **not** prove or provide:

- a production antimalware vendor deployment;
- provider credentials/secret-manager configuration;
- provider SLA, capacity or rate limits;
- real EICAR/benign production exercises;
- distributed locking across multiple API instances;
- analyst workflow or quarantine alerting;
- production deployment or store release.

KnowMe currently enforces a single API instance while rate limiting remains process-local. If horizontal API scaling is later enabled, this worker requires a distributed claim/lock design before automatic retries may remain enabled.

The KMD-228 release blocker remains in force until the external production evidence is real.
