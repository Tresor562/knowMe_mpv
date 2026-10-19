import { test, expect } from '@playwright/test';

test('design laboratory exposes 79 original icons, supports semantic states and filtering', async ({ page }) => {
  await page.goto('/design/iconography');
  await expect(page.getByRole('heading', { name: /Laboratoire des pictogrammes|Iconography laboratory/ }))
    .toBeVisible();
  await expect(page.locator('[data-glyph]')).toHaveCount(79);
  await expect(page.getByRole('note')).toContainText('simulés localement');
  await page.getByRole('button', { name: 'heart', exact: true }).click();
  await page.getByRole('group', { name: 'État de l’icône prévisualisée' })
    .getByRole('button', { name: 'selected' }).click();
  await expect(page.getByTestId('icon-lab-preview').locator('.km-state-icon'))
    .toHaveAttribute('data-icon-state', 'selected');
  await expect(page.getByTestId('icon-lab-preview').locator('[data-knowme-icon="heart"]'))
    .toBeVisible();
  await page.getByLabel('Rechercher une icône').fill('fullscreen');
  await expect(page.locator('[data-glyph]')).toHaveCount(2);
  await page.getByLabel('Rechercher une icône').clear();
  await page.getByRole('group', { name: 'Catégorie', exact: true }).getByRole('button', { name: 'Multimédia' }).click();
  await expect(page.locator('[data-glyph]')).not.toHaveCount(79);
  await expect(page.locator('[data-glyph="play"]')).toBeVisible();
  await expect(page.locator('[data-glyph="heart"]')).toHaveCount(0);
});

test('three real-vector gifts visibly open without making a purchase', async ({ page }) => {
  await page.goto('/design/iconography');
  const gifts = page.locator('.km-icon-lab-gift');
  await expect(gifts).toHaveCount(3);
  for (const name of ['aurora', 'cosmos', 'blossom']) {
    const gift = gifts.filter({ has: page.getByRole('heading', { name, exact: true }) });
    const art = gift.locator('.km-collectible');
    await expect(art).toHaveAttribute('data-state', 'idle');
    await gift.getByRole('button', { name: 'Ouvert' }).click();
    await expect(art).toHaveAttribute('data-state', 'opened');
    await gift.getByRole('button', { name: 'Acquis' }).click();
    await expect(art).toHaveAttribute('data-state', 'claimed');
    await expect(gift.locator('svg[role="img"]')).toBeVisible();
  }
  await expect(page.getByText('Aucun achat, message ou événement serveur n’est déclenché.'))
    .toBeVisible();
});

test('reduced motion and 44px touch surfaces hold on compact mobile', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/design/iconography');
  const button = page.locator('[data-glyph="heart"]');
  const dimensions = await button.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  expect(dimensions.width).toBeGreaterThanOrEqual(44);
  expect(dimensions.height).toBeGreaterThanOrEqual(44);
  await page.getByRole('button', { name: 'Rejouer le mouvement' }).click();
  await expect(page.getByTestId('icon-lab-preview').locator('.km-state-icon'))
    .toHaveAttribute('data-icon-state', 'idle');
  const animation = await page.getByTestId('icon-lab-preview')
    .locator('.km-state-icon > svg').evaluate(svg => getComputedStyle(svg).animationName);
  expect(animation).toBe('none');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});

test('brand comparison presents both logos without replacing the official asset', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/design/iconography');
  const section = page.getByRole('region', { name: /Comparaison du logo/ });
  await expect(section.getByRole('img', { name: /Logo actuel de KnowMe/ })).toBeVisible();
  await expect(section.getByRole('img', { name: /Prototype vectoriel du logo KnowMe/ })).toBeVisible();
  await expect(section.getByText('Le prototype ne remplace pas le logo officiel.')).toBeVisible();
  await expect(section.locator('img[src="/brand/knowme-logo.svg"]')).toHaveCount(1);
  await expect(section.locator('img[src="/brand/knowme-logo-vector-prototype.svg"]')).toHaveCount(1);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  expect(overflow).toBe(false);
});
