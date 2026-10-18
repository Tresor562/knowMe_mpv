import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('moderation status filters query the server rather than filtering just loaded reports', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token', 'report-status-filter-test-token');
    localStorage.setItem('knowme-locale', 'fr');
  });
  const requested: string[] = [];
  const report = (id: string, status: string) => ({
    id, targetType:'POST', targetId:'post-' + id,
    reason:'Signalement ' + id, status, createdAt:'2026-10-18T12:00:00Z'
  });
  await page.route('**/api/knowme/**', async route => {
    const url = new URL(route.request().url());
    let data: unknown = {};
    if (url.pathname.endsWith('/users/me')) {
      data = {id:'viewer',username:'viewer',displayName:'Lecteur'};
    } else if (url.pathname.endsWith('/reports/mine/posts')) {
      const status = url.searchParams.get('status') ?? '';
      requested.push(status);
      const all = [report('pending','OPEN'),report('reviewed','RESOLVED')];
      data = {reports:status ? all.filter(entry => entry.status === status) : all,
        nextCursor:null};
    } else if (url.pathname.endsWith('/i18n/preferences')) {
      data = {locale:'fr',direction:'ltr'};
    } else if (url.pathname.endsWith('/appearance')) {
      data = {preference:{effectiveThemeKey:'system'},themes:[]};
    }
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/feed/reports');
  await expect(page.locator('.km-post-report-history-list li')).toHaveCount(2);

  const statusButtons = page.getByRole('group',{name:'Filtrer par statut'});
  await statusButtons.getByRole('button',{name:'En cours'}).click();
  await expect(statusButtons.getByRole('button',{name:'En cours'})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByText('Signalement pending')).toBeVisible();
  await expect(page.getByText('Signalement reviewed')).toHaveCount(0);

  await statusButtons.getByRole('button',{name:'Examinés'}).click();
  await expect(page.getByText('Signalement reviewed')).toBeVisible();
  await expect(page.getByText('Signalement pending')).toHaveCount(0);

  await statusButtons.getByRole('button',{name:'Clôturés'}).click();
  await expect(page.getByRole('heading',{name:'Aucun signalement avec ce statut'})).toBeVisible();
  await statusButtons.getByRole('button',{name:'Tous'}).click();
  await expect(page.locator('.km-post-report-history-list li')).toHaveCount(2);
  expect(requested).toEqual(['','OPEN','RESOLVED','DISMISSED','']);
});

test('switching report filters ignores an older delayed response', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token', 'report-race-e2e-token');
    localStorage.setItem('knowme-locale', 'fr');
  });
  let releaseOld: (() => void) | undefined;
  const delayed = new Promise<void>(resolve => { releaseOld = resolve; });
  await page.route('**/api/knowme/**', async route => {
    const url = new URL(route.request().url());
    let body: unknown = {};
    if (url.pathname.endsWith('/users/me')) {
      body = {id:'viewer',username:'viewer',displayName:'Lecteur'};
    } else if (url.pathname.endsWith('/reports/mine/posts')) {
      const status=url.searchParams.get('status');
      if(status==='OPEN') await delayed;
      body = {reports: status==='OPEN'
        ? [{id:'open-id',targetType:'POST',targetId:'post-open',
            reason:'Signalement encore ouvert',status:'OPEN',createdAt:'2026-10-18T12:00:00Z'}]
        : [{id:'resolved-id',targetType:'POST',targetId:'post-resolved',
            reason:'Signalement examiné',status:'RESOLVED',createdAt:'2026-10-18T12:00:00Z'}],
        nextCursor:null};
    } else if (url.pathname.endsWith('/i18n/preferences')) {
      body={locale:'fr',direction:'ltr'};
    } else if (url.pathname.endsWith('/appearance')) {
      body={preference:{effectiveThemeKey:'system'},themes:[]};
    }
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });

  try {
    await page.goto('/feed/reports');
    await expect(page.getByText('Signalement examiné')).toBeVisible();
    const filters=page.getByRole('group',{name:'Filtrer par statut'});
    await filters.getByRole('button',{name:'En cours'}).click();
    await expect(filters.getByRole('button',{name:'En cours'})).toHaveAttribute('aria-pressed','true');
    await filters.getByRole('button',{name:'Examinés'}).click();
    await expect(page.getByText('Signalement examiné')).toBeVisible();
    releaseOld?.();
    await expect(page.getByText('Signalement encore ouvert')).toHaveCount(0);
    await expect(filters.getByRole('button',{name:'Examinés'})).toHaveAttribute('aria-pressed','true');
  } finally {
    releaseOld?.();
  }
});
