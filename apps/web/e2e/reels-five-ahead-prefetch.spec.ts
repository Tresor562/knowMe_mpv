import {expect,test} from '@playwright/test';

test.use({serviceWorkers:'block'});

test('Reels prepares five successors before the viewer swipes without displaying transport controls',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','reels-five-ahead-test');
    localStorage.setItem('knowme-locale','fr');
  });
  const posts=Array.from({length:9},(_,index)=>({
    id:'clip-'+index,content:'Video '+index,createdAt:'2026-10-21T10:00:00Z',
    author:{id:'author',username:'creator',displayName:'Creator'},
    media:[{url:'/media/public/post/video'+index,mimeType:'video/mp4',position:0}],
    _count:{likes:0,comments:0}
  }));
  await page.route('**/api/knowme/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    const data=path.endsWith('/users/me')?{id:'me',username:'me',displayName:'Moi'}:
      path.endsWith('/posts/videos')?posts:
      path.endsWith('/appearance')?{preference:{effectiveThemeKey:'system'},themes:[]}:
      path.endsWith('/i18n/preferences')?{locale:'fr',direction:'ltr'}:{};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/reels');
  const viewport=page.locator('.km-reels-viewport');
  await expect(viewport.locator('video')).toHaveCount(6);
  await expect(viewport.locator('.km-reel-playback[aria-hidden="true"]')).toHaveCount(5);
  await expect(viewport.locator('.km-reel-playback[aria-hidden="true"] video[preload="auto"]')).toHaveCount(5);
  await expect(viewport.locator('.km-reel-playback[aria-hidden="true"] button')).toHaveCount(0);
  await expect(viewport.locator('.km-reel-frame').nth(6).locator('.km-reel-placeholder')).toHaveCount(1);

  // The warmed native element must survive promotion; replacing it would
  // throw away its already buffered ranges and trigger another cold start.
  const upcoming=await viewport.locator('.km-reel-frame').nth(1).locator('video').elementHandle();
  expect(upcoming).not.toBeNull();
  await page.getByRole('button',{name:'Vidéo suivante'}).click();
  await expect(viewport.locator('.km-reel-frame').nth(1)
    .locator('.km-reel-playback:not([aria-hidden="true"])')).toBeVisible();
  expect(await upcoming!.evaluate(node=>node.isConnected)).toBe(true);
  await expect(viewport.locator('video')).toHaveCount(7);
  await expect(viewport.locator('.km-reel-playback[aria-hidden="true"] button')).toHaveCount(0);
});
