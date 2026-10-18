import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('Story owner can search, filter, sort and open real viewer profiles', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token', 'story-viewers-test-token');
    localStorage.setItem('knowme-locale', 'fr');
  });

  await page.route('**/api/knowme/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    let data: unknown = {};
    if (pathname.endsWith('/users/me')) {
      data = { id:'author', username:'auteur', displayName:'Auteur' };
    } else if (pathname.endsWith('/stories/s-1/viewers')) {
      data = {
        uniqueViewers:3, totalViews:9, replies:2, reactions:1,
        averageCompletionBps:7500, screenshots:1,
        viewers:[
          {viewerUserId:'u1',viewCount:2,completionBps:7500,
            lastViewedAt:'2026-10-18T10:30:00.000Z',screenshotAt:null,
            user:{username:'lea',displayName:'Léa',avatarUrl:null}},
          {viewerUserId:'u2',viewCount:6,completionBps:10000,
            lastViewedAt:'2026-10-18T09:30:00.000Z',
            screenshotAt:'2026-10-18T09:30:00.000Z',
            user:{username:'max',displayName:'Maxime',avatarUrl:null}},
          {viewerUserId:'u3',viewCount:1,completionBps:4000,
            lastViewedAt:'2026-10-17T09:30:00.000Z',screenshotAt:null,user:null}
        ]
      };
    } else if (pathname.endsWith('/appearance')) {
      data = {preference:{effectiveThemeKey:'system'},themes:[]};
    } else if (pathname.endsWith('/i18n/preferences')) {
      data = {locale:'fr',direction:'ltr'};
    }
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });

  await page.goto('/stories/s-1/insights');
  await expect(page.getByRole('heading',{name:'Spectateurs',exact:true})).toBeVisible();
  await expect(page.getByText('9',{exact:true})).toBeVisible();
  await expect(page.locator('.km-story-insights-person')).toHaveCount(3);
  await expect(page.getByRole('link',{name:/Léa/})).toHaveAttribute('href','/profile/lea');

  await page.getByRole('button',{name:'Plus de vues'}).click();
  await expect(page.locator('.km-story-insights-person').first()).toContainText('Maxime');
  await page.getByRole('button',{name:'Captures',exact:true}).click();
  await expect(page.locator('.km-story-insights-person')).toHaveCount(1);
  await expect(page.locator('.km-story-insights-person').first()).toContainText('Capture signalée');

  await page.getByRole('button',{name:'Tous',exact:true}).click();
  await page.getByRole('searchbox',{name:'Rechercher un spectateur'}).fill('lea');
  await expect(page.locator('.km-story-insights-person')).toHaveCount(1);
  await expect(page.locator('.km-story-insights-person').first()).toContainText('Léa');
  await page.getByRole('searchbox',{name:'Rechercher un spectateur'}).fill('personne-inconnue');
  await expect(page.getByText('Aucun résultat pour cette recherche.')).toBeVisible();
});

test('Owner sees a helpful empty state without invented viewers', async ({page}) => {
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','story-empty-token');
    localStorage.setItem('knowme-locale','fr');
  });
  await page.route('**/api/knowme/**', async route=>{
    const pathname=new URL(route.request().url()).pathname;
    let data:unknown={};
    if(pathname.endsWith('/users/me'))data={id:'author',username:'author',displayName:'Author'};
    else if(pathname.endsWith('/stories/empty/viewers'))data={
      uniqueViewers:0,totalViews:0,replies:0,reactions:0,averageCompletionBps:0,
      screenshots:0,viewers:[]
    };
    else if(pathname.endsWith('/appearance'))data={preference:{effectiveThemeKey:'system'},themes:[]};
    else if(pathname.endsWith('/i18n/preferences'))data={locale:'fr',direction:'ltr'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/stories/empty/insights');
  await expect(page.getByText('Personne n’a encore vu cette story.')).toBeVisible();
  await expect(page.locator('.km-story-insights-person')).toHaveCount(0);
});

test('Owner loads more Story viewers without duplicates and retains global metrics',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','story-pagination-token');
    localStorage.setItem('knowme-locale','fr');
  });
  let pages=0;
  await page.route('**/api/knowme/**',async route=>{
    const url=new URL(route.request().url());
    let data:unknown={};
    if(url.pathname.endsWith('/users/me')){
      data={id:'author',username:'auteur',displayName:'Auteur'};
    }else if(url.pathname.endsWith('/stories/paged/viewers')){
      pages++;
      const viewer=(id:string,name:string)=>({
        viewerUserId:id,lastViewedAt:'2026-10-18T10:30:00.000Z',
        viewCount:1,completionBps:7500,screenshotAt:null,
        user:{username:name,displayName:name,avatarUrl:null}
      });
      data={
        uniqueViewers:3,totalViews:6,replies:0,reactions:2,
        averageCompletionBps:7500,screenshots:0,
        nextCursor:url.searchParams.get('cursor')?null:'page-1',
        viewers:url.searchParams.has('cursor')
          ?[viewer('u2','Berta'),viewer('u3','Chloé')]
          :[viewer('u1','Alina'),viewer('u2','Berta')]
      };
    }else if(url.pathname.endsWith('/appearance')){
      data={preference:{effectiveThemeKey:'system'},themes:[]};
    }else if(url.pathname.endsWith('/i18n/preferences')){
      data={locale:'fr',direction:'ltr'};
    }
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/stories/paged/insights');
  await expect(page.locator('.km-story-insights-person')).toHaveCount(2);
  await page.getByRole('button',{name:'Afficher plus de spectateurs'}).click();
  await expect(page.locator('.km-story-insights-person')).toHaveCount(3);
  await expect(page.getByRole('link',{name:/Chloé/})).toHaveAttribute('href','/profile/Chloé');
  await expect(page.getByText('6',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Afficher plus de spectateurs'})).toHaveCount(0);
  expect(pages).toBe(2);
});

test('The Story archive exposes a working owner-insights entry point',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','story-archive-insights-token');
    localStorage.setItem('knowme-locale','fr');
  });
  await page.route('**/api/knowme/**',async route=>{
    const pathname=new URL(route.request().url()).pathname;
    let data:unknown={};
    if(pathname.endsWith('/users/me'))data={id:'author',username:'auteur',displayName:'Auteur'};
    else if(pathname.endsWith('/stories/me/archive'))data={
      stories:[{id:'s-1',type:'PHOTO',caption:'Un dimanche',
        createdAt:'2026-10-18T10:00:00.000Z',archivedAt:'2026-10-18T11:00:00.000Z'}],
      nextCursor:null
    };
    else if(pathname.endsWith('/stories/s-1/viewers'))data={
      uniqueViewers:0,totalViews:0,replies:0,reactions:0,
      averageCompletionBps:0,screenshots:0,viewers:[],nextCursor:null
    };
    else if(pathname.endsWith('/appearance'))data={preference:{effectiveThemeKey:'system'},themes:[]};
    else if(pathname.endsWith('/i18n/preferences'))data={locale:'fr',direction:'ltr'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/stories/archive');
  const insights=page.getByRole('link',{name:/Spectateurs et statistiques/});
  await expect(insights).toHaveAttribute('href','/stories/s-1/insights');
  await insights.click();
  await expect(page).toHaveURL(/\/stories\/s-1\/insights$/);
  await expect(page.getByRole('heading',{name:'Spectateurs',exact:true})).toBeVisible();
});
