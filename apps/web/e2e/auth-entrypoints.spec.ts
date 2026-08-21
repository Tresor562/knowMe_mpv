import { expect, test, type Page } from '@playwright/test';

function collectPageFailures(page: Page) {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') failures.push(`console: ${message.text()}`);
  });
  return failures;
}

test('login renders as a usable public entrypoint without browser errors', async ({ page }) => {
  const failures = collectPageFailures(page);

  const response = await page.goto('/login');
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  await expect(page.getByPlaceholder('Email ou pseudo')).toBeEditable();
  await expect(page.getByPlaceholder('Mot de passe')).toBeEditable();
  await expect(page.getByRole('button', { name: 'Entrer dans KnowMe' })).toBeEnabled();
  await expect(page.getByRole('link', { name: 'Créer mon profil' })).toHaveAttribute('href', '/register');
  expect(failures).toEqual([]);
});

test('registration renders as a usable public entrypoint and links back to login', async ({ page }) => {
  const failures = collectPageFailures(page);

  const response = await page.goto('/register');
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'Créer ton profil' })).toBeVisible();
  await expect(page.getByPlaceholder('Nom affiché')).toBeEditable();
  await expect(page.getByPlaceholder('Pseudo')).toBeEditable();
  await expect(page.getByPlaceholder('Email')).toBeEditable();
  await expect(page.getByPlaceholder('Mot de passe sécurisé')).toBeEditable();
  await expect(page.getByRole('button', { name: 'Commencer' })).toBeEnabled();

  await page.getByRole('link', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  expect(failures).toEqual([]);
});
