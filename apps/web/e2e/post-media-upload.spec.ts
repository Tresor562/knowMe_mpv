import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('create a media-only post with two attachments in the selected order', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token', 'test-session');
    localStorage.setItem('knowme-locale', 'fr');
  });
  let sessions = 0;
  let completed = 0;
  let published: unknown = null;

  await page.route('**/api/knowme/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let result: unknown = {};
    if (request.method() === 'POST' && path.endsWith('/media/uploads')) {
      sessions += 1;
      result = { id: 'session' + sessions, uploadToken: 'test-token' };
    } else if (request.method() === 'POST' && path.endsWith('/complete')) {
      completed += 1;
      result = { id: 'asset' + completed, status: 'AVAILABLE' };
    } else if (request.method() === 'POST' && path.endsWith('/posts')) {
      published = request.postDataJSON();
      result = { id: 'new-post' };
    } else if (path.endsWith('/users/me')) {
      result = { id: 'me', username: 'me', displayName: 'Me' };
    } else if (path.endsWith('/posts/feed')) {
      result = [];
    } else if (path.endsWith('/stories/rail')) {
      result = { groups: [], nextOffset: null };
    } else if (path.endsWith('/media/public/post-capabilities')) {
      result = { publicPostImage: true };
    } else if (path.endsWith('/appearance')) {
      result = { preference: { effectiveThemeKey: 'system' }, themes: [] };
    } else if (path.endsWith('/i18n/preferences')) {
      result = { locale: 'fr', direction: 'ltr' };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
  });
  await page.goto('/feed');
  await page.getByRole('button', { name: 'Ouvrir l’éditeur' }).click();
  const editor = page.getByRole('dialog', { name: 'Créer une publication' });
  await editor.locator('input[type=file]').setInputFiles([
    { name: 'first.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('a'.repeat(2048)) },
    { name: 'second.png', mimeType: 'image/png', buffer: Buffer.from('b'.repeat(2048)) }
  ]);
  await expect(editor.getByLabel('Médias sélectionnés')).toContainText('Pièces jointes (2)');
  await editor.getByRole('button', { name: 'Publier' }).first().click();
  await expect(editor).not.toBeVisible();
  expect(sessions).toBe(2);
  expect(completed).toBe(2);
  expect(published).toEqual({ content: '', mediaAssetIds: ['asset1', 'asset2'] });
});
