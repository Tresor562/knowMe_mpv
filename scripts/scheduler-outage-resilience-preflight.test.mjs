import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const files = {
  games: await readFile(new URL('../apps/api/src/games/game-session-maintenance.service.ts', import.meta.url), 'utf8'),
  social: await readFile(new URL('../apps/api/src/social-matchmaking/social-matchmaking-maintenance.service.ts', import.meta.url), 'utf8'),
  creators: await readFile(new URL('../apps/api/src/creators/creator-metrics-retention.service.ts', import.meta.url), 'utf8'),
  notifications: await readFile(new URL('../apps/api/src/profile-experience/profile-circle-notification-scheduler.service.ts', import.meta.url), 'utf8'),
  notificationResilience: await readFile(new URL('../apps/api/src/profile-experience/profile-circle-notification-resilience-scheduler.service.ts', import.meta.url), 'utf8')
};

test('database-backed maintenance timers use scheduler-owned rejection boundaries', () => {
  for (const [name, source] of Object.entries(files)) {
    assert.doesNotMatch(source, /setInterval\(\(\) => void this\.(?:tick|cleanup)\(/, `${name} must not detach a rejecting maintenance promise directly`);
    assert.match(source, /catch \(error\)/, `${name} must contain scheduled failures`);
    assert.match(source, /it will retry on the next interval/, `${name} must preserve retry-on-next-interval semantics`);
  }
});

test('game and social maintenance preserve explicit tick rejection semantics behind a scheduled wrapper', () => {
  assert.match(files.games, /void this\.runScheduledTick\(\)/);
  assert.match(files.games, /private async runScheduledTick\(\)[\s\S]*await this\.tick\(\)/);
  assert.match(files.social, /void this\.runScheduledTick\(\)/);
  assert.match(files.social, /private async runScheduledTick\(\)[\s\S]*await this\.tick\(\)/);
});

test('creator retention uses a scheduled cleanup wrapper', () => {
  assert.match(files.creators, /void this\.runScheduledCleanup\(\)/);
  assert.match(files.creators, /private async runScheduledCleanup\(\)[\s\S]*await this\.cleanup\(\)/);
});

test('notification schedulers route both bootstrap and interval execution through contained boundaries', () => {
  for (const source of [files.notifications, files.notificationResilience]) {
    assert.match(source, /setInterval\(\(\) => \{\s*void this\.runScheduledTick\(\);/);
    assert.match(source, /this\.timer\.unref\(\);\s*void this\.runScheduledTick\(\);/);
    assert.doesNotMatch(source, /this\.timer\.unref\(\);\s*void this\.tick\(\);/);
  }
});

test('new scheduler-boundary diagnostics do not serialize exception messages', () => {
  for (const source of Object.values(files)) {
    const marker = source.search(/private async runScheduled(?:Tick|Cleanup)\(\)/);
    assert.ok(marker >= 0);
    const boundary = source.slice(marker, marker + 600);
    assert.doesNotMatch(boundary, /error\.message|error\.stack|DATABASE_URL/);
    assert.match(boundary, /error\.name/);
  }
});
