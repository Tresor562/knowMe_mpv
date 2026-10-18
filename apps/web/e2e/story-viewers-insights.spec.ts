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

  await page.goto('/stories/s-1/viewers');
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
  await page.goto('/stories/empty/viewers');
  await expect(page.getByText('Personne n’a encore vu cette story.')).toBeVisible();
  await expect(page.locator('.km-story-insights-person')).toHaveCount(0);
});
