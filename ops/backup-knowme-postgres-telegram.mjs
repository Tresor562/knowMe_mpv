#!/usr/bin/env node
/**
 * Encrypted PostgreSQL dump -> dedicated KnowMe Telegram DATABASE channel.
 * Run only on the trusted VPS. Does not alter database data or Telegram media.
 * A backup is complete only when its encrypted manifest is posted successfully.
 * No cron/timer is installed by this script.
 */
import { spawn } from 'node:child_process';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const ENV_FILE = process.env.KNOWME_ENV_FILE || '/var/lib/nex/runtime/knowme/knowme.env';
const CHUNK_BYTES = 18 * 1024 * 1024; // below public Bot API 20 MiB download limit
const API_URL = 'https://api.telegram.org';
const TIMEOUT_MS = 120_000;

function readEnv(source) {
  const config = {};
  for (const line of source.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index > 0) config[line.slice(0, index)] = line.slice(index + 1).trim();
  }
  return config;
}

function required(config, name) {
  const value = String(config[name] || '').trim();
  if (!value) throw new Error(name + ' is not configured.');
  return value;
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function telegramCall(token, method, body) {
  const endpoint = API_URL + '/bot' + token + '/' + method;
  for (let attempt = 1; attempt <= 4; attempt++) {
    let response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: body instanceof FormData ? undefined : { 'content-type': 'application/json' },
        body: body instanceof FormData ? body : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
    } catch {
      if (attempt === 4) throw new Error('Telegram network request failed.');
      await delay(600 * attempt);
      continue;
    }

    const data = await response.json().catch(() => null);
    if (response.ok && data?.ok === true) return data.result;
    if (attempt === 4 || (response.status !== 429 && response.status < 500)) {
      throw new Error('Telegram ' + method + ' failed with HTTP ' + response.status + '.');
    }
    const retry = Number(data?.parameters?.retry_after);
    await delay(Number.isFinite(retry) && retry > 0 ? Math.min(retry * 1000, 30_000) : 1000 * attempt);
  }
  throw new Error('Telegram operation exhausted retries.');
}

function encryptChunk(plain, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain), cipher.final()]);
  // A fixed magic plus IV + AEAD tag precedes ciphertext.
  return Buffer.concat([Buffer.from('KDB1'), iv, cipher.getAuthTag(), data]);
}

async function postEncrypted(token, chatId, name, plain, key) {
  const encrypted = encryptChunk(plain, key);
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('document', new Blob([new Uint8Array(encrypted)], {
    type: 'application/octet-stream'
  }), name + '.enc');
  form.append('caption', 'KnowMe encrypted PostgreSQL backup');
  form.append('disable_notification', 'true');
  form.append('protect_content', 'true');
  const message = await telegramCall(token, 'sendDocument', form);
  if (!Number.isSafeInteger(message?.message_id) || !message?.document?.file_id) {
    throw new Error('Telegram backup upload did not return an archive reference.');
  }
  return {
    messageId: message.message_id,
    fileId: String(message.document.file_id),
    plainBytes: plain.length,
    plainSha256: createHash('sha256').update(plain).digest('hex')
  };
}

async function main() {
  const config = readEnv(await readFile(ENV_FILE, 'utf8'));
  const token = required(config, 'MEDIA_TELEGRAM_BOT_TOKEN');
  const chatId = required(config, 'MEDIA_TELEGRAM_DATABASE_CHAT_ID');
  const rawKey = required(config, 'KNOWME_DB_BACKUP_KEY');
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) throw new Error('Invalid storage bot token.');
  if (!/^-?\d+$/.test(chatId)) throw new Error('Database channel must have a numeric Telegram ID.');
  if (!/^[0-9a-fA-F]{64}$/.test(rawKey)) throw new Error('KNOWME_DB_BACKUP_KEY must be 32 bytes in hex.');
  const key = Buffer.from(rawKey, 'hex');
  const me = await telegramCall(token, 'getMe', {});
  if (String(me?.username || '').toLowerCase() !== 'nexaistorage_bot') {
    throw new Error('Unexpected Telegram storage bot identity.');
  }
  const chat = await telegramCall(token, 'getChat', { chat_id: chatId });
  if (chat?.type !== 'channel') throw new Error('Database target is not a channel.');
  const admins = await telegramCall(token, 'getChatAdministrators', { chat_id: chatId });
  if (!admins.some(row => row?.user?.id === me.id &&
      ['creator', 'administrator'].includes(row.status) &&
      row.can_post_messages !== false)) {
    throw new Error('The storage bot cannot post to database backup channel.');
  }
  if (chatId === config.MEDIA_TELEGRAM_CHAT_ID ||
      chatId === config.MEDIA_TELEGRAM_RECOVERY_CHAT_ID) {
    throw new Error('Database channel must be distinct from the media channels.');
  }

  const archiveId = new Date().toISOString().replace(/\D/g, '').slice(0, 14) +
    '-' + randomBytes(6).toString('hex');
  const child = spawn('docker', [
    'exec', 'knowme-postgres', 'pg_dump', '-U', 'knowme', '-d', 'knowme', '-Fc'
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let errorTail = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', part => { errorTail = (errorTail + part).slice(-1000); });
  const completed = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', code => resolve(code));
  });
  const hash = createHash('sha256');
  let total = 0;
  let buffered = Buffer.alloc(0);
  const chunks = [];

  for await (const piece of child.stdout) {
    const bytes = Buffer.from(piece);
    hash.update(bytes);
    total += bytes.length;
    buffered = Buffer.concat([buffered, bytes]);
    while (buffered.length >= CHUNK_BYTES) {
      const part = Buffer.from(buffered.subarray(0, CHUNK_BYTES));
      buffered = Buffer.from(buffered.subarray(CHUNK_BYTES));
      chunks.push(await postEncrypted(token, chatId,
        'knowme-db-' + archiveId + '-part-' + (chunks.length + 1), part, key));
    }
  }
  const exit = await completed;
  if (exit !== 0) throw new Error('pg_dump failed with exit code ' + exit +
    (errorTail ? ' (see VPS pg_dump stderr)' : ''));
  if (!total) throw new Error('pg_dump returned an empty archive.');
  if (buffered.length) {
    chunks.push(await postEncrypted(token, chatId,
      'knowme-db-' + archiveId + '-part-' + (chunks.length + 1), buffered, key));
  }
  const manifest = {
    format: 'knowme-postgres-encrypted-backup-v1',
    archiveId,
    createdAt: new Date().toISOString(),
    database: 'knowme',
    dumpFormat: 'pg_dump -Fc',
    cipher: 'aes-256-gcm',
    chunkSize: CHUNK_BYTES,
    bytes: total,
    sha256: hash.digest('hex'),
    chunks
  };
  const receipt = await postEncrypted(token, chatId, 'knowme-db-' + archiveId + '-manifest',
    Buffer.from(JSON.stringify(manifest)), key);
  // No token, key, channel join link, user information or plaintext is logged.
  process.stdout.write(JSON.stringify({
    ok: true, archiveId, chunks: chunks.length, bytes: total,
    manifestMessageId: receipt.messageId
  }) + '\n');
}

main().catch(error => {
  process.stderr.write('KnowMe database backup failed: ' +
    (error instanceof Error ? error.message : 'unknown failure') + '\n');
  process.exitCode = 1;
});
