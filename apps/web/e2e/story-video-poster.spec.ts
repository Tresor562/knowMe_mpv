import { expect, test } from '@playwright/test';

test.use({serviceWorkers:'block'});

test('video stories show an authenticated static poster without requesting the video',async ({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','story-cover-e2e-token');
    localStorage.setItem('knowme-locale','fr');
  });
  let thumbnails=0;
  let fullVideos=0;
  await page.route('**/api/knowme/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if (path.endsWith('/stories/video-story/thumbnail')) {
      thumbnails+=1;
      await route.fulfill({
        status:200,contentType:'image/png',
        body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScfOZAAAAABJRU5ErkJggg==','base64')
      });
      return;
    }
    if (path.endsWith('/stories/video-story/media')) {
      fullVideos+=1;
      await route.fulfill({status:403,body:'Video should not be preloaded'});
      return;
    }
    let data:unknown={};
    if(path.endsWith('/users/me'))data={id:'me',username:'me',displayName:'Moi'};
    else if(path.endsWith('/posts/feed'))data=[];
    else if(path.endsWith('/stories/rail'))data={
      nextOffset:null,groups:[{
        count:1,story:{
          id:'video-story',type:'VIDEO',assetId:'video-big',
          thumbnailAssetId:'safe-poster',
          viewer:{own:false},
          author:{id:'video-author',username:'videoauthor',displayName:'Artiste',avatarUrl:null}
        }
      }]
    };
    else if(path.endsWith('/media/public/post-capabilities'))data={publicPostImage:false};
    else if(path.endsWith('/appearance'))data={preference:{effectiveThemeKey:'system'},themes:[]};
    else if(path.endsWith('/i18n/preferences'))data={locale:'fr',direction:'ltr'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/feed');
  const cover=page.locator('.km-story-card').filter({hasText:'Artiste'}).locator('.km-story-card-cover img');
  await expect(cover).toHaveAttribute('src',/^blob:/);
  expect(thumbnails).toBe(1);
  expect(fullVideos).toBe(0);
});
