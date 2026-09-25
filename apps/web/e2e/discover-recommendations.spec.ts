import { expect, test, type Page } from '@playwright/test';

function collectPageFailures(page: Page) {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(`console: ${message.text()}`);
  });
  page.on('requestfailed', (request) => {
    failures.push(
      `requestfailed: ${request.method()} ${request.url()} (${request.failure()?.errorText ?? 'unknown'})`
    );
  });
  return failures;
}

test('authenticated Discover uses real recommendation data and exposes the four roadmap entries', async ({ page }) => {
  const failures = collectPageFailures(page);

  await page.addInitScript(() => {
    window.localStorage.setItem('knowme_token', 'discover-test-token');
  });

  await page.route('http://localhost:4000/users/me', async (route) => {
    expect(route.request().headers()['authorization']).toBe('Bearer discover-test-token');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'viewer-1',
        email: 'viewer@knowme.test',
        username: 'viewer',
        displayName: 'Viewer'
      })
    });
  });

  await page.route('http://localhost:4000/intelligence/recommendations', async (route) => {
    expect(route.request().headers()['authorization']).toBe('Bearer discover-test-token');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          user: {
            id: 'user-aya',
            username: 'aya',
            displayName: 'Aya',
            avatarUrl: null,
            bio: 'Anime, design et voyages.'
          },
          commonInterests: ['anime', 'design'],
          scoreHint: 69
        },
        {
          user: {
            id: 'user-noe',
            username: 'noe',
            displayName: 'Noé',
            avatarUrl: null,
            bio: null
          },
          commonInterests: [],
          scoreHint: 45
        }
      ])
    });
  });

  await page.goto('/discover');

  await expect(page.getByText('PLAY', { exact: true })).toBeVisible();
  await expect(page.getByText('DISCOVER', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('CONNECT', { exact: true })).toBeVisible();
  await expect(page.getByText('CREATE', { exact: true })).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Aya' })).toBeVisible();
  await expect(page.getByText('@aya')).toBeVisible();
  await expect(page.getByText('69%')).toBeVisible();
  await expect(page.getByText('anime', { exact: true })).toBeVisible();
  await expect(page.getByText('design', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Voir le profil' }).first()).toHaveAttribute(
    'href',
    '/profile/aya'
  );

  await expect(page.getByRole('heading', { name: 'Noé' })).toBeVisible();
  await expect(page.getByText('Découverte basée sur les signaux disponibles')).toBeVisible();

  await expect(page.getByText('Léa')).toHaveCount(0);
  await expect(page.getByText('Marc')).toHaveCount(0);
  await expect(page.getByText('Aïcha')).toHaveCount(0);
  expect(failures).toEqual([]);
});

test('guest Discover keeps immediate PLAY value without requesting personal recommendations', async ({ page }) => {
  const failures = collectPageFailures(page);
  let recommendationRequests = 0;

  await page.route('http://localhost:4000/intelligence/recommendations', async (route) => {
    recommendationRequests += 1;
    await route.abort();
  });

  await page.goto('/discover');

  await expect(page.getByRole('link', { name: 'Jouer maintenant' })).toHaveAttribute(
    'href',
    '/play/quick-math'
  );
  await expect(page.getByRole('heading', { name: 'La découverte personnalisée reste optionnelle' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Continuer sans compte' })).toHaveAttribute(
    'href',
    '/play/quick-math'
  );
  await expect(page.getByRole('link', { name: 'Personnaliser mes découvertes' })).toHaveAttribute(
    'href',
    '/login'
  );

  expect(recommendationRequests).toBe(0);
  expect(failures).toEqual([]);
});
