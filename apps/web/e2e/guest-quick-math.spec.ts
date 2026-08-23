import { expect, test, type Page } from '@playwright/test';

const guestToken = `kg_${'A'.repeat(43)}`;

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

function sessionBody(sequence: number, round: number, completed = false) {
  return {
    id: 'guest-game-1',
    game: {
      key: 'quick-math',
      version: 1,
      name: 'Quick Math',
      description: 'Five server-authoritative questions',
      rules: { rounds: 5 }
    },
    status: completed ? 'COMPLETED' : 'ACTIVE',
    sequence,
    state: {
      engine: 'QUICK_MATH_V1',
      phase: completed ? 'COMPLETED' : sequence === 0 ? 'READY' : 'ACTIVE',
      round: completed ? 5 : round,
      maxRounds: 5,
      score: completed ? 5 : Math.max(0, sequence - 1),
      question: completed || sequence === 0 ? null : { left: 2, right: 2, operator: '+' },
      lastOutcome: sequence <= 1
        ? null
        : { round: Math.max(1, round - 1), submittedAnswer: 4, correctAnswer: 4, correct: true },
      completed
    },
    stateHash: `hash-${sequence}`,
    currentTurnPosition: completed ? null : 0,
    result: completed
      ? { outcome: 'COMPLETED', score: 5, correctAnswers: 5, rounds: 5 }
      : null,
    expiresAt: '2026-08-23T20:30:00.000Z',
    completedAt: completed ? '2026-08-23T20:05:00.000Z' : null,
    serverAuthoritative: true,
    economicStake: null,
    accountRequired: false
  };
}

function guestIdentityBody() {
  return {
    id: 'guest-1',
    publicAlias: null,
    locale: 'fr',
    consentVersion: '2026-08-22',
    ageGateState: 'ADULT',
    status: 'ACTIVE',
    createdAt: '2026-08-23T20:00:00.000Z',
    lastSeenAt: '2026-08-23T20:01:00.000Z',
    expiresAt: '2026-08-24T20:00:00.000Z'
  };
}

async function mockGuestCreationAndGame(page: Page) {
  const authorizationHeaders: string[] = [];
  let actionCount = 0;
  let revokeCount = 0;

  await page.route('http://localhost:4000/guest/sessions', async (route) => {
    expect(route.request().method()).toBe('POST');
    const body = route.request().postDataJSON() as Record<string, unknown>;
    expect(body).toEqual(expect.objectContaining({
      publicAlias: 'Browser Guest',
      ageGateState: 'ADULT',
      consentVersion: '2026-08-22'
    }));
    expect(body).not.toHaveProperty('email');
    expect(body).not.toHaveProperty('contacts');
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        token: guestToken,
        guest: { ...guestIdentityBody(), publicAlias: 'Browser Guest' }
      })
    });
  });

  await page.route('http://localhost:4000/guest/session', async (route) => {
    expect(route.request().method()).toBe('DELETE');
    expect(route.request().headers()['authorization']).toBe(`Bearer ${guestToken}`);
    revokeCount += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ revoked: true })
    });
  });

  await page.route('http://localhost:4000/guest/games/quick-math/sessions', async (route) => {
    authorizationHeaders.push(route.request().headers()['authorization'] ?? '');
    const body = route.request().postDataJSON() as Record<string, unknown>;
    expect(body.idempotencyKey).toMatch(/^web:quick-math:/);
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ ...sessionBody(0, 0), replayed: false })
    });
  });

  await page.route('http://localhost:4000/guest/games/sessions/guest-game-1/actions', async (route) => {
    authorizationHeaders.push(route.request().headers()['authorization'] ?? '');
    const body = route.request().postDataJSON() as {
      actionType: string;
      payload: Record<string, unknown>;
      expectedSequence: number;
      idempotencyKey: string;
    };
    actionCount += 1;
    expect(body.idempotencyKey).toMatch(/^web:quick-math:/);

    if (actionCount === 1) {
      expect(body).toEqual(expect.objectContaining({
        actionType: 'START',
        payload: {},
        expectedSequence: 0
      }));
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(sessionBody(1, 1))
      });
      return;
    }

    expect(body.actionType).toBe('ANSWER');
    expect(body.payload).toEqual({ answer: 4 });
    expect(body.expectedSequence).toBe(actionCount - 1);
    const completed = actionCount === 6;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(sessionBody(actionCount, Math.min(actionCount, 5), completed))
    });
  });

  await page.route('http://localhost:4000/guest/games/sessions/guest-game-1', async (route) => {
    authorizationHeaders.push(route.request().headers()['authorization'] ?? '');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessionBody(Math.max(1, actionCount), Math.max(1, Math.min(actionCount, 5)), actionCount >= 6))
    });
  });

  return {
    authorizationHeaders,
    getActionCount: () => actionCount,
    getRevokeCount: () => revokeCount
  };
}

