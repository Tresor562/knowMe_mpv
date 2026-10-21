import {expect,test} from '@playwright/test';

test.use({serviceWorkers:'block'});

const samplePng=Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScfOZAAAAABJRU5ErkJggg==',
  'base64'
);

test('Reels retain sound across swipes, resolve avatar URLs, and let viewers retry a failed video',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','reels-recovery-test');
    localStorage.setItem('knowme-locale','fr');
    sessionStorage.setItem('knowme-reels-muted','false');
    // Browsers reject real autoplay in tests without a user gesture.
    HTMLMediaElement.prototype.play=function(){return Promise.resolve();};
  });
  const posts=Array.from({length:3},(_,index)=>({
    id:'recovery-'+index,content:'Clip '+index,createdAt:'2026-10-21T12:00:00Z',
    author:{id:'author',username:'creator',displayName:'Créateur',
      avatarUrl:'/media/public/avatar/photo123'},
    media:[{url:'/media/public/post/clip'+index,mimeType:'video/mp4',position:0}],
    _count:{likes:0,comments:0}
  }));
  let avatarFetches=0;
  await page.route('**/api/knowme/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith('/media/public/avatar/photo123')){
      avatarFetches++;
      await route.fulfill({status:200,contentType:'image/png',body:samplePng});
      return;
    }
    if(path.includes('/media/public/post/')){
      await route.fulfill({status:200,contentType:'video/mp4',body:''});
      return;
    }
    const payload=path.endsWith('/users/me')?{id:'me',username:'me',displayName:'Moi'}:
      path.endsWith('/posts/videos')?posts:
      path.endsWith('/appearance')?{preference:{effectiveThemeKey:'system'},themes:[]}:
      path.endsWith('/i18n/preferences')?{locale:'fr',direction:'ltr'}:{};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
  });

  await page.goto('/reels');
  const frames=page.locator('.km-reel-frame');
  await expect(frames).toHaveCount(3);
  const first=frames.nth(0).locator('video');
  await expect(first).toHaveCount(1);
  await expect.poll(()=>first.evaluate(video=>(video as HTMLVideoElement).muted)).toBe(false);
  const avatar=frames.nth(0).locator('.km-reel-avatar img');
  await expect(avatar).toHaveAttribute('src','/api/knowme/media/public/avatar/photo123');
  await expect.poll(()=>avatar.evaluate(node=>(node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  expect(avatarFetches).toBeGreaterThan(0);

  await page.getByRole('button',{name:'Vidéo suivante'}).click();
  await expect(frames.nth(1).locator('.km-reel-playback[aria-hidden="false"]')).toBeVisible();
  const second=frames.nth(1).locator('video');
  await expect.poll(()=>second.evaluate(video=>(video as HTMLVideoElement).muted)).toBe(false);

  // A media error must provide a retry control, not a permanently black screen.
  await second.evaluate(video=>video.dispatchEvent(new Event('error')));
  await expect(frames.nth(1).getByRole('button',{name:'Réessayer la vidéo'})).toBeVisible();
  const failedElement=await second.elementHandle();
  await frames.nth(1).getByRole('button',{name:'Réessayer la vidéo'}).click();
  await expect.poll(()=>failedElement!.evaluate(element=>element.isConnected)).toBe(false);
});
