import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const cases = [
  ['Dockerfile.api', 'http://127.0.0.1:4000/health/live'],
  ['Dockerfile.web', 'http://127.0.0.1:3000/health/live']
];

test('runtime containers declare bounded liveness healthchecks', async () => {
  for (const [path, endpoint] of cases) {
    const dockerfile = await readFile(path, 'utf8');
    assert.match(dockerfile, /HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e /);
    assert.ok(dockerfile.includes(endpoint), `${path} must probe ${endpoint}`);
    assert.doesNotMatch(dockerfile, /HEALTHCHECK NONE/);
  }
});

test('Web liveness route is public, dynamic and non-cacheable', async () => {
  const route = await readFile('apps/web/app/health/live/route.ts', 'utf8');
  assert.match(route, /export const dynamic = 'force-dynamic'/);
  assert.match(route, /status: 'ok'/);
  assert.match(route, /service: 'knowme-web'/);
  assert.match(route, /'Cache-Control': 'no-store'/);
});
