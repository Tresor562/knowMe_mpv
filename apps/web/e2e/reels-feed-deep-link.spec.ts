import {expect,test} from '@playwright/test';

test.use({serviceWorkers:'block'});

test('a feed recommendation opens its exact authorized Reel even outside the initial page',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','reel-target-test-token');
    localStorage.setItem('knowme-locale','fr');
  });
  const first={id:'first',content:'Premier',createdAt:'2026-10-20T10:00:00Z',
    author:{id:'one',username:'one',displayName:'One'},_count:{likes:1,comments:0},
    media:[{url:'/media/public/post/firstfile',mimeType:'video/mp4',position:0}]};
  const second={id:'second',content:'Second Reel',createdAt:'2026-10-20T12:00:00Z',
    author:{id:'two',username:'two',displayName:'Two'},_count:{likes:2,comments:0},
    media:[{url:'/media/public/post/secondfile',mimeType:'video/mp4',position:0}]};
  let targetRequests=0;
  await page.route('**/api/knowme/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    let body:unknown={};
    if(path.endsWith('/users/me'))body={id:'viewer',username:'viewer',displayName:'Viewer'};
    else if(path.endsWith('/posts/videos'))body=[first];
    else if(path.endsWith('/posts/second')){targetRequests++;body=second;}
    else if(path.includes('/reels/likes'))body={likedPostIds:[]};
    else if(path.endsWith('/appearance'))body={preference:{effectiveThemeKey:'system'},themes:[]};
    else if(path.endsWith('/i18n/preferences'))body={locale:'fr',direction:'ltr'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('/reels?post=second&position=0');
  const requested=page.locator('.km-reel-frame[data-video-id="second:0"]');
  await expect(requested).toBeVisible();
  await expect(requested).toBeInViewport();
  await expect(requested.locator('video')).toHaveCount(1);
  expect(targetRequests).toBe(1);
});
