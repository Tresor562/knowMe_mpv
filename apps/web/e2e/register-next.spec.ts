import { expect, test, type Page } from '@playwright/test';

async function fillRegistration(page: Page, suffix: string) {
  await page.getByPlaceholder('Nom affiché').fill(`New User ${suffix}`);
  await page.getByPlaceholder('Pseudo').fill(`new_user_${suffix}`);
  await page.getByPlaceholder('Email').fill(`new-user-${suffix}@knowme.test`);
  await page.getByPlaceholder('Mot de passe sécurisé').fill('StrongPass123!');
}

async function mockRegistration(page: Page) {
  await page.route('http://localhost:4000/auth/register', async (route) => {
    expect(route.request().method()).toBe('POST');
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'registered-access-token',
        refreshToken: 'registered-refresh-token'
      })
    });
  });
}

test('registration preserves a safe internal next route', async ({ page }) => {
  await mockRegistration(page);
  await page.route('http://localhost:4000/users/me', async (route) => {
    expect(route.request().headers()['authorization']).toBe('Bearer registered-access-token');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'registered-user',
        email: 'new-user-safe@knowme.test',
        username: 'new_user_safe',
        displayName: 'New User safe'
      })
    });
  });
  await page.route('http://localhost:4000/intelligence/recommendations', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([])
    });
  });

  await page.goto('/register?next=/discover');
  await fillRegistration(page, 'safe');
  await page.getByRole('button', { name: 'Commencer' }).click();

  await page.waitForURL('**/discover');
  await expect(page.getByRole('heading', { name: /Entre dans KnowMe/ })).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem('knowme_token'))).toBe(
    'registered-access-token'
  );
});

test('registration rejects protocol-relative next routes and falls back to dashboard', async ({ page }) => {
  await mockRegistration(page);
  await page.route('http://localhost:4000/users/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'registered-user',
        email: 'new-user-unsafe@knowme.test',
        username: 'new_user_unsafe',
        displayName: 'New User unsafe',
        knowCoins: 0
      })
    });
  });
  await page.route('http://localhost:4000/challenges', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.route('http://localhost:4000/notifications/unread-count', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"count":0}' });
  });
  await page.route('http://localhost:4000/conversations/unread-count', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"unread":0}' });
  });

  await page.goto('/register?next=%2F%2Fevil.example');
  await fillRegistration(page, 'unsafe');
  await page.getByRole('button', { name: 'Commencer' }).click();

  await page.waitForURL('**/dashboard');
  await expect(page.getByRole('heading', { name: /Salut New User unsafe/ })).toBeVisible();
  expect(page.url()).not.toContain('evil.example');
});
