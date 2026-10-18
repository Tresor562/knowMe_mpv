import { expect, test, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

async function setup(page: Page, reportStatus = 201) {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token', 'post-report-e2e-token');
    localStorage.setItem('knowme-locale', 'fr');
  });
  const mine = { id: 'owner', username: 'owner', displayName: 'Moi' };
  const other = { id: 'friend', username: 'friend', displayName: 'Une amie' };
  const reports: Array<Record<string, unknown>> = [];

  await page.route('**/api/knowme/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/reports') && request.method() === 'POST') {
      reports.push(request.postDataJSON() as Record<string, unknown>);
      await route.fulfill({
        status: reportStatus, contentType: 'application/json',
        body: JSON.stringify(reportStatus === 201
          ? { id: 'r-1', targetType: 'POST', status: 'OPEN' }
          : { message: 'Réessaie plus tard' })
      });
      return;
    }
    let body: unknown = {};
    if (path.endsWith('/users/me')) body = mine;
    else if (path.endsWith('/posts/feed')) body = [
      { id: 'own-post', content: 'Mon article', createdAt: '2026-10-18T10:00:00Z',
        author: mine, _count: { likes: 0, comments: 0 } },
      { id: 'friend-post', content: 'Publication de mon amie', createdAt: '2026-10-18T10:01:00Z',
        author: other, _count: { likes: 0, comments: 0 } }
    ];
    else if (path.endsWith('/stories/rail')) body = { groups: [], nextOffset: null };
    else if (path.endsWith('/media/public/post-capabilities')) body = { publicPostImage: false };
    else if (path.endsWith('/appearance')) body = { preference: { effectiveThemeKey: 'system' }, themes: [] };
    else if (path.endsWith('/i18n/preferences')) body = { locale: 'fr', direction: 'ltr' };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/feed');
  return { reports };
}

test('foreign publication can be reported with a reason; own publication cannot', async ({ page }) => {
  const { reports } = await setup(page);
  const mine = page.locator('article.km-feed-post').filter({ hasText: 'Mon article' });
  const foreign = page.locator('article.km-feed-post').filter({ hasText: 'Publication de mon amie' });
  await mine.getByRole('button', { name: 'Options de la publication' }).click();
  await expect(page.getByRole('button', { name: 'Signaler la publication' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await foreign.getByRole('button', { name: 'Options de la publication' }).click();
  await page.getByRole('button', { name: 'Signaler la publication' }).click();
  const dialog = page.getByRole('dialog', { name: 'Signaler la publication' });
  await expect(dialog).toBeVisible();
  await dialog.getByText('Harcèlement ou intimidation').click();
  await dialog.getByRole('textbox', { name: 'Précisions (facultatif)' }).fill('Contenu problématique');
  await dialog.getByRole('button', { name: 'Envoyer le signalement' }).click();
  await expect(dialog.getByRole('status')).toContainText('transmise à la modération');
  expect(reports).toEqual([{
    targetType: 'POST',
    targetId: 'friend-post',
    reason: 'Harcèlement ou intimidation : Contenu problématique'
  }]);
  // After server confirmation, Escape must close both report and options sheets.
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Options de cette publication' })).toHaveCount(0);
  await expect(foreign).toBeVisible();
});

test('failed report remains visible and never displays a false success', async ({ page }) => {
  const { reports } = await setup(page, 503);
  const foreign = page.locator('article.km-feed-post').filter({ hasText: 'Publication de mon amie' });
  await foreign.getByRole('button', { name: 'Options de la publication' }).click();
  await page.getByRole('button', { name: 'Signaler la publication' }).click();
  const dialog = page.getByRole('dialog', { name: 'Signaler la publication' });
  await dialog.getByText('Spam ou publicité abusive').click();
  await dialog.getByRole('button', { name: 'Envoyer le signalement' }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByRole('status')).toHaveCount(0);
  expect(reports).toHaveLength(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Options de cette publication' })).toBeVisible();
});

test('publication report dialog traps keyboard focus and restores its menu trigger', async ({ page }) => {
  await setup(page);
  const foreign = page.locator('article.km-feed-post').filter({hasText:'Publication de mon amie'});
  await foreign.getByRole('button',{name:'Options de la publication'}).click();
  await page.getByRole('button',{name:'Signaler la publication'}).click();
  const dialog=page.getByRole('dialog',{name:'Signaler la publication'});
  const firstRadio=dialog.getByRole('radio',{name:'Spam ou publicité abusive'});
  await expect(firstRadio).toBeFocused();
  // Shift+Tab from the first focusable control wraps to the last link in the modal.
  await dialog.getByRole('button',{name:'Fermer le signalement'}).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('link',{name:'Vérifier mes signalements précédents'})).toBeFocused();
  // A following Tab must wrap back to the first focusable control inside this sheet.
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button',{name:'Fermer le signalement'})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog',{name:'Options de cette publication'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Signaler la publication'})).toBeFocused();
});

