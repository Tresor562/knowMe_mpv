import { expect, test } from '@playwright/test';

test.use({serviceWorkers:'block'});

test('Reels plays one video and warms future clips without mixing post actions',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','reels-e2e-session');
    localStorage.setItem('knowme-locale','fr');
  });
  const posts=['first','second'].map((name,index)=>({
    id:'post-'+(index+1),content:'Reel '+name,
    createdAt:'2026-10-18T15:00:00Z',
    author:{id:'author-'+index,username:'author'+index,displayName:'Author '+index},
    _count:{likes:1,comments:index+1},
    media:[{url:'/media/public/post/'+name,position:0,mimeType:'video/mp4'}]
  }));
  let likes=0;
  await page.route('**/api/knowme/**',async route=>{
    const request=route.request();
    const path=new URL(request.url()).pathname;
    let body:unknown={};
    if(path.endsWith('/users/me'))body={id:'me',username:'me',displayName:'Moi'};
    else if(path.endsWith('/posts/feed'))body=posts;
    else if(path.endsWith('/reels/post-1/like')){likes++;body={liked:likes%2===1,count:likes%2===1?2:1};}
    else if(path.endsWith('/appearance'))body={preference:{effectiveThemeKey:'system'},themes:[]};
    else if(path.endsWith('/i18n/preferences'))body={locale:'fr',direction:'ltr'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('/reels');
  const viewport=page.getByRole('region',{name:'Fil vertical des vidéos'});
  await expect(viewport).toBeVisible();
  await expect(viewport.locator('.km-reel-frame')).toHaveCount(2);
  await expect(viewport.locator('video')).toHaveCount(2);
  await expect(viewport.locator('.km-reel-playback:not([aria-hidden="true"]) video')).toHaveAttribute('src',/\/first$/);
  await expect(viewport.locator('.km-reel-playback[aria-hidden="true"] video')).toHaveAttribute('src',/\/second$/);
  await expect(viewport.locator('.km-reel-playback[aria-hidden="true"] video')).toHaveAttribute('preload','auto');
  await expect(viewport.locator('.km-reel-playback[aria-hidden="true"] .km-reel-tap-zone')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Position dans la vidéo'})).toHaveCount(0);
  await expect(viewport.getByRole('slider',{name:'Position dans la vidéo'})).toBeVisible();

  await page.getByRole('button',{name:'Réagir à la publication'}).first().click();
  await expect.poll(()=>likes).toBe(1);
  await expect(page.getByRole('button',{name:'Réagir à la publication'}).first()).toContainText('2');

  // A double tap on an already-liked Reel must not toggle the like off.
  // The separate double-tap test verifies PUT creates an initial like.
  await viewport.locator('.km-reel-playback:not([aria-hidden="true"]) .km-reel-tap-zone').dblclick();
  await expect.poll(()=>likes).toBe(1);
  await expect(page.getByRole('button',{name:'Réagir à la publication'}).first()).toContainText('2');

  // The elapsed/duration format does not wrap to minutes for long videos.
  await viewport.locator('.km-reel-playback:not([aria-hidden="true"]) video').evaluate(video => {
    Object.defineProperty(video,'duration',{configurable:true,value:7202});
    Object.defineProperty(video,'currentTime',{configurable:true,writable:true,value:3661});
    video.dispatchEvent(new Event('durationchange'));
    video.dispatchEvent(new Event('timeupdate'));
  });
  await expect(viewport.getByText('1:01:01 / 2:00:02')).toBeVisible();
  await page.getByRole('button',{name:'Vidéo suivante'}).click();
  await expect(viewport.locator('video')).toHaveCount(2);
  await expect(viewport.locator('.km-reel-playback:not([aria-hidden="true"]) video')).toHaveAttribute('src',/\/second$/);
  await expect(viewport.locator('.km-reel-playback[aria-hidden="true"] video')).toHaveAttribute('src',/\/first$/);
  await expect(viewport.getByRole('link',{name:'@author1'})).toHaveAttribute('href','/profile/author1');
  // The reference UI intentionally omits a redundant "Voir la publication" link.
  await expect(viewport.getByRole('link',{name:'Voir la publication'})).toHaveCount(0);
  await expect(viewport.getByRole('link',{name:'Ouvrir les commentaires'}).last())
    .toHaveAttribute('href','/feed/post-2#km-post-comments');
});
