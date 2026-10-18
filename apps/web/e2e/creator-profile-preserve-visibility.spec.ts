import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const initial = {
  slug: 'creator-demo',
  title: 'Mon atelier',
  bio: 'Des œuvres originales',
  category: 'ART',
  visibility: 'UNLISTED',
  status: 'ACTIVE',
  followerCount: 21,
  version: 3
};

async function setup(page: import('@playwright/test').Page, {
  failDashboardAfterSave = false, failSaveWithConflict = false
} = {}) {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token', 'creator-web-test');
    localStorage.setItem('knowme-locale', 'fr');
  });
  let server = { ...initial };
  const payloads: Array<Record<string, unknown>> = [];
  await page.route('**/api/knowme/**', async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    let status = 200;
    let data: unknown = {};
    if (path.endsWith('/users/me')) {
      data = { id: 'creator-owner', username: 'creatorowner',
        email: 'creator@example.test', displayName: 'Créateur' };
    } else if (path.endsWith('/appearance')) {
      data = { preference: { effectiveThemeKey: 'system' }, themes: [] };
    } else if (path.endsWith('/i18n/preferences')) {
      data = { locale: 'fr', direction: 'ltr', persisted: true, version: 1 };
    } else if (path.endsWith('/creators/me/dashboard')) {
      if (failDashboardAfterSave && payloads.length) {
        status = 503; data = { code: 'METRICS_UNAVAILABLE', message: 'Unavailable' };
      } else {
        data = {
          profile: server,
          windowDays: 30,
          totals: { followers: 21, posts: 7, likes: 9, comments: 2, profileViews: 80,
            postViews: 60, followsGained: 3, unfollows: 1 },
          privacy: { uniqueAuthenticatedViewsOnly: true,
            rawViewerIdsStored: false, receiptRetentionDays: 7 }
        };
      }
    } else if (path.endsWith('/creators/me') && req.method() === 'PUT') {
      const body = req.postDataJSON() as Record<string, unknown>;
      payloads.push(body);
      if (failSaveWithConflict) {
        status = 409;
        data = { code: 'CREATOR_VERSION_CONFLICT', message: 'Version en conflit' };
      } else {
        server = { ...server, ...body, version: server.version + 1 } as typeof server;
        data = server;
      }
    } else if (path.endsWith('/creators/me')) {
      data = server;
    }
    await route.fulfill({ status, contentType: 'application/json',
      body: JSON.stringify(data) });
  });
  await page.goto('/settings/creator');
  await expect(page.getByRole('heading', { name: 'Mon espace créateur' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Non répertorié' })).toHaveAttribute('aria-pressed', 'true');
  return payloads;
}

test('updating an unlisted creator page keeps UNLISTED and survives analytics outage', async ({ page }) => {
  const payloads = await setup(page, { failDashboardAfterSave: true });
  await page.getByRole('textbox', { name: 'Nom de la page' }).fill('Atelier actualisé');
  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  await expect.poll(() => payloads.length).toBe(1);
  expect(payloads[0].visibility).toBe('UNLISTED');
  expect(payloads[0].expectedVersion).toBe(3);
  await expect(page.getByText(/Profil enregistré. Les statistiques/i)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Nom de la page' })).toHaveValue('Atelier actualisé');
});

test('version conflict keeps unsaved edits instead of silently reloading the creator', async ({ page }) => {
  const payloads = await setup(page, { failSaveWithConflict: true });
  const title = page.getByRole('textbox', { name: 'Nom de la page' });
  await title.fill('Mon brouillon précieux');
  await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  await expect.poll(() => payloads.length).toBe(1);
  await expect(title).toHaveValue('Mon brouillon précieux');
  await expect(page.getByRole('button', { name: 'Recharger la version serveur' })).toBeVisible();
  // The old behavior silently refetched the stale server title after HTTP 409.
  expect(payloads[0].visibility).toBe('UNLISTED');
});
