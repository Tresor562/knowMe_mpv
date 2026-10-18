import { expect, test } from '@playwright/test';
test.use({ serviceWorkers:'block' });

test('post menu distinguishes ownership and X asks before hiding the post with undo',async ({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','feed-options-e2e-token');
    localStorage.setItem('knowme-locale','fr');
  });
  const me={id:'owner',username:'owner',displayName:'Moi'};
  const friend={id:'friend',username:'friend',displayName:'Un ami'};
  const makePost=(id:string,author:typeof me)=>({
    id,content:id==='own-post'?'Mon article':'Une publication étrangère',
    createdAt:'2026-10-18T10:00:00Z',author,
    _count:{likes:0,comments:0}
  });
  await page.route('**/api/knowme/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    let payload:unknown={};
    if(path.endsWith('/users/me'))payload=me;
    else if(path.endsWith('/posts/feed'))payload=[makePost('own-post',me),makePost('friend-post',friend)];
    else if(path.endsWith('/stories/rail'))payload={groups:[],nextOffset:null};
    else if(path.endsWith('/media/public/post-capabilities'))payload={publicPostImage:false};
    else if(path.endsWith('/appearance'))payload={preference:{effectiveThemeKey:'system'},themes:[]};
    else if(path.endsWith('/i18n/preferences'))payload={locale:'fr',direction:'ltr'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
  });
  await page.goto('/feed');
  const mine=page.locator('article.km-feed-post').filter({hasText:'Mon article'});
  const foreign=page.locator('article.km-feed-post').filter({hasText:'Une publication étrangère'});
  await mine.getByRole('button',{name:'Options de la publication'}).click();
  const ownerMenu=page.getByRole('dialog',{name:'Options de ta publication'});
  await expect(ownerMenu.getByRole('button',{name:'Supprimer la publication'})).toBeVisible();
  await expect(ownerMenu.getByRole('button',{name:'Masquer de mon fil'})).toHaveCount(0);
  await page.keyboard.press('Escape');

  await foreign.getByRole('button',{name:'Options de la publication'}).click();
  const otherMenu=page.getByRole('dialog',{name:'Options de cette publication'});
  await expect(otherMenu.getByRole('button',{name:'Supprimer la publication'})).toHaveCount(0);
  await otherMenu.getByRole('button',{name:'Masquer de mon fil'}).click();
  const reasons=page.getByRole('dialog',{name:'Pourquoi masquer cette publication ?'});
  await expect(reasons).toContainText('cette session uniquement');
  await reasons.getByRole('button',{name:'Pas intéressant'}).click();
  await expect(foreign).toHaveCount(0);
  await page.getByRole('button',{name:'Annuler'}).click();
  await expect(foreign).toBeVisible();
  await foreign.getByRole('button',{name:'Masquer la publication'}).click();
  await expect(reasons).toBeVisible();
});
