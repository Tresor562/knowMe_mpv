#!/usr/bin/env node
/**
 * Bind two operator-owned private Telegram channels on KnowMe VPS.
 * Validate both with the existing NexAiStorage_bot credentials before modifying
 * private KnowMe env. No application process is restarted by this script.
 *
 * Run as root on the trusted KnowMe VPS:
 *   KNOWME_RECOVERY_CHAT_ID=-100... KNOWME_DATABASE_CHAT_ID=-100... node ops/configure-knowme-telegram-channels.mjs
 */
import { readFile, writeFile, chmod, rename, copyFile, stat, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';

const ENV_FILE = '/var/lib/nex/runtime/knowme/knowme.env';
const FALLBACK_TOKEN_FILE = '/var/lib/nex/runtime/public/nexaccount/nexai-storage-bot-token';
const FALLBACK_CHAT_ID_FILE = '/var/lib/nex/runtime/public/nexaccount/nexai-storage-chat-id';

function parseEnv(source) {
  const values = {};
  for (const line of source.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index > 0) values[line.slice(0, index)] = line.slice(index + 1).trim();
  }
  return values;
}

async function fromFile(path) {
  try { return String(await readFile(path, 'utf8')).trim(); }
  catch { return ''; }
}

function channelId(value, label) {
  if (!/^-100[1-9]\d{7,}$/.test(String(value || '').trim())) {
    throw new Error(label + ' must be an actual private channel numeric ID (-100...), not an invite URL.');
  }
  return String(value).trim();
}

async function botApi(token, method, payload) {
  const response = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.ok !== true) {
    throw new Error('Telegram channel verification failed (' + method + ', HTTP ' + response.status + ').');
  }
  return result.result;
}

async function requirePostingRights(token, botId, inputChatId, role) {
  const chat = await botApi(token, 'getChat', { chat_id: inputChatId });
  if (chat?.type !== 'channel' || String(chat.id) !== inputChatId) {
    throw new Error(role + ' must resolve to the expected Telegram channel.');
  }
  const admins = await botApi(token, 'getChatAdministrators', { chat_id: inputChatId });
  const bot = Array.isArray(admins) && admins.find(a =>
    String(a?.user?.id) === String(botId) &&
    ['administrator', 'creator'].includes(a?.status)
  );
  if (!bot || (bot.status === 'administrator' && bot.can_post_messages !== true)) {
    throw new Error('The existing storage bot must be an administrator with Post Messages permission in ' + role + '.');
  }
  return true;
}

function updateEnv(source, name, value) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  let matched = false;
  const modified = lines.map(line => {
    if (!line.startsWith(name + '=')) return line;
    if (matched) throw new Error('Duplicate private config key: ' + name);
    matched = true;
    return name + '=' + value;
  });
  if (!matched) modified.push(name + '=' + value);
  return modified.join('\n').replace(/\n*$/, '\n');
}

async function main() {
  if (process.getuid?.() !== 0) throw new Error('Run as root on the KnowMe VPS.');
  const recovery = channelId(process.env.KNOWME_RECOVERY_CHAT_ID, 'Recovery');
  const database = channelId(process.env.KNOWME_DATABASE_CHAT_ID, 'Database');
  if (recovery === database) throw new Error('Recovery and Database channels must be distinct.');

  const original = await readFile(ENV_FILE, 'utf8');
  const existing = parseEnv(original);
  const primaryRaw = existing.MEDIA_TELEGRAM_CHAT_ID || await fromFile(FALLBACK_CHAT_ID_FILE);
  const primary = channelId(primaryRaw, 'Primary');
  if ([recovery, database].includes(primary)) {
    throw new Error('Primary, Recovery and Database must be three different channels.');
  }

  const token = existing.MEDIA_TELEGRAM_BOT_TOKEN || await fromFile(FALLBACK_TOKEN_FILE);
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) {
    throw new Error('The existing storage bot token is not available on the VPS.');
  }
  const identity = await botApi(token, 'getMe', {});
  if (String(identity?.username || '').toLowerCase() !== 'nexaistorage_bot') {
    throw new Error('The existing token does not belong to NexAiStorage_bot.');
  }
  await requirePostingRights(token, identity.id, primary, 'Primary');
  await requirePostingRights(token, identity.id, recovery, 'Recovery');
  await requirePostingRights(token, identity.id, database, 'Database');

  const current = await stat(ENV_FILE);
  if (!current.isFile()) throw new Error('KnowMe runtime env path is not a regular file.');
  let updated = updateEnv(original, 'MEDIA_TELEGRAM_RECOVERY_CHAT_ID', recovery);
  updated = updateEnv(updated, 'MEDIA_TELEGRAM_DATABASE_CHAT_ID', database);
  if (updated === original) {
    process.stdout.write(JSON.stringify({
      configured: true, unchanged: true, channels: 3,
      applicationRestarted: false
    }) + '\n');
    return;
  }

  const backup = ENV_FILE + '.backup-' + new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  // Preserve the old environment with owner-only permissions for rollback.
  await copyFile(ENV_FILE, backup);
  await chmod(backup, 0o600);
  const tmp = join(dirname(ENV_FILE), '.knowme.env.' + randomBytes(8).toString('hex') + '.tmp');
  try {
    await writeFile(tmp, updated, { mode: 0o600, flag: 'wx' });
    await chmod(tmp, 0o600);
    await rename(tmp, ENV_FILE);
  } finally {
    await rm(tmp, { force: true });
  }
  process.stdout.write(JSON.stringify({
    configured: true, channels: 3, verifiedBotAdministrator: true,
    oldEnvSaved: true, applicationRestarted: false,
    note: 'New settings take effect after a reviewed backend deployment/restart.'
  }) + '\n');
}

main().catch(error => {
  // Never print tokens, raw private env or full Telegram responses.
  process.stderr.write('KnowMe storage channel provisioning failed: ' +
    (error instanceof Error ? error.message : 'unknown failure') + '\n');
  process.exitCode = 1;
});
