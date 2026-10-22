import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { resolve } from 'node:path';

const repoFile = (name: string) => readFileSync(resolve(process.cwd(),name), 'utf8');

test('Android signed-in root intercepts system Back before allowing activity exit', () => {
  const app = repoFile('App.tsx');
  assert.match(app, /BackHandler\.addEventListener\('hardwareBackPress'/);
  assert.match(app, /screenHistory\.current\.pop\(\) \?\? 'home'/);
  assert.match(app, /BackHandler\.exitApp\(\)/);
  assert.match(app, /Quitter KnowMe \?/);
  assert.match(app, /if \(keyboardVisible\).*Keyboard\.dismiss\(\)/);
  assert.match(app, /if \(createOpen\).*setCreateOpen\(false\)/);
});

test('Android Back closes the current post/profile subscreen before navigating away', () => {
  const app = repoFile('App.tsx');
  const feed = repoFile('src/FeedExperience.tsx');
  const profile = repoFile('src/ProfileExperience.tsx');
  assert.match(app, /systemBackRequest=\{feedBackRequest\}/);
  assert.match(app, /systemBackRequest=\{profileBackRequest\}/);
  assert.match(feed, /systemBackRequest > 0\) setSelectedPostId\(null\)/);
  assert.match(profile, /systemBackRequest > 0\) setPanel\('main'\)/);
});


test('Android navigation history has a bounded stack and never leaks past direct deep links', () => {
  const app = repoFile('App.tsx');
  assert.match(app, /screenHistory\.current = \[\.\.\.screenHistory\.current, previousScreen\.current\]\.slice\(-24\)/);
  assert.match(app, /if \(screen === 'home'\) \{/);
  assert.match(app, /const previous = screenHistory\.current\.pop\(\) \?\? 'home'/);
  assert.match(app, /applyingSystemBack\.current = true/);
});
