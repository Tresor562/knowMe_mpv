import { createDecipheriv, randomBytes } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const SHA = String(process.env.KNOWME_DEPLOY_SHA || '').trim();
if (!/^[0-9a-f]{40}$/i.test(SHA)) throw new Error('KNOWME_DEPLOY_SHA must be a full commit SHA.');

const REPO = 'https://github.com/Tresor562/knowMe_mpv.git';
const APP_ROOT = '/opt/nex/apps/public/knowme';
const SOURCE = join(APP_ROOT, 'source');
const RUNTIME = '/var/lib/nex/runtime/knowme';
const ENV_FILE = join(RUNTIME, 'knowme.env');
const DEPLOY_LOG = join(RUNTIME, 'deploy.log');
const IMAGE = 'knowme-api:' + SHA.slice(0, 12);
const POSTGRES_IMAGE = 'postgres:16.15-alpine@sha256:cf78e76683b9ca8c5733cbbdce6c9262b45b6767934dd0a95e671f9a0fc20685';
const NETWORK = 'knowme-net';
const DB_CONTAINER = 'knowme-postgres';
const API_CONTAINER = 'knowme-api';

mkdirSync(APP_ROOT, { recursive: true, mode: 0o755 });
mkdirSync(RUNTIME, { recursive: true, mode: 0o700 });

function run(cmd, args = [], options = {}) {
  return execFileSync(cmd, args, { encoding: 'utf8', timeout: options.timeout ?? 120_000, ...options }).trim();
}
function existsContainer(name) {
  try { return Boolean(run('docker', ['ps', '-a', '--filter', 'name=^/' + name + '$', '--format', '{{.Names}}'])); }
  catch { return false; }
}
function runningContainer(name) {
  try { return Boolean(run('docker', ['ps', '--filter', 'name=^/' + name + '$', '--format', '{{.Names}}'])); }
  catch { return false; }
}
function ensureNetwork() {
  try { run('docker', ['network', 'inspect', NETWORK]); }
  catch { run('docker', ['network', 'create', NETWORK]); }
}
function randomHex(bytes = 32) { return randomBytes(bytes).toString('hex'); }
function envQuote(value) { return String(value).replace(/\n/g, '').replace(/\r/g, ''); }
function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i > 0) out[line.slice(0, i)] = line.slice(i + 1);
  }
  return out;
}
function writeEnv(values) {
  const body = Object.entries(values).map(([k, v]) => k + '=' + envQuote(v)).join('\n') + '\n';
  const tmp = ENV_FILE + '.tmp-' + process.pid;
  writeFileSync(tmp, body, { mode: 0o600 });
  chmodSync(tmp, 0o600);
  renameSync(tmp, ENV_FILE);
}

async function currentTelegramStorage() {
  const base = '/opt/nex/apps/public/nexai/current';
  const [{ sessionKey }, { db, replyStorageConfig }] = await Promise.all([
    import('file://' + base + '/config.mjs'),
    import('file://' + base + '/store.mjs')
  ]);
  const database = await db();
  const row = await database.collection('nexaccount_system').findOne(
    { _id: 'nexai_reply_storage_bot_token' },
    { projection: { encryptedToken: 1 } }
  );
  const raw = Buffer.from(String(row?.encryptedToken || ''), 'base64');
  if (raw.length < 29) throw new Error('NexAI Storage encrypted token is unavailable.');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', sessionKey(), iv);
  decipher.setAuthTag(tag);
  const token = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) throw new Error('NexAI Storage token could not be validated.');
  const config = await replyStorageConfig();
  const chatId = String(config?.chatId || '').trim();
  if (!/^-?\d+$/.test(chatId)) throw new Error('NexAI Storage channel is not bound.');
  return { token, chatId };
}

function ensureSource() {
  if (!existsSync(join(SOURCE, '.git'))) {
    run('git', ['clone', '--filter=blob:none', REPO, SOURCE], { timeout: 180_000 });
  }
  run('git', ['-C', SOURCE, 'fetch', '--prune', 'origin', SHA], { timeout: 180_000 });
  run('git', ['-C', SOURCE, 'checkout', '--detach', '--force', SHA]);
  const actual = run('git', ['-C', SOURCE, 'rev-parse', 'HEAD']);
  if (actual !== SHA) throw new Error('KnowMe source checkout mismatch.');
}

