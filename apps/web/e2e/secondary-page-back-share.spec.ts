import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { isSecondaryKnowMeRoute } from '../components/secondary-page-back-model';
import { KNOWME_SHARE_PATH } from '../components/KnowMeShareIcon';

test('secondary routes are reachable without a previous browser history entry', () => {
  for (const pathname of ['/feed/post-123', '/stories/story-123', '/marketplace/history', '/reels']) {
    expect(isSecondaryKnowMeRoute(pathname)).toBe(true);
  }
  for (const pathname of ['/', '/feed', '/messages', '/profile', '/login', '/register', '/privacy', '/reset-password/token']) {
    expect(isSecondaryKnowMeRoute(pathname)).toBe(false);
  }
  expect(isSecondaryKnowMeRoute('//outside.example/')).toBe(false);
});

test('Web and native share icons use the exact approved filled arrow', () => {
  const nativeSource = readFileSync(decodeURIComponent(new URL('../../mobile/src/ui/KnowMeShareIcon.tsx', import.meta.url).pathname), 'utf8');
  expect(nativeSource).toContain(KNOWME_SHARE_PATH);
  const webSource = readFileSync(decodeURIComponent(new URL('../components/KnowMeShareIcon.tsx', import.meta.url).pathname), 'utf8');
  expect(webSource).toContain('fill="currentColor"');
  expect(webSource).toContain(KNOWME_SHARE_PATH);
});
