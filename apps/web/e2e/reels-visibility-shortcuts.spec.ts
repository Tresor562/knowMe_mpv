import {expect,test} from '@playwright/test';
test.use({serviceWorkers:'block'});
test('Reels pause when tab is hidden and persist speed; keyboard avoids stealing input shortcuts',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','reels-visibility-test');
    localStorage.setItem('knowme-locale','fr');
  });
  await page.route('**/api/knowme/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    let data:unknown={};
    if(path.endsWith('/users/me'))data={id:'reader',username:'reader',displayName:'Reader'};
    else if(path.endsWith('/posts/videos'))data=[{id:'video-1',content:'Vidéo très longue',
      createdAt:'2026-10-18T10:00:00Z',
      author:{id:'writer',username:'writer',displayName:'Writer'},
      media:[{url:'/media/public/post/video-file',position:0,mimeType:'video/mp4'}],
      _count:{likes:0,comments:0}}];
    else if(path.endsWith('/appearance'))data={preference:{effectiveThemeKey:'system'},themes:[]};
    else if(path.endsWith('/i18n/preferences'))data={locale:'fr',direction:'ltr'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/reels');
  await expect(page.locator('.km-reel-video')).toHaveCount(1);
  const video=page.locator('.km-reel-video');
  await video.evaluate((v:HTMLVideoElement)=>{
    let isPaused=true;
    Object.defineProperty(v,'paused',{configurable:true,get:()=>isPaused});
    v.play=async()=>{isPaused=false;v.dataset.played=String(Number(v.dataset.played||0)+1);v.dispatchEvent(new Event('play'));};
    v.pause=()=>{isPaused=true;v.dataset.paused=String(Number(v.dataset.paused||0)+1);v.dispatchEvent(new Event('pause'));};
  });
  // Immersive Reels hide transport controls until the viewer taps the video.
  await page.locator('.km-reel-tap-zone').click();
  await expect(video).toHaveAttribute('data-played','1');
  await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,value:true});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(video).toHaveAttribute('data-paused','1');
  await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,value:false});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(video).toHaveAttribute('data-played','2');

  await page.getByRole('button',{name:'Vitesse de lecture'}).click();
  await expect(page.getByRole('button',{name:'Vitesse de lecture'})).toContainText('1.25×');
  await expect.poll(()=>page.evaluate(()=>sessionStorage.getItem('knowme-reel-playback-speed'))).toBe('1.25');
  await page.reload();
  await expect(page.locator('.km-reel-video')).toHaveCount(1);
  // Reveal native-like transient controls to inspect the restored speed.
  await page.locator('.km-reel-tap-zone').click();
  await expect(page.getByRole('button',{name:'Vitesse de lecture'})).toContainText('1.25×');

  await page.locator('.km-reels-viewport').focus();
  await page.keyboard.press('m');
  await expect(page.getByRole('button',{name:'Couper le son'})).toBeVisible();
});
