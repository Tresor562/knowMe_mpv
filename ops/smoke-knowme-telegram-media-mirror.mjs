import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import assert from 'node:assert/strict';

const modulePath = [
  '/app/apps/api/dist/media/telegram-media-storage.js',
  '/app/apps/api/dist/src/media/telegram-media-storage.js'
].find(existsSync);
if (!modulePath) throw new Error('Could not locate compiled KnowMe Telegram storage module.');
const require = createRequire(import.meta.url);
const { TelegramMediaStorage } = require(modulePath);

const storage = new TelegramMediaStorage();
const fixture = Buffer.from('KnowMe encrypted Telegram media backup healthcheck', 'utf8');
let reference = '';
try {
  await storage.init();
  reference = await storage.put('knowme-storage-healthcheck.txt', fixture, 'text/plain');
  assert.ok(reference.startsWith('tg.'), 'Expected opaque Telegram reference');
  const stored = JSON.parse(Buffer.from(reference.slice(3), 'base64url').toString('utf8'));
  assert.equal(stored.v, 2, 'A two-channel reference is required');
  assert.deepEqual(await storage.get(reference), fixture);
  process.stdout.write('KNOWME_MIRROR_UPLOAD=YES; PRIMARY_AND_RECOVERY=YES; DOWNLOAD_INTEGRITY=PASS\n');
} finally {
  if (reference) {
    await storage.delete(reference);
    process.stdout.write('KNOWME_MIRROR_CLEANUP=PASS\n');
  }
}
