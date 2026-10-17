import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('comment actions distinguish another author from your own comment', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token','comments-e2e-token');
    localStorage.setItem('knowme-locale','fr');
  });
  const actor={id:'viewer', username:'viewer', displayName:'Moi'};
  const author={id:'ada',username:'ada',displayName:'Ada'};
  const post={id:'post-123',content:'Bonjour KnowMe',createdAt:'2026-10-17T15:00:00.000Z',
    authorId:'ada',author,_count:{likes:0,comments:2}};
  const comments=[
    {id:'other-comment',content:'Un commentaire public',createdAt:'2026-10-17T15:05:00.000Z',author},
    {id:'own-comment',content:'Mon propre commentaire',createdAt:'2026-10-17T15:06:00.000Z',author:actor}
  ];
  await page.route('**/api/knowme/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = {};
    if(path.endsWith('/users/me')) data=actor;
    else if(path.endsWith('/posts/post-123')) data=post;
    else if(path.endsWith('/posts/post-123/comments')) data=comments;
    else if(path.endsWith('/appearance')) data={preference:{effectiveThemeKey:'system'},themes:[]};
    else if(path.endsWith('/i18n/preferences')) data={locale:'fr',direction:'ltr'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/feed/post-123');
  await expect(page.locator('#knowme-comment-other-comment')).toBeVisible();
  await page.locator('#knowme-comment-other-comment').click({button:'right'});
  let sheet=page.getByRole('dialog',{name:'Actions sur le commentaire de Ada'});
  await expect(sheet.getByRole('button',{name:'Copier le texte'})).toBeVisible();
  await expect(sheet.getByRole('button',{name:'Copier le lien'})).toBeVisible();
  await expect(sheet.getByRole('button',{name:'Supprimer le commentaire'})).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(sheet).not.toBeVisible();

  await page.locator('#knowme-comment-own-comment').click({button:'right'});
  sheet=page.getByRole('dialog',{name:'Actions sur le commentaire de Moi'});
  await expect(sheet.getByRole('button',{name:'Supprimer le commentaire'})).toBeVisible();
});
