import { expect, test, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

async function mockAccount(page: Page, options: {
  failInitialList?: boolean;
  failListAfterWithdrawal?: boolean;
} = {}) {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token', 'verification-ui-test');
    localStorage.setItem('knowme-locale', 'fr');
  });
  let withdrawn = false;
  let mutationCount = 0;
  let listCount = 0;
  await page.route('**/api/knowme/**', async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const method = req.method();
    let status = 200;
    let data: unknown = {};
    if (path.endsWith('/users/me')) {
      data = {
        id: 'owner-test', username: 'verifier', displayName: 'Créateur KnowMe',
        email: 'verification@example.test', verification: null, premium: null, staff: null
      };
    } else if (path.endsWith('/appearance')) {
      data = { preference: { effectiveThemeKey: 'system' }, themes: [] };
    } else if (path.endsWith('/i18n/preferences')) {
      data = { locale: 'fr', direction: 'ltr' };
    } else if (path.endsWith('/verification/me')) {
      listCount += 1;
      if (options.failInitialList || (withdrawn && options.failListAfterWithdrawal)) {
        status = 503;
        data = { code: 'VERIFICATION_UNAVAILABLE', message: 'Historique indisponible' };
      } else {
        data = [{
          id: 'req-1', submissionNumber: 1,
          status: withdrawn ? 'WITHDRAWN' : 'SUBMITTED',
          level: 'STANDARD', evidenceCount: 0,
          submittedAt: '2026-10-18T10:00:00Z',
          decisionVersion: 1, evidence: [], decisions: []
        }];
      }
    } else if (path.endsWith('/verification/requests/req-1/withdraw') && method === 'POST') {
      mutationCount += 1;
      withdrawn = true;
      data = { status: 'WITHDRAWN' };
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto('/verification');
  await expect(page.getByRole('heading', { name: 'Vérification autoritaire' })).toBeVisible();
  return { mutationCount: () => mutationCount, listCount: () => listCount };
}

test('successful withdrawal remains a success when subsequent history refresh fails', async ({ page }) => {
  const state = await mockAccount(page, { failListAfterWithdrawal: true });
  await page.getByRole('button', { name: 'Retirer la demande' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('#km-feedback-input').fill('Demande saisie en double');
  await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmer' }).click();
  await expect.poll(state.mutationCount).toBe(1);
  await expect(page.getByText(/Demande retirée. Actualisation temporairement indisponible/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retirer la demande' })).toBeDisabled();
  expect(state.mutationCount()).toBe(1);
});

test('failed initial history prevents accidental duplicate requests', async ({ page }) => {
  const state = await mockAccount(page, { failInitialList: true });
  await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Soumettre pour examen' })).toHaveCount(0);
  await expect(page.getByText(/Aucun nouvel envoi ne sera proposé/)).toBeVisible();
  expect(state.mutationCount()).toBe(0);
});
