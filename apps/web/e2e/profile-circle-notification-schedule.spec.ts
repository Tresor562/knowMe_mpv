import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const preference = {
  enabled: true,
  invitationsEnabled: true,
  membershipEnabled: true,
  governanceEnabled: true,
  contentEnabled: true,
  familyEnabled: true,
  realtimeEnabled: true,
  mutedCircleIds: ['circle-1'],
  quietHoursEnabled: true,
  quietStartMinute: 22 * 60,
  quietEndMinute: 7 * 60,
  timezone: 'Africa/Porto-Novo',
  digestMode: 'DAILY',
  digestMinuteOfDay: 8 * 60
};

async function mockSession(
  page: import('@playwright/test').Page,
  options: { failPreferences?: boolean; failCircles?: boolean } = {}
) {
  const submitted: Array<Record<string, unknown>> = [];
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token', 'circle-notifications-test');
    localStorage.setItem('knowme-locale', 'fr');
  });
  await page.route('**/api/knowme/**', async route => {
    const req = route.request();
    const pathname = new URL(req.url()).pathname;
    let status = 200;
    let body: unknown = {};
    if (pathname.endsWith('/users/me')) {
      body = { id: 'owner-test', username: 'owner', displayName: 'Owner' };
    } else if (pathname.endsWith('/i18n/preferences')) {
      body = { locale: 'fr', direction: 'ltr', persisted: true, version: 1 };
    } else if (pathname.endsWith('/appearance')) {
      body = { preference: { effectiveThemeKey: 'system' }, themes: [] };
    } else if (pathname.endsWith('/profile-circles/me')) {
      if (options.failCircles) {
        status = 503;
        body = { message: 'Circles unavailable' };
      } else {
        body = [{ circle: { id: 'circle-1', name: 'Notre famille', type: 'FAMILY', status: 'ACTIVE' },
          membership: { role: 'MEMBER', status: 'ACTIVE' } }];
      }
    } else if (pathname.endsWith('/profile-circle-notification-preferences/me')) {
      if (options.failPreferences && req.method() === 'GET') {
        status = 503;
        body = { message: 'Preferences unavailable' };
      } else if (req.method() === 'PUT') {
        const next = req.postDataJSON() as Record<string, unknown>;
        submitted.push(next);
        body = next;
      } else {
        body = preference;
      }
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return submitted;
}

test('an ordinary toggle submits all required API schedule fields without resetting quiet hours', async ({ page }) => {
  const submitted = await mockSession(page, { failCircles: true });
  await page.goto('/settings/profile-circle-notifications');
  await expect(page.getByRole('heading', { name: 'Notifications des relations' })).toBeVisible();
  await expect(page.getByText(/Liste des relations indisponible/i)).toBeVisible();
  await page.getByRole('checkbox').first().uncheck();
  await page.getByRole('button', { name: 'Enregistrer les préférences' }).click();
  await expect.poll(() => submitted.length).toBe(1);
  expect(submitted[0].enabled).toBe(false);
  expect(submitted[0].quietHoursEnabled).toBe(true);
  expect(submitted[0].quietStartMinute).toBe(1320);
  expect(submitted[0].quietEndMinute).toBe(420);
  expect(submitted[0].timezone).toBe('Africa/Porto-Novo');
  expect(submitted[0].digestMode).toBe('DAILY');
  expect(submitted[0].digestMinuteOfDay).toBe(480);
  expect(submitted[0].mutedCircleIds).toEqual(['circle-1']);
  await expect(page.getByText('Préférences enregistrées.')).toBeVisible();
});

test('failed preference GET never exposes a save button that could overwrite existing settings', async ({ page }) => {
  const submitted = await mockSession(page, { failPreferences: true });
  await page.goto('/settings/profile-circle-notifications');
  await expect(page.getByText(/Aucun réglage par défaut ne sera enregistré/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enregistrer les préférences' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible();
  expect(submitted).toHaveLength(0);
});
