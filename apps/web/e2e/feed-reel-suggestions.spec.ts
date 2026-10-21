import {expect,test} from '@playwright/test';

test.use({serviceWorkers:'block'});

test('reel suggestions use real MP4 posts and remain outside publication markup',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','social-reel-rail-test');
    localStorage.setItem('knowme-locale','fr');
  });
  const author={id:'a',username:'a',displayName:'Auteur'};
  const first={id:'post1',content:'Publication existante',createdAt:'2026-10-20T10:00:00Z',
    author,_count:{likes:0,comments:0}};
  const actual={id:'reel2',content:'Vidéo existante',createdAt:'2026-10-20T12:00:00Z',
    author,_count:{likes:3,comments:2},
    media:[{url:'/media/public/post/reelasset',mimeType:'video/mp4',position:0}]};
  await page.route('**/api/knowme/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    const data=path.endsWith('/users/me')?{id:'a',username:'a',displayName:'Auteur'}:
      path.endsWith('/posts/feed')?[first]:
      path.endsWith('/posts/videos')?[actual]:
      path.endsWith('/stories/rail')?{groups:[],nextOffset:null}:
      path.endsWith('/appearance')?{preference:{effectiveThemeKey:'system'},themes:[]}:
      path.endsWith('/i18n/preferences')?{locale:'fr',direction:'ltr'}:
      path.endsWith('/media/public/post-capabilities')?{publicPostImage:false}:{};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/feed');
  const rail=page.getByRole('complementary',{name:'Suggestions de réels'});
  await expect(rail).toBeVisible();
  await rail.scrollIntoViewIfNeeded();
  await expect(page.locator('.km-feed-post')).toHaveCount(1);
  await expect(page.locator('article .km-feed-reel-recommendations')).toHaveCount(0);
  await expect(rail.getByRole('link',{name:'Regarder le réel de Auteur'}))
    .toHaveAttribute('href','/reels?post=reel2&position=0');
  // A recommendation is always a still thumbnail: native/HTML transport
  // widgets must never bleed across horizontally-scrolled cards.
  await expect(rail.locator('.km-feed-reel-still')).toHaveCount(1);
  await expect(rail.locator('video')).toHaveCount(0);
  await expect(rail.locator('button')).toHaveCount(0);
});

test('no real videos means no Reel recommendation strip or invented view counters',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','social-no-reels-test');
    localStorage.setItem('knowme-locale','fr');
  });
  await page.route('**/api/knowme/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    const data=path.endsWith('/users/me')?{id:'a',username:'a',displayName:'Auteur'}:
      path.endsWith('/posts/feed')?[{id:'p1',content:'Texte',createdAt:'2026-10-20T12:00:00Z',
        author:{id:'a',username:'a',displayName:'Auteur'},_count:{likes:0,comments:0}}]:
      path.endsWith('/posts/videos')?[]:
      path.endsWith('/stories/rail')?{groups:[],nextOffset:null}:
      path.endsWith('/appearance')?{preference:{effectiveThemeKey:'system'},themes:[]}:
      path.endsWith('/i18n/preferences')?{locale:'fr',direction:'ltr'}:{};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/feed');
  await expect(page.locator('.km-feed-post')).toHaveCount(1);
  await expect(page.locator('.km-feed-reel-recommendations')).toHaveCount(0);
});
