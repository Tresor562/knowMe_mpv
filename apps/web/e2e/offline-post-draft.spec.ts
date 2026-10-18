import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('post draft restores text and multiple image files after reload without posting', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token', 'offline-draft-test-session');
    localStorage.setItem('knowme-locale', 'fr');
  });
  let creates = 0;
  await page.route('**/api/knowme/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/posts') && route.request().method() === 'POST') creates++;
    let payload: unknown = {};
    if (path.endsWith('/users/me')) payload = { id:'account-A', username:'alice', displayName:'Alice' };
    else if (path.endsWith('/posts/feed')) payload = [];
    else if (path.endsWith('/stories/rail')) payload = { groups:[], nextOffset:null };
    else if (path.endsWith('/media/public/post-capabilities')) payload = { publicPostImage:true };
    else if (path.endsWith('/appearance')) payload = { preference:{effectiveThemeKey:'system'}, themes:[] };
    else if (path.endsWith('/i18n/preferences')) payload = { locale:'fr',direction:'ltr' };
    await route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(payload) });
  });
  await page.goto('/feed');
  await page.getByRole('button',{ name:'Ouvrir l’éditeur' }).click();
  const editor = page.getByRole('dialog',{ name:'Créer une publication' });
  await editor.locator('textarea[name="content"]').fill('Une idée écrite sans connexion');
  await editor.locator('input[type="file"]').setInputFiles([
    { name:'first.png',mimeType:'image/png',buffer:Buffer.alloc(1500,1) },
    { name:'second.png',mimeType:'image/png',buffer:Buffer.alloc(1600,2) }
  ]);
  await expect(editor.getByText('Brouillon enregistré hors ligne sur cet appareil.')).toBeVisible();
  await page.reload();
  await page.getByRole('button',{ name:'Ouvrir l’éditeur' }).click();
  const restored = page.getByRole('dialog',{ name:'Créer une publication' });
  await expect(restored.locator('textarea[name="content"]')).toHaveValue('Une idée écrite sans connexion');
  await expect(restored.getByText('first.png')).toBeVisible();
  await expect(restored.getByText('second.png')).toBeVisible();
  expect(creates).toBe(0);
});

test('drafts remain isolated by account on the same browser', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token','shared-device-session');
    localStorage.setItem('knowme-locale','fr');
  });
  let actor='first-user';
  await page.route('**/api/knowme/**',async route => {
    const path=new URL(route.request().url()).pathname;
    let payload:unknown={};
    if(path.endsWith('/users/me')) payload={id:actor,username:actor,displayName:actor};
    else if(path.endsWith('/posts/feed'))payload=[];
    else if(path.endsWith('/stories/rail'))payload={groups:[],nextOffset:null};
    else if(path.endsWith('/media/public/post-capabilities'))payload={publicPostImage:false};
    else if(path.endsWith('/appearance'))payload={preference:{effectiveThemeKey:'system'},themes:[]};
    else if(path.endsWith('/i18n/preferences'))payload={locale:'fr',direction:'ltr'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
  });
  await page.goto('/feed');
  await page.getByRole('button',{name:'Ouvrir l’éditeur'}).click();
  let editor=page.getByRole('dialog',{name:'Créer une publication'});
  await editor.locator('textarea[name="content"]').fill('Contenu privé du premier compte');
  await expect(editor.getByText('Brouillon enregistré hors ligne sur cet appareil.')).toBeVisible();
  actor='second-user';
  await page.reload();
  await page.getByRole('button',{name:'Ouvrir l’éditeur'}).click();
  editor=page.getByRole('dialog',{name:'Créer une publication'});
  await expect(editor.locator('textarea[name="content"]')).toHaveValue('');
  await expect(editor.getByText('Contenu privé du premier compte')).toHaveCount(0);
  actor='first-user';
  await page.reload();
  await page.getByRole('button',{name:'Ouvrir l’éditeur'}).click();
  await expect(page.getByRole('dialog',{name:'Créer une publication'}).locator('textarea[name="content"]'))
    .toHaveValue('Contenu privé du premier compte');
});
