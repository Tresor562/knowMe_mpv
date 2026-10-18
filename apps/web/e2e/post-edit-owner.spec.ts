import {expect,test} from '@playwright/test';
test.use({serviceWorkers:'block'});

test('owner edits existing post text while other users cannot access edit',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','edit-post-test-token');
    localStorage.setItem('knowme-locale','fr');
  });
  const me={id:'owner',username:'owner',displayName:'Moi'};
  const other={id:'other',username:'other',displayName:'Autre'};
  let ownContent='Ma publication originale';
  let patches=0;
  await page.route('**/api/knowme/**',async route=>{
    const req=route.request();
    const path=new URL(req.url()).pathname;
    let payload:unknown={};
    if(path.endsWith('/users/me'))payload=me;
    else if(path.endsWith('/posts/feed'))payload=[
      {id:'mine',content:ownContent,createdAt:'2026-10-18T08:00:00Z',author:me,_count:{likes:0,comments:0}},
      {id:'other-post',content:'Une autre publication',createdAt:'2026-10-18T07:00:00Z',author:other,_count:{likes:0,comments:0}}
    ];
    else if(path.endsWith('/posts/mine') && req.method()==='PATCH'){
      patches++;
      ownContent=(req.postDataJSON() as {content:string}).content;
      payload={id:'mine',content:ownContent};
    }
    else if(path.endsWith('/stories/rail'))payload={groups:[],nextOffset:null};
    else if(path.endsWith('/media/public/post-capabilities'))payload={publicPostImage:false};
    else if(path.endsWith('/appearance'))payload={preference:{effectiveThemeKey:'system'},themes:[]};
    else if(path.endsWith('/i18n/preferences'))payload={locale:'fr',direction:'ltr'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
  });
  await page.goto('/feed');
  let mine=page.locator('article.km-feed-post').filter({hasText:'Ma publication originale'});
  await mine.getByRole('button',{name:'Options de la publication'}).click();
  await page.getByRole('dialog',{name:'Options de ta publication'})
    .getByRole('button',{name:'Modifier la publication'}).click();
  const edit=page.getByRole('dialog',{name:'Modifier la publication'});
  await edit.getByRole('textbox',{name:'Texte de la publication'}).fill('Ma publication corrigée');
  await edit.getByRole('button',{name:'Enregistrer'}).click();
  await expect(edit).not.toBeVisible();
  mine=page.locator('article.km-feed-post').filter({hasText:'Ma publication corrigée'});
  await expect(mine).toBeVisible();
  expect(patches).toBe(1);

  const otherPost=page.locator('article.km-feed-post').filter({hasText:'Une autre publication'});
  await otherPost.getByRole('button',{name:'Options de la publication'}).click();
  await expect(page.getByRole('dialog',{name:'Options de cette publication'})
    .getByRole('button',{name:'Modifier la publication'})).toHaveCount(0);
});