function buildImage() {
  const fd = openSync(DEPLOY_LOG, 'a', 0o600);
  appendFileSync(DEPLOY_LOG, '\n=== build ' + new Date().toISOString() + ' ' + SHA + ' ===\n');
  const result = spawnSync('docker', ['build', '-f', 'Dockerfile.api', '-t', IMAGE, '.'], {
    cwd: SOURCE,
    stdio: ['ignore', fd, fd],
    timeout: 30 * 60_000
  });
  closeSync(fd);
  if (result.status !== 0) throw new Error('Docker build failed. See ' + DEPLOY_LOG);
}

function ensureDatabase(env) {
  ensureNetwork();
  if (!existsContainer(DB_CONTAINER)) {
    run('docker', [
      'run', '-d', '--restart', 'unless-stopped',
      '--name', DB_CONTAINER,
      '--network', NETWORK,
      '-e', 'POSTGRES_USER=knowme',
      '-e', 'POSTGRES_PASSWORD=' + env.KNOWME_DB_PASSWORD,
      '-e', 'POSTGRES_DB=knowme',
      '-v', 'knowme_pgdata:/var/lib/postgresql/data',
      POSTGRES_IMAGE
    ], { timeout: 180_000 });
  } else if (!runningContainer(DB_CONTAINER)) {
    run('docker', ['start', DB_CONTAINER]);
  }

  for (let i = 0; i < 45; i++) {
    try {
      run('docker', ['exec', DB_CONTAINER, 'pg_isready', '-U', 'knowme', '-d', 'knowme'], { timeout: 5000 });
      return;
    } catch {}
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  throw new Error('PostgreSQL did not become ready.');
}

function migrate() {
  const fd = openSync(DEPLOY_LOG, 'a', 0o600);
  const result = spawnSync('docker', [
    'run', '--rm', '--network', NETWORK,
    '--env-file', ENV_FILE,
    IMAGE, 'pnpm', 'db:migrate:deploy'
  ], { stdio: ['ignore', fd, fd], timeout: 10 * 60_000 });
  closeSync(fd);
  if (result.status !== 0) throw new Error('Prisma migration deploy failed. See ' + DEPLOY_LOG);
}

function startApi() {
  const previousImage = existsContainer(API_CONTAINER)
    ? (() => { try { return run('docker', ['inspect', '-f', '{{.Config.Image}}', API_CONTAINER]); } catch { return ''; } })()
    : '';

  if (existsContainer(API_CONTAINER)) run('docker', ['rm', '-f', API_CONTAINER]);
  run('docker', [
    'run', '-d', '--restart', 'unless-stopped',
    '--name', API_CONTAINER,
    '--network', NETWORK,
    '--env-file', ENV_FILE,
    '-p', '127.0.0.1:4000:4000',
    IMAGE
  ], { timeout: 120_000 });

  let healthy = false;
  for (let i = 0; i < 60; i++) {
    try {
      const raw = run('curl', ['-fsS', '--max-time', '3', 'http://127.0.0.1:4000/health/ready'], { timeout: 5000 });
      const data = JSON.parse(raw);
      if (data?.status === 'ready' && data?.checks?.database === 'up') {
        healthy = true;
        break;
      }
    } catch {}
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }

  if (!healthy) {
    const logs = (() => { try { return run('docker', ['logs', '--tail', '80', API_CONTAINER]); } catch { return ''; } })();
    run('docker', ['rm', '-f', API_CONTAINER]);
    if (previousImage) {
      run('docker', [
        'run', '-d', '--restart', 'unless-stopped',
        '--name', API_CONTAINER,
        '--network', NETWORK,
        '--env-file', ENV_FILE,
        '-p', '127.0.0.1:4000:4000',
        previousImage
      ], { timeout: 120_000 });
    }
    throw new Error('KnowMe readiness failed. ' + logs.slice(-2500));
  }
  return previousImage;
}

const storage = await currentTelegramStorage();
const oldEnv = existsSync(ENV_FILE) ? parseEnv(readFileSync(ENV_FILE, 'utf8')) : {};
const dbPassword = oldEnv.KNOWME_DB_PASSWORD || randomHex(24);
const env = {
  ...oldEnv,
  KNOWME_DB_PASSWORD: dbPassword,
  NODE_ENV: 'production',
  KNOWME_RELEASE_COMMIT: SHA,
  KNOWME_RELEASE_VERSION: oldEnv.KNOWME_RELEASE_VERSION || '1.0.0-preview',
  KNOWME_STARTUP_PHASE_DIAGNOSTIC: '1',
  DATABASE_URL: 'postgresql://knowme:' + dbPassword + '@knowme-postgres:5432/knowme?schema=public',
  JWT_SECRET: oldEnv.JWT_SECRET || randomHex(48),
  PORT: '4000',
  WEB_URL: 'https://knowmempv.vercel.app',
  CORS_ALLOWED_ORIGINS_JSON: '["https://knowmempv.vercel.app"]',
  TRUSTED_PROXY_HOPS: '1',
  API_INSTANCE_COUNT: '1',
  API_RATE_LIMIT_TTL_MS: '60000',
  API_RATE_LIMIT_LIMIT: '120',
  API_REQUEST_TIMEOUT_MS: '30000',
  API_HEADERS_TIMEOUT_MS: '15000',
  API_KEEP_ALIVE_TIMEOUT_MS: '5000',
  MEDIA_STORAGE_DRIVER: 'telegram',
  MEDIA_ACCOUNT_QUOTA_BYTES: '524288000',
  MEDIA_UPLOAD_MAX_BYTES: '20971520',
  MEDIA_TELEGRAM_BOT_TOKEN: storage.token,
  MEDIA_TELEGRAM_CHAT_ID: storage.chatId,
  MEDIA_TELEGRAM_EXPECTED_BOT_USERNAME: 'NexAiStorage_bot',
  MEDIA_TELEGRAM_API_BASE_URL: 'https://api.telegram.org',
  MEDIA_TELEGRAM_TIMEOUT_MS: '30000',
  MEDIA_TELEGRAM_MAX_BYTES: '20971520',
  MEDIA_TELEGRAM_ENCRYPTION_KEY: oldEnv.MEDIA_TELEGRAM_ENCRYPTION_KEY || randomHex(32),
  ACCOUNT_SECURITY_ENCRYPTION_KEY: oldEnv.ACCOUNT_SECURITY_ENCRYPTION_KEY || randomHex(32),
  MEDIA_QUARANTINE_INFECTED_RETENTION_DAYS: oldEnv.MEDIA_QUARANTINE_INFECTED_RETENTION_DAYS || '30',
  MEDIA_QUARANTINE_UNAVAILABLE_RETENTION_DAYS: oldEnv.MEDIA_QUARANTINE_UNAVAILABLE_RETENTION_DAYS || '7',
  MEDIA_QUARANTINE_RETRY_ENABLED: 'false',
  MEDIA_QUARANTINE_RETRY_INTERVAL_MS: '60000',
  MEDIA_QUARANTINE_RETRY_BATCH_SIZE: '10',
  MEDIA_PURGE_ALERT_WEBHOOK_URL: oldEnv.MEDIA_PURGE_ALERT_WEBHOOK_URL || 'https://knowmempv.vercel.app/',
  MEDIA_PURGE_ALERT_WEBHOOK_TOKEN: oldEnv.MEDIA_PURGE_ALERT_WEBHOOK_TOKEN || randomHex(32),
  MEDIA_PURGE_ALERT_WEBHOOK_TIMEOUT_MS: oldEnv.MEDIA_PURGE_ALERT_WEBHOOK_TIMEOUT_MS || '2000'
};
writeEnv(env);
ensureSource();
buildImage();
ensureDatabase(env);
migrate();
const previousImage = startApi();

console.log(JSON.stringify({
  ok: true,
  commit: SHA,
  image: IMAGE,
  database: 'ready',
  api: 'ready',
  localUrl: 'http://127.0.0.1:4000',
  telegramStorage: true,
  telegramPayloadEncryption: true,
  previousImage: previousImage || null
}));
