import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dockerfiles = ['Dockerfile.api', 'Dockerfile.web'];

for (const path of dockerfiles) {
  test(`${path} enforces the canonical pnpm lockfile`, async () => {
    const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');

    assert.match(source, /COPY package\.json pnpm-lock\.yaml pnpm-workspace\.yaml turbo\.json \.\//);
    assert.match(source, /COPY packages packages/);
    assert.match(source, /pnpm install .*--frozen-lockfile(?:\s|$)/);
    assert.doesNotMatch(source, /--frozen-lockfile=false/);
  });
}
