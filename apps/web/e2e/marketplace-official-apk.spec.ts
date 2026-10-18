import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

async function setup(page: import('@playwright/test').Page, release: unknown) {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token', 'apks-e2e');
    localStorage.setItem('knowme-locale', 'fr');
  });
  await page.route('**/api/knowme/**', async route => {
    const url = new URL(route.request().url()).pathname;
    let body: unknown = {};
    if (url.endsWith('/users/me')) body = { id: 'buyer', email: 'buyer@example.test', username: 'buyer', displayName: 'Acheteur' };
    else if (url.endsWith('/appearance')) body = { preference: { effectiveThemeKey: 'system' }, themes: [] };
    else if (url.endsWith('/i18n/preferences')) body = { locale: 'fr', direction: 'ltr' };
    else if (url.endsWith('/mobile-updates/android')) body = { release };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/marketplace/apks');
  await expect(page.getByRole('heading', { name: 'Applications et APK' })).toBeVisible();
}

test('shows a server-announced official APK with exact checksum', async ({ page }) => {
  const version = '1.1.8';
  const url = 'https://github.com/Tresor562/knowMe_mpv/releases/download/v1.1.8-preview/KnowMe-1.1.8-preview.apk';
  const sha256 = 'a'.repeat(64);
  await setup(page, { version, versionCode: 11, url, sha256, notes: 'Améliorations', required: false });
  await expect(page.getByText('1.1.8')).toBeVisible();
  await expect(page.getByText(sha256)).toBeVisible();
  await expect(page.getByRole('link', { name: /Ouvrir le téléchargement officiel KnowMe/ })).toHaveAttribute('href', url);
});

test('never displays an APK download when metadata is missing or unsafe', async ({ page }) => {
  await setup(page, { version: '1.1.8', versionCode: 11, url: 'javascript:alert(1)', sha256: 'a'.repeat(64) });
  await expect(page.getByText('Aucune APK vérifiée n’est publiée pour le moment.')).toBeVisible();
  await expect(page.getByRole('link', { name: /Ouvrir le téléchargement officiel KnowMe/ })).toHaveCount(0);
});
