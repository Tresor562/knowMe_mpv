import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

function source(pathname: string) {
  return readFileSync(decodeURIComponent(new URL(pathname, import.meta.url).pathname), 'utf8');
}

// Test the production route policy through the actual Next page on a deep link.
// Keep this suite independent of JSX imports: Playwright's Node ESM runtime
// must not require() a Next/React TSX module during test collection.
test('secondary route navigation fallback has a safe in-app landing destination', () => {
  const model = source('../components/secondary-page-back-model.ts');
  const back = source('../components/secondary-page-back.tsx');
  expect(model).toContain("'/feed'");
  expect(model).toContain("'/messages'");
  expect(model).toContain("'/profile'");
  expect(model).toContain('!pathname.startsWith(\'//\')');
  expect(back).toContain("router.push('/feed')");
  expect(back).toContain('data-knowme-fallback-back');
  expect(back).toContain('localBackExists');
});

test('Web and Android share icons use exactly the same approved filled geometry', () => {
  const web = source('../components/KnowMeShareIcon.tsx');
  const native = source('../../mobile/src/ui/KnowMeShareIcon.tsx');
  const svg = source('../components/knowme-glyph.tsx');
  const webPath = web.match(/KNOWME_SHARE_PATH = '([^']+)'/)?.[1];
  const nativePath = native.match(/SHARE_PATH = '([^']+)'/)?.[1];
  expect(webPath).toBeTruthy();
  expect(nativePath).toBe(webPath);
  expect(svg).toContain(`d="${webPath}"`);
  expect(web).toContain('fill="currentColor"');
  expect(native).toContain('fill={color}');
});
