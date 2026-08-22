import { expect, test, type Page } from '@playwright/test';

function collectPageFailures(page: Page) {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(`console: ${message.text()}`);
  });
  page.on('requestfailed', (request) => {
    failures.push(`requestfailed: ${request.method()} ${request.url()} (${request.failure()?.errorText ?? 'unknown'})`);
  });
  return failures;
}

const catalog = [
  {
    key: 'pulse-duel',
    version: 1,
    name: 'Pulse Duel',
    description: 'Fast social duel',
    minPlayers: 2,
    maxPlayers: 2,
    categories: ['instant', 'social'],
    modes: ['multiplayer'],
    estimatedMinutes: 3,
    guestEligible: false,
    authoritativeServer: true,
    replayAvailable: true,
    economicStakeAllowed: false
  },
  {
    key: 'affinity-mirror',
    version: 1,
    name: 'Affinity Mirror',
    description: 'Voluntary affinity game',
    minPlayers: 2,
    maxPlayers: 2,
    categories: ['social'],
    modes: ['multiplayer'],
    estimatedMinutes: 6,
    guestEligible: false,
    authoritativeServer: true,
    replayAvailable: true,
    economicStakeAllowed: false
  }
];

async function mockCatalog(page: Page) {
  await page.route('**/games/center**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(catalog) });
  });
}

test('Game Center provides value before account creation', async ({ page }) => {
  const failures = collectPageFailures(page);
  await mockCatalog(page);

  const response = await page.goto('/games/center');
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'Joue à ta façon' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pulse Duel' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Se connecter pour sauvegarder' })).toHaveAttribute('href', '/login');
  await expect(page.getByRole('link', { name: 'Créer un compte' })).toHaveAttribute('href', '/register');
  await expect(page.getByRole('button', { name: /favoris/i })).toHaveCount(0);

  await page.getByLabel('Rechercher un jeu').fill('affinity');
  await expect(page.getByRole('heading', { name: 'Affinity Mirror' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pulse Duel' })).toHaveCount(0);
  expect(failures).toEqual([]);
});

test('authenticated Game Center renders private library without leaking game internals', async ({ page }) => {
  const failures = collectPageFailures(page);
  await page.addInitScript(() => window.localStorage.setItem('knowme_token', 'game-center-browser-token'));
  await mockCatalog(page);
  await page.route('**/users/me**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'user-1', username: 'player', displayName: 'Player' }) });
  });
  await page.route('**/appearance**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ preference: { effectiveThemeKey: 'system' } }) });
  });
  await page.route('**/i18n/preferences**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ locale: 'fr', direction: 'ltr', source: 'user', version: 1, persisted: true, updatedAt: '2026-08-22T00:00:00.000Z' }) });
  });
  await page.route('**/games/library**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        favorites: [{ ...catalog[0], favoritedAt: '2026-08-22T19:00:00.000Z' }],
        continuePlaying: [{
          sessionId: 'session-safe',
          game: { key: 'pulse-duel', version: 1, name: 'Pulse Duel', description: 'Fast social duel' },
          status: 'ACTIVE',
          participantStatus: 'JOINED',
          yourTurn: true,
          updatedAt: '2026-08-22T19:00:00.000Z'
        }],
        invitations: [],
        recent: []
      })
    });
  });

  const response = await page.goto('/games/center');
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'Mes jeux' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Pulse Duel · À toi de jouer/ })).toHaveAttribute('href', '/games?session=session-safe');
  await expect(page.getByRole('button', { name: 'Retirer des favoris' })).toBeVisible();
  await expect(page.getByText(/seed|winnerUserId|ownerId|stateHash/)).toHaveCount(0);
  expect(failures).toEqual([]);
});
