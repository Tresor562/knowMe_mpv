import { expect, test } from '@playwright/test';

test.use({ serviceWorkers:'block' });

test('a report from another user’s comment reaches the real report endpoint', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token', 'comment-report-e2e');
    localStorage.setItem('knowme-locale', 'fr');
  });
  const me={id:'viewer',username:'viewer',displayName:'Moi'};
  const other={id:'other',username:'other',displayName:'Autre personne'};
  const post={id:'post-a',authorId:'other',author:other,
    createdAt:'2026-10-18T00:00:00Z',content:'Une publication',
    _count:{likes:0,comments:2}};
  let report: { targetType?: string; targetId?: string; reason?: string } | null = null;
  await page.route('**/api/knowme/**',async route => {
    const request=route.request();
    const path=new URL(request.url()).pathname;
    if(path.endsWith('/reports') && request.method()==='POST') {
      report=request.postDataJSON();
      await route.fulfill({status:201,contentType:'application/json',
        body:JSON.stringify({id:'report-1',status:'OPEN'})});
      return;
    }
    let body:unknown={};
    if(path.endsWith('/users/me'))body=me;
    else if(path.endsWith('/posts/post-a'))body=post;
    else if(path.endsWith('/posts/post-a/comments'))body=[
      {id:'comment-other',content:'Contenu à signaler',author:other,createdAt:'2026-10-18T00:01:00Z'},
      {id:'comment-own',content:'Ma réponse',author:me,createdAt:'2026-10-18T00:02:00Z'}
    ];
    else if(path.endsWith('/appearance'))body={preference:{effectiveThemeKey:'system'},themes:[]};
    else if(path.endsWith('/i18n/preferences'))body={locale:'fr',direction:'ltr'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });

  await page.goto('/feed/post-a');
  await page.locator('#knowme-comment-own').click({button:'right'});
  await expect(page.getByRole('button',{name:'Signaler le commentaire'})).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.locator('#knowme-comment-other').click({button:'right'});
  await page.getByRole('button',{name:'Signaler le commentaire'}).click();
  const dialog=page.getByRole('dialog',{name:'Signaler le commentaire'});
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Spam ou publicité abusive').check();
  await dialog.getByRole('button',{name:'Envoyer le signalement'}).click();
  await expect(dialog).not.toBeVisible();
  await expect.poll(() => report).toMatchObject({
    targetType:'COMMENT',targetId:'comment-other'
  });
  expect(report?.reason).toContain('Spam');
});
