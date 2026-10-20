import { expect, test } from '@playwright/test';
test.use({serviceWorkers:'block'});
test('reference home has real search, overflow and a single publication entry', async ({page}) => {
  await page.addInitScript(()=>{
  localStorage.setItem('knowme_token','reference-home-e2e-token');
  localStorage.setItem('knowme-locale','fr');
});
await page.route('**/api/knowme/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  const body=path.endsWith('/users/me')?{id:'ref-user',username:'reftest',displayName:'Ref Test'}:
    path.endsWith('/posts/feed')?[]:
    path.endsWith('/stories/rail')?{groups:[],nextOffset:null}:
    path.endsWith('/appearance')?{preference:{effectiveThemeKey:'system'},themes:[]}:
    path.endsWith('/i18n/preferences')?{locale:'fr',direction:'ltr'}:
    path.endsWith('/media/public/post-capabilities')?{publicPostImage:false}:{};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
});
  await page.goto('/feed');
  await expect(page.locator('.km-feed-reference-brand')).toBeVisible();
  const header=page.locator('.km-feed-reference-header');
  await expect(header.locator('img[src="/brand/knowme-logo.svg"]')).toBeVisible();
  await expect(header.getByRole('link',{name:'Rechercher sur KnowMe'})).toHaveAttribute('href','/discover');
  await expect(page.locator('.km-feed-quick-add')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Créer une publication'})).toBeVisible();

  await header.getByRole('button',{name:'Plus d’options'}).click();
  await expect(header.getByRole('navigation',{name:'Menu du fil'})).toBeVisible();
  await header.getByRole('navigation',{name:'Menu du fil'}).getByRole('button',{name:'Créer une publication'}).click();
  await expect(page.getByRole('dialog',{name:'Créer une publication'})).toBeVisible();
});
