import {expect,test} from '@playwright/test';

test.use({serviceWorkers:'block'});

test('double-tapping an already-liked reel does not unlike it',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','doubletap-test-token');
    localStorage.setItem('knowme-locale','fr');
  });
  let puts=0;
  let toggles=0;
  await page.route('**/api/knowme/**',async route=>{
    const req=route.request();
    const path=new URL(req.url()).pathname;
    let data:unknown={};
    if(path.endsWith('/users/me')){
      data={id:'viewer',username:'viewer',displayName:'Viewer'};
    }else if(path.endsWith('/posts/videos')){
      data=[{
        id:'post1',content:'Test video',
        author:{id:'other',username:'other',displayName:'Other'},
        createdAt:'2026-10-18T08:00:00Z',
        _count:{likes:2,comments:0},
        media:[{url:'/media/public/post/video1',position:0,mimeType:'video/mp4'}]
      }];
    }else if(path.endsWith('/posts/post1/like')){
      if(req.method()==='PUT')puts++;
      if(req.method()==='POST')toggles++;
      data={liked:true,count:3};
    }else if(path.endsWith('/appearance')){
      data={preference:{effectiveThemeKey:'system'},themes:[]};
    }else if(path.endsWith('/i18n/preferences')){
      data={locale:'fr',direction:'ltr'};
    }
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });

  await page.goto('/reels');
  await expect(page.locator('.km-reel-tap-zone')).toBeVisible();
  await page.locator('.km-reel-tap-zone').dblclick();
  await expect.poll(()=>puts).toBe(1);
  expect(toggles).toBe(0);
  await expect(page.getByRole('button',{name:'Réagir à la publication'})).toContainText('3');
  await page.locator('.km-reel-tap-zone').dblclick();
  await page.waitForTimeout(380);
  expect(puts).toBe(1);
  expect(toggles).toBe(0);
});