test('Quick Math delivers value before account creation and can explicitly revoke the Guest identity', async ({ page }) => {
  const failures = collectPageFailures(page);
  const mocked = await mockGuestCreationAndGame(page);

  const response = await page.goto('/play/quick-math');
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'Quick Math' })).toBeVisible();
  await expect(page.getByText(/Aucun compte n’est nécessaire/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Jouer sans compte' })).toBeVisible();

  await page.getByLabel(/Pseudo temporaire/).fill('Browser Guest');
  await page.getByLabel('Catégorie d’âge').selectOption('ADULT');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Jouer sans compte' }).click();

  await expect(page.getByRole('button', { name: 'Commencer les 5 questions' })).toBeVisible();
  await page.getByRole('button', { name: 'Commencer les 5 questions' }).click();
  await expect(page.getByLabel('Calcul actuel')).toContainText('2 + 2 = ?');

  for (let round = 1; round <= 5; round += 1) {
    await page.getByLabel('Ta réponse').fill('4');
    await page.getByRole('button', { name: 'Valider' }).click();
    if (round < 5) {
      await expect(page.getByText(`Question ${round + 1}/5`)).toBeVisible();
    }
  }

  await expect(page.getByText('PARTIE TERMINÉE')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Score : 5/5' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Créer un compte' })).toHaveAttribute('href', '/register');

  await page.getByRole('button', { name: 'Terminer et effacer la session invitée' }).click();
  await expect(page.getByRole('status')).toContainText('Session invitée terminée');
  await expect(page.getByLabel(/Pseudo temporaire/)).toBeVisible();
  const stored = await page.evaluate(() => ({
    guest: window.localStorage.getItem('knowme_guest_token'),
    game: window.localStorage.getItem('knowme_guest_quick_math_session')
  }));
  expect(stored).toEqual({ guest: null, game: null });
  expect(mocked.getRevokeCount()).toBe(1);
  expect(mocked.getActionCount()).toBe(6);
  expect(mocked.authorizationHeaders.length).toBeGreaterThan(0);
  expect(mocked.authorizationHeaders.every((value) => value === `Bearer ${guestToken}`)).toBe(true);
  expect(failures).toEqual([]);
});

test('Quick Math resumes a valid temporary Guest session after a browser refresh', async ({ page }) => {
  const failures = collectPageFailures(page);
  await page.addInitScript(({ token }) => {
    window.localStorage.setItem('knowme_guest_token', token);
    window.localStorage.setItem('knowme_guest_quick_math_session', 'guest-game-1');
  }, { token: guestToken });

  await page.route('http://localhost:4000/guest/session', async (route) => {
    expect(route.request().headers()['authorization']).toBe(`Bearer ${guestToken}`);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(guestIdentityBody())
    });
  });
  await page.route('http://localhost:4000/guest/games/sessions/guest-game-1', async (route) => {
    expect(route.request().headers()['authorization']).toBe(`Bearer ${guestToken}`);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessionBody(3, 3))
    });
  });

  const response = await page.goto('/play/quick-math');
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByText('Question 3/5')).toBeVisible();
  await expect(page.getByLabel('Calcul actuel')).toContainText('2 + 2 = ?');
  await expect(page.getByLabel(/Pseudo temporaire/)).toHaveCount(0);
  expect(failures).toEqual([]);
});

test('a transient revocation failure keeps the Guest credential so the user can retry', async ({ page }) => {
  await page.addInitScript(({ token }) => {
    window.localStorage.setItem('knowme_guest_token', token);
  }, { token: guestToken });

  await page.route('http://localhost:4000/guest/session', async (route) => {
    expect(route.request().headers()['authorization']).toBe(`Bearer ${guestToken}`);
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(guestIdentityBody())
      });
      return;
    }

    expect(route.request().method()).toBe('DELETE');
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Revocation temporarily unavailable' })
    });
  });

  const response = await page.goto('/play/quick-math');
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByText('Session invitée active sur cet appareil.')).toBeVisible();
  await page.getByRole('button', { name: 'Terminer et effacer la session invitée' }).click();
  await expect(page.getByRole('status')).toContainText('Revocation temporarily unavailable');
  expect(await page.evaluate(() => window.localStorage.getItem('knowme_guest_token'))).toBe(guestToken);
  await expect(page.getByText('Session invitée active sur cet appareil.')).toBeVisible();
});
