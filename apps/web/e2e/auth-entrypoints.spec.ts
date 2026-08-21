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
  await expect(page.getByRole('link', { name: 'Mot de passe oublié ?' })).toHaveAttribute('href', '/forgot-password');
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

test('password recovery request is a usable privacy-safe public entrypoint', async ({ page }) => {
  const failures = collectPageFailures(page);

  const response = await page.goto('/forgot-password');
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'Mot de passe oublié' })).toBeVisible();
  await expect(page.getByPlaceholder('Adresse e-mail')).toBeEditable();
  await expect(page.getByRole('button', { name: 'Recevoir un lien de récupération' })).toBeEnabled();
  await expect(page.getByText(/la réponse sera la même qu’un compte existe ou non/i)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Retour à la connexion' })).toHaveAttribute('href', '/login');
  expect(failures).toEqual([]);
});

test('password reset link requires a token and renders the new-password controls when present', async ({ page }) => {
  const failures = collectPageFailures(page);

  let response = await page.goto('/reset-password');
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'Lien de récupération invalide' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Demander un nouveau lien' })).toHaveAttribute('href', '/forgot-password');

  response = await page.goto('/reset-password?token=test-recovery-token-value');
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'Nouveau mot de passe' })).toBeVisible();
  await expect(page.getByPlaceholder('Nouveau mot de passe')).toBeEditable();
  await expect(page.getByPlaceholder('Confirme le mot de passe')).toBeEditable();
  await expect(page.getByRole('button', { name: 'Réinitialiser le mot de passe' })).toBeEnabled();
  expect(failures).toEqual([]);
});
