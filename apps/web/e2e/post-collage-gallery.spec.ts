import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('a seven-photo post opens a five-tile collage and lets viewers navigate all seven files', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token', 'test-session');
    localStorage.setItem('knowme-locale', 'fr');
  });
  await page.route('**/api/knowme/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let response: unknown = {};
    if (path.endsWith('/users/me')) response = { id: 'viewer', username: 'viewer', displayName: 'Viewer' };
    if (path.endsWith('/posts/feed')) response = [{
      id: 'post7', content: 'Seven photos', createdAt: '2026-10-18T08:00:00.000Z',
      author: { id: 'friend', username: 'friend', displayName: 'Friend' },
      _count: { likes: 1, comments: 0 },
      media: Array.from({ length: 7 }, (_, i) => ({
        url: '/media/public/post/asset' + i, mimeType: 'image/jpeg', position: i
      }))
    }];
    if (path.endsWith('/stories/rail')) response = { groups: [], nextOffset: null };
    if (path.endsWith('/media/public/post-capabilities')) response = { publicPostImage: true };
    if (path.endsWith('/appearance')) response = { preference: { effectiveThemeKey: 'system' }, themes: [] };
    if (path.endsWith('/i18n/preferences')) response = { locale: 'fr', direction: 'ltr' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) });
  });
  await page.goto('/feed');
  const collage = page.locator('.km-post-collage');
  await expect(collage).toBeVisible();
  await expect(collage.locator('button')).toHaveCount(5);
  await expect(collage.getByText('+2')).toBeVisible();
  await collage.getByRole('button', { name: 'Ouvrir le média 5 sur 7' }).click();
  const viewer = page.getByRole('dialog', { name: 'Galerie de la publication' });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByText('5 / 7')).toBeVisible();
  await viewer.getByRole('button', { name: 'Média suivant' }).click();
  await expect(viewer.getByText('6 / 7')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(viewer).not.toBeVisible();
});
