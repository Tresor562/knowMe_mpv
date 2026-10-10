#!/usr/bin/env node
/**
 * Restore an encrypted Telegram PostgreSQL backup into a private .dump file
 * WITHOUT touching the running database. Requires the MANIFEST file_id.
 * Usage: node ops/verify-knowme-postgres-telegram-backup.mjs <manifest-file-id>
 */
import { createDecipheriv, createHash } from 'node:crypto';
import { readFile, mkdir, open, rm } from 'node:fs/promises';
import { join } from 'node:path';

const MAX_ENCRYPTED_BYTES = 20 * 1024 * 1024;
const ENV_FILE = process.env.KNOWME_ENV_FILE || '/var/lib/nex/runtime/knowme/knowme.env';
const OUTPUT_DIRECTORY = '/var/lib/nex/runtime/knowme/verified-restores';

function parseEnv(source) {
  const config = {};
  for (const line of source.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i > 0) config[line.slice(0, i)] = line.slice(i + 1).trim();
  }
  return config;
}

async function telegramJson(token, method, params) {
  const response = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params), signal: AbortSignal.timeout(120_000)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) throw new Error('Telegram ' + method + ' failed.');
  return payload.result;
}

async function downloadEncrypted(token, fileId) {
  if (!/^[A-Za-z0-9_-]{10,1024}$/.test(String(fileId))) throw new Error('Invalid Telegram file_id.');
  const info = await telegramJson(token, 'getFile', { file_id: fileId });
  if (!info?.file_path || Number(info.file_size) > MAX_ENCRYPTED_BYTES) {
    throw new Error('Telegram backup part is unavailable or exceeds download limit.');
  }
  const url = 'https://api.telegram.org/file/bot' + token + '/' +
    String(info.file_path).split('/').map(encodeURIComponent).join('/');
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error('Telegram backup download failed.');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 33 || bytes.length > MAX_ENCRYPTED_BYTES) {
    throw new Error('Encrypted backup has invalid size.');
  }
  return bytes;
}

function decrypt(payload, key) {
  if (payload.subarray(0, 4).toString('utf8') !== 'KDB1') {
    throw new Error('Unexpected database backup encryption format.');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, payload.subarray(4, 16));
  decipher.setAuthTag(payload.subarray(16, 32));
  return Buffer.concat([decipher.update(payload.subarray(32)), decipher.final()]);
}

async function main() {
  const fileId = String(process.argv[2] || '').trim();
  if (!fileId) throw new Error('Provide the encrypted manifest file_id from the backup receipt.');
  const config = parseEnv(await readFile(ENV_FILE, 'utf8'));
  const token = String(config.MEDIA_TELEGRAM_BOT_TOKEN || '').trim();
  const rawKey = String(config.KNOWME_DB_BACKUP_KEY || '').trim();
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) throw new Error('Invalid Telegram bot token.');
  if (!/^[0-9a-fA-F]{64}$/.test(rawKey)) throw new Error('Missing or invalid backup encryption key.');
  const key = Buffer.from(rawKey, 'hex');
  const manifestPlain = decrypt(await downloadEncrypted(token, fileId), key);
  if (manifestPlain.length > 5_000_000) throw new Error('Unreasonably large backup manifest.');
  const manifest = JSON.parse(manifestPlain.toString('utf8'));
  if (manifest?.format !== 'knowme-postgres-encrypted-backup-v1' ||
      !/^\d{14}-[0-9a-f]{12}$/.test(String(manifest.archiveId)) ||
      !Array.isArray(manifest.chunks) || !manifest.chunks.length ||
      manifest.chunks.length > 10000 ||
      !/^[a-f0-9]{64}$/.test(String(manifest.sha256)) ||
      !Number.isSafeInteger(manifest.bytes) || manifest.bytes <= 0) {
    throw new Error('Invalid encrypted database backup manifest.');
  }

  await mkdir(OUTPUT_DIRECTORY, { recursive: true, mode: 0o700 });
  const filePath = join(OUTPUT_DIRECTORY, 'knowme-' + manifest.archiveId + '.dump');
  const handle = await open(filePath, 'wx', 0o600);
  let valid = false;
  try {
    const digest = createHash('sha256');
    let size = 0;
    for (const part of manifest.chunks) {
      if (!part || !Number.isSafeInteger(part.plainBytes) ||
          part.plainBytes < 1 || part.plainBytes > 18 * 1024 * 1024 ||
          !/^[a-f0-9]{64}$/.test(String(part.plainSha256))) {
        throw new Error('Invalid backup chunk metadata.');
      }
      const plain = decrypt(await downloadEncrypted(token, part.fileId), key);
      if (plain.length !== part.plainBytes ||
          createHash('sha256').update(plain).digest('hex') !== part.plainSha256) {
        throw new Error('Backup chunk integrity mismatch.');
      }
      digest.update(plain);
      size += plain.length;
      await handle.writeFile(plain);
    }
    if (size !== manifest.bytes || digest.digest('hex') !== manifest.sha256) {
      throw new Error('PostgreSQL archive integrity mismatch.');
    }
    valid = true;
  } finally {
    await handle.close();
    if (!valid) await rm(filePath, { force: true });
  }
  process.stdout.write(JSON.stringify({
    verified: true, archiveId: manifest.archiveId,
    bytes: manifest.bytes, parts: manifest.chunks.length, filePath
  }) + '\n');
  // Do not invoke pg_restore automatically. Administrator must perform
  // separate reviewed restoration in an isolated PostgreSQL instance.
}

main().catch(error => {
  process.stderr.write('KnowMe backup verification failed: ' +
    (error instanceof Error ? error.message : 'unknown failure') + '\n');
  process.exitCode = 1;
});
