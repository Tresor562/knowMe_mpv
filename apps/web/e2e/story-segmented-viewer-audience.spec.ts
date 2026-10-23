import {expect,test} from '@playwright/test';

test.use({serviceWorkers:'block'});

const story=(id:string,type:'TEXT'|'PHOTO'='TEXT')=>({
  id,type,caption:'Un moment avec KnowMe',assetId:null,
  hashtags:[],allowReplies:true,allowReactions:true,allowSharing:true,
  viewer:{own:true,reaction:null},metrics:{reactions:1,replies:0},
  author:{id:'creator',username:'creator',displayName:'Créateur',avatarUrl:null},
  background:{preset:'solid',color:'#243c78'}
});

test('owner sees one progress segment per Story and opens inline viewer reactions',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','story-segments-token');
    localStorage.setItem('knowme-locale','fr');
  });
  await page.route('**/api/knowme/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    let data:unknown={};
    if(path.endsWith('/users/me'))data={id:'creator',username:'creator',displayName:'Créateur'};
    else if(path.endsWith('/stories/s2'))data=story('s2');
    else if(path.endsWith('/stories/feed'))data={stories:[story('s2'),story('s1')],nextCursor:null};
    else if(path.endsWith('/stories/s2/viewers'))data={
      uniqueViewers:1,nextCursor:null,
      viewers:[{viewerUserId:'watcher',lastViewedAt:'2026-10-21T17:00:00Z',viewCount:1,
        reaction:{reaction:'🔥'},
        user:{username:'watcher',displayName:'Spectateur',avatarUrl:null}}]
    };
    else if(path.endsWith('/appearance'))data={preference:{effectiveThemeKey:'system'},themes:[]};
    else if(path.endsWith('/i18n/preferences'))data={locale:'fr',direction:'ltr'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/stories/s2');
  await expect(page.locator('.km-story-progress-track')).toHaveCount(2);
  await expect(page.locator('.km-story-progress-value').first()).toHaveCSS('width',/\d+px/);
  await page.getByRole('button',{name:'Voir les spectateurs de la story'}).click();
  await expect(page.getByRole('dialog',{name:'Spectateurs de la story'})).toBeVisible();
  await expect(page.locator('.km-story-viewers-sheet')).toContainText('Spectateur');
  await expect(page.locator('.km-story-viewers-sheet')).toContainText('🔥');
});

test('editor publishes a true text color and explicit excluded account IDs',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','story-exclusions-token');
    localStorage.setItem('knowme-locale','fr');
  });
  let payload:Record<string,unknown>|null=null;
  await page.route('**/api/knowme/**',async route=>{
    const url=new URL(route.request().url());
    let data:unknown={};
    if(url.pathname.endsWith('/users/me'))data={id:'author',username:'author',displayName:'Auteur'};
    else if(url.pathname.endsWith('/stories/audience/candidates'))data={users:[
      {id:'person-1',username:'lea',displayName:'Léa',avatarUrl:null}
    ]};
    else if(url.pathname.endsWith('/stories')&&route.request().method()==='POST'){
      payload=route.request().postDataJSON() as Record<string,unknown>;
      data={id:'published-story'};
    }else if(url.pathname.endsWith('/appearance'))data={preference:{effectiveThemeKey:'system'},themes:[]};
    else if(url.pathname.endsWith('/i18n/preferences'))data={locale:'fr',direction:'ltr'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/stories/new');
  await page.getByPlaceholder('Rechercher un nom ou @pseudo').fill('lea');
  await page.getByRole('checkbox',{name:/Léa/}).check();
  await page.getByRole('button',{name:'Changer la couleur de fond de la story'}).click();
  await page.locator('textarea[name="caption"]').fill('Story privée pour certains comptes');
  await page.locator('.km-story-bottom-submit').click();
  await expect.poll(()=>payload).not.toBeNull();
  const published=payload as Record<string,unknown>|null;
  expect(published?.excludeUserIds).toEqual(['person-1']);
  expect((published?.background as Record<string,string>).preset).toBe('solid');
  expect((published?.background as Record<string,string>).color).toMatch(/^#[0-9a-f]{6}$/i);
});
