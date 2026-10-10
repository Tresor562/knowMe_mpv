# KnowMe — private three-channel Telegram storage

## Roles

1. Existing **primary** private channel: encrypted application media, controlled by `MEDIA_TELEGRAM_CHAT_ID`.
2. **Recovery** private channel: a second copy of newly uploaded encrypted media, controlled by `MEDIA_TELEGRAM_RECOVERY_CHAT_ID`.
3. **Database** private channel: encrypted `pg_dump -Fc` archives and encrypted manifests, controlled by `MEDIA_TELEGRAM_DATABASE_CHAT_ID`.

All channels use the existing `@NexAiStorage_bot`, which must be added **by a human administrator** with the permission to post messages. These channels must be distinct. No private invite links, tokens, numeric IDs, personal data, database credentials or encryption keys belong in this public repository.

**Private invitation URLs are not Bot API chat IDs.** The two new channels must first have their numeric identifiers (usually beginning with `-100`) discovered via an authorized operator using Telegram channel-post updates, then set in the VPS-only `/var/lib/nex/runtime/knowme/knowme.env`. Never paste a bot token into a public channel, ticket or URL.

## New media behavior (opt-in)

- Without `MEDIA_TELEGRAM_RECOVERY_CHAT_ID`, existing uploads continue to work as before; the legacy opaque `tg.` v1 reference remains readable.
- With the ID configured, API startup checks channel type and bot administrator rights in both media channels.
- **New** uploads encrypt once, send to primary and recovery, then record the two Telegram file references together (v2 reference).
- If the recovery upload fails, the whole new upload fails rather than silently promising redundant storage. Primary orphan cleanup is attempted.
- If the primary retrieval fails, downloading automatically tries the recovery file ID, verifying GCM authentication and expected plaintext size.
- Deletion attempts both copies; either failure makes metadata deletion fail closed. Telegram may refuse to delete old messages, so the deletion-retention/privacy boundary **requires a separate provider-independent solution before a public release**.
- Existing primary-only v1 objects are **not automatically backfilled** to Recovery. Backfill and proof of retained copies remain required.
- The current media upload API remains limited to <=25 MiB (20 MiB on the current public Bot API deployment). These changes do not enable multi-gigabyte files.

## Database backup and integrity proof (scheduled on the verified VPS)

Server-only configuration: `MEDIA_TELEGRAM_DATABASE_CHAT_ID` and a separate, durable `KNOWME_DB_BACKUP_KEY` (64 hex chars / 32 bytes). The deploy script preserves channel IDs from the existing protected VPS configuration and generates a key if absent.

To create an encrypted manual backup from the running VPS:

```bash
node /opt/nex/apps/public/knowme/source/ops/backup-knowme-postgres-telegram.mjs
```

The backup process streams `pg_dump -Fc` from the `knowme-postgres` container, encrypts each <=18 MiB plaintext chunk with AES-256-GCM and posts it to the Database channel. Only after the dump finishes successfully does it send an encrypted manifest (parts, SHA-256 checksums, sizes, archive ID). Preserve the returned `manifestFileId` in a protected operator log.

To reconstruct and verify a dump **without touching the running database**:

```bash
node /opt/nex/apps/public/knowme/source/ops/verify-knowme-postgres-telegram-backup.mjs 'MANIFEST_FILE_ID'
```

This writes an integrity-checked `.dump` with file mode `0600` under `/var/lib/nex/runtime/knowme/verified-restores`. Perform any subsequent `pg_restore` in a separately verified isolated database. The restore operation must be rehearsed, not assumed successful from an upload receipt.

## Deployment gates

1. The operator must confirm the new channel IDs, and that `@NexAiStorage_bot` is an administrator with post permission in all three channels.
2. Set `MEDIA_TELEGRAM_RECOVERY_CHAT_ID`, `MEDIA_TELEGRAM_DATABASE_CHAT_ID`, and retain `KNOWME_DB_BACKUP_KEY` in the protected VPS environment.
3. Verify API readiness and run tests for media primary outage, recovery outage, encryption/authentication failure, and deletion.
4. Create one manual PostgreSQL backup, reconstruct/verify it, and rehearse `pg_restore` into an isolated database.
5. **Only then** enable a serialized, scheduled runner (e.g. `flock` + systemd timer) with operational alerts, retention policy, off-platform copy, and periodic restoration tests.
6. Validate recovery and database consistency after storage bot/channel loss. Keep independent off-Telegram backups to cover platform-wide failure.

**Verified VPS state (2026-10-10):** the two new channels were validated using `@NexAiStorage_bot`, and private server configuration was provisioned without logging secrets. The KnowMe API was deployed at commit `738a867e9f345c3ee76b1773374360d157c9ea29` and returned healthy readiness. A real encrypted Database-channel archive was downloaded and authenticated, then restored into an isolated PostgreSQL instance (210 public tables; production untouched). A test encrypted media object was mirrored, downloaded, authenticated and deleted from both media channels. The systemd timer `knowme-telegram-db-backup.timer` is enabled and its first scheduled backup is subject to ongoing runtime confirmation.

Evidence is retained in private NexControl tickets #34–#41 in repository `Tresor562/Nexus-lab`. Credentials and private channel IDs are deliberately not recorded here.

**Remaining release limitations:** real user-facing multi-gigabyte file uploads are not implemented; per-upload limits remain. Telegram is not sufficient as an independent disaster-recovery provider. Restore rehearsals, key escrow, backup-retention policy, provider-independent backups, on-call alert verification and verified data deletion after Telegram's Bot API time windows remain required before a high-assurance public release.
