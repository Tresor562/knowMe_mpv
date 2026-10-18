import {expect,test} from '@playwright/test';

test.use({serviceWorkers:'block'});

const story=(id:number)=>({
  id:'archive-'+id,type:id===51?'VIDEO':'TEXT',
  caption:'Story archivée '+id,
  createdAt:'2026-10-17T12:00:00.000Z',
  archivedAt:'2026-10-18T12:00:00.000Z',
  pinnedAt:id===51?'2026-10-18T12:00:00.000Z':null,
  hashtags:[]
});

test('archive paginates after 50 Stories, de-duplicates and preserves live links',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','archive-e2e');
    localStorage.setItem('knowme-locale','fr');
  });
  let requests=0;
  await page.route('**/api/knowme/**',async route=>{
    const url=new URL(route.request().url());
    const path=url.pathname;
    let body:unknown={};
    if(path.endsWith('/users/me'))body={id:'author',username:'author',displayName:'Auteur'};
    else if(path.endsWith('/stories/me/archive')){
      requests++;
      const cursor=url.searchParams.get('cursor');
      body=cursor==='archive-50'?
        {stories:[story(50),story(51)],nextCursor:null}:
        {stories:Array.from({length:50},(_,i)=>story(i+1)),nextCursor:'archive-50'};
    }else if(path.endsWith('/appearance'))body={preference:{effectiveThemeKey:'system'},themes:[]};
    else if(path.endsWith('/i18n/preferences'))body={locale:'fr',direction:'ltr'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('/stories/archive');
  await expect(page.getByRole('heading',{name:'Archive des Stories'})).toBeVisible();
  await expect(page.locator('.km-story-archive-entry')).toHaveCount(50);
  await page.getByRole('button',{name:'Afficher plus de Stories'}).click();
  await expect(page.locator('.km-story-archive-entry')).toHaveCount(51);
  await expect(page.locator('.km-story-archive-entry').last()).toHaveAttribute('href','/stories/archive-51');
  await page.getByRole('button',{name:'Épinglées'}).click();
  await expect(page.locator('.km-story-archive-entry')).toHaveCount(1);
  await expect(page.getByText('Épinglée',{exact:true})).toBeVisible();
  expect(requests).toBe(2);
});

test('empty archive uses archive-specific message instead of views text',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','archive-empty');
    localStorage.setItem('knowme-locale','fr');
  });
  await page.route('**/api/knowme/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    let body:unknown={};
    if(path.endsWith('/users/me'))body={id:'author',username:'author',displayName:'Auteur'};
    else if(path.endsWith('/stories/me/archive'))body={stories:[],nextCursor:null};
    else if(path.endsWith('/appearance'))body={preference:{effectiveThemeKey:'system'},themes:[]};
    else if(path.endsWith('/i18n/preferences'))body={locale:'fr',direction:'ltr'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('/stories/archive');
  await expect(page.getByText('Aucune Story archivée pour le moment.')).toBeVisible();
  await expect(page.locator('.km-story-archive-entry')).toHaveCount(0);
});
