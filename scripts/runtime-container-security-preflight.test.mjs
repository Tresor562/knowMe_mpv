import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dockerfiles = ['Dockerfile.api', 'Dockerfile.web'];

for (const dockerfile of dockerfiles) {
  test(`${dockerfile} declares a production non-root runtime`, async () => {
    const source = await readFile(new URL(`../${dockerfile}`, import.meta.url), 'utf8');

    assert.match(source, /^ENV NODE_ENV=production$/m);
    assert.match(source, /^USER node$/m);
    assert.doesNotMatch(source, /^USER root$/m);

    const userIndex = source.lastIndexOf('USER node');
    const cmdIndex = source.lastIndexOf('CMD [');
    assert.ok(userIndex > -1 && cmdIndex > userIndex, 'USER node must apply to the final runtime command');
  });
}
