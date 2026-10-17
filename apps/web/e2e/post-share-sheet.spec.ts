import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('post share sheet really creates a Story and a repost on the feed', async ({ page }) => {
  const shared: Array<{ path: string; data: Record<string, unknown> }> = [];
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token','social-share-e2e-token');
    localStorage.setItem('knowme-locale','fr');
  });

  await page.route('**/api/knowme/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'POST' &&
        (path.endsWith('/stories') || path.endsWith('/posts'))) {
      shared.push({ path, data: request.postDataJSON() as Record<string, unknown> });
      await route.fulfill({ status: 201, contentType:'application/json',
        body: JSON.stringify({ id:'shared-123' }) });
      return;
    }
    const post = {
      id:'reference-post',content:'Publication originale',createdAt:'2026-10-17T12:00:00Z',
      author:{id:'friend',username:'friend',displayName:'Un ami',avatarUrl:null},
      _count:{likes:3,comments:2}
    };
    let data: unknown = {};
    if (path.endsWith('/users/me')) data = {
      id:'current',username:'me',displayName:'Moi',email:'me@sample.test'
    };
    else if (path.endsWith('/posts/feed')) data = [post];
    else if (path.endsWith('/stories/feed')) data = {stories:[],nextCursor:null};
    else if (path.endsWith('/stories/rail')) data = {groups:[],nextOffset:null};
    else if (path.endsWith('/media/public/post-capabilities')) data = {publicPostImage:false};
    else if (path.endsWith('/appearance')) data = {preference:{effectiveThemeKey:'system'},themes:[]};
    else if (path.endsWith('/i18n/preferences')) data = {locale:'fr',direction:'ltr'};
    await route.fulfill({ status:200, contentType:'application/json',body:JSON.stringify(data) });
  });

  await page.goto('/feed');
  const openShare = page.getByRole('button',{name:'Partager la publication'});
  await expect(openShare).toBeVisible();
  await openShare.click();
  const dialog = page.getByRole('dialog',{name:'Partager la publication'});
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Ajouter un commentaire au partage…').fill('À voir absolument');
  await dialog.getByLabel('Audience de la story').selectOption('PUBLIC');
  await dialog.getByRole('button',{name:'Dans ma story'}).click();
  await expect(dialog).not.toBeVisible();
  expect(shared[0]?.path).toMatch(/\/stories$/);
  expect(shared[0]?.data).toMatchObject({
    type:'LINK',audience:'PUBLIC',caption:'À voir absolument'
  });
  expect(String(shared[0]?.data.linkUrl)).toContain('/feed/reference-post');

  await openShare.click();
  await dialog.getByRole('button',{name:'Sur mon profil'}).click();
  await expect(dialog).not.toBeVisible();
  expect(shared[1]?.path).toMatch(/\/posts$/);
  expect(String(shared[1]?.data.content)).toContain('Un ami');
  expect(String(shared[1]?.data.content)).toContain('/feed/reference-post');
});
