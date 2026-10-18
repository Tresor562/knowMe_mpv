import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('my publication reports are fetched privately, filtered and correctly labelled', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token', 'report-history-e2e-token');
    localStorage.setItem('knowme-locale', 'fr');
  });
  const requests: string[] = [];
  await page.route('**/api/knowme/**', async route => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    let body: unknown = {};
    if (path.endsWith('/users/me')) {
      body = { id:'viewer', username:'viewer', displayName:'Lecteur' };
    } else if (path.endsWith('/reports/mine')) {
      body = [
        { id:'report-post-a', targetType:'POST', targetId:'post-a',
          reason:'Spam ou publicité abusive', status:'OPEN', createdAt:'2026-10-18T11:00:00Z' },
        { id:'report-comment-a', targetType:'COMMENT', targetId:'comment-a',
          reason:'Commentaire problématique', status:'OPEN', createdAt:'2026-10-18T10:00:00Z' },
        { id:'report-post-b', targetType:'POST', targetId:'post-b',
          reason:'Arnaque', status:'RESOLVED', createdAt:'2026-10-17T09:00:00Z' }
      ];
    } else if (path.endsWith('/i18n/preferences')) {
      body = { locale:'fr', direction:'ltr' };
    } else if (path.endsWith('/appearance')) {
      body = { preference:{effectiveThemeKey:'system'}, themes:[] };
    }
    await route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(body) });
  });

  await page.goto('/feed/reports');
  await expect(page.getByRole('heading',{name:'Mes signalements de publications'})).toBeVisible();
  await expect(page.locator('.km-post-report-history-list li')).toHaveCount(2);
  await expect(page.getByText('En cours d’examen')).toBeVisible();
  await expect(page.getByText('Examiné')).toBeVisible();
  await expect(page.getByText('Commentaire problématique')).toHaveCount(0);
  await expect(page.getByRole('link',{name:/Voir la publication/}).first())
    .toHaveAttribute('href','/feed/post-a');
  expect(requests.some(path => path.endsWith('/reports/mine'))).toBe(true);
});

test('my publication reports shows a retry on API failure, never false empty state', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token','report-history-error-token');
    localStorage.setItem('knowme-locale','fr');
  });
  let fails = true;
  await page.route('**/api/knowme/**',async route=>{
    const path = new URL(route.request().url()).pathname;
    if(path.endsWith('/reports/mine') && fails){
      fails = false;
      await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Historique indisponible'})});
      return;
    }
    let body:unknown = {};
    if(path.endsWith('/users/me'))body={id:'viewer',username:'viewer',displayName:'Lecteur'};
    if(path.endsWith('/reports/mine'))body=[];
    if(path.endsWith('/i18n/preferences'))body={locale:'fr',direction:'ltr'};
    if(path.endsWith('/appearance'))body={preference:{effectiveThemeKey:'system'},themes:[]};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('/feed/reports');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('Aucun signalement de publication dans ton historique récent')).toHaveCount(0);
  await page.getByRole('button',{name:'Réessayer'}).click();
  await expect(page.getByRole('heading',{name:'Aucun signalement de publication dans ton historique récent'})).toBeVisible();
});
