import {expect,test} from '@playwright/test';

test.use({serviceWorkers:'block'});

const samplePng=Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScfOZAAAAABJRU5ErkJggg==',
  'base64'
);

test('story rail previews real photo and text without requesting the full video',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','preview-test');
    localStorage.setItem('knowme-locale','fr');
  });
  let photos=0;
  let privateVideoDownloads=0;
  await page.route('**/api/knowme/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith('/stories/photo-1/media')){
      photos++;
      await route.fulfill({status:200,contentType:'image/png',body:samplePng});
      return;
    }
    if(path.endsWith('/stories/video-1/media')){
      privateVideoDownloads++;
      await route.fulfill({status:403,body:'No full video in rail'});
      return;
    }
    let data:unknown={};
    if(path.endsWith('/users/me'))data={id:'me',username:'me',displayName:'Moi'};
    else if(path.endsWith('/posts/feed')||path.endsWith('/posts/videos'))data=[];
    else if(path.endsWith('/stories/rail'))data={nextOffset:null,groups:[
      {count:1,story:{id:'photo-1',type:'PHOTO',assetId:'photo-asset',
        caption:'Une photo',viewer:{own:false},
        author:{id:'a',username:'photographe',displayName:'Photographe'}}},
      {count:1,story:{id:'text-1',type:'TEXT',caption:'Ma belle journée à la plage',
        viewer:{own:false},author:{id:'b',username:'auteur',displayName:'Auteur'}}}
    ]};
    else if(path.endsWith('/appearance'))data={preference:{effectiveThemeKey:'system'},themes:[]};
    else if(path.endsWith('/i18n/preferences'))data={locale:'fr',direction:'ltr'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/feed');
  const photoCard=page.locator('.km-story-card').filter({hasText:'Photographe'});
  await expect(photoCard.locator('.km-story-card-cover img')).toHaveAttribute('src',/^blob:/);
  const textCard=page.locator('.km-story-card').filter({hasText:'Auteur'});
  await expect(textCard.locator('.km-story-text-cover')).toContainText('Ma belle journée à la plage');
  expect(photos).toBe(1);
  expect(privateVideoDownloads).toBe(0);
});

test('video publications keep a tappable real-frame preview slot instead of a generic video label',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','preview-test');
    localStorage.setItem('knowme-locale','fr');
  });
  await page.route('**/api/knowme/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    const post={id:'video-post',content:'Vidéo partagée',createdAt:'2026-10-21T12:00:00Z',
      author:{id:'a',username:'creator',displayName:'Créateur'},
      _count:{likes:0,comments:0},
      media:[{url:'/media/public/post/video-asset',mimeType:'video/mp4',position:0}]};
    const data=path.endsWith('/users/me')?{id:'me',username:'me',displayName:'Moi'}:
      path.endsWith('/posts/feed')?[post]:
      path.endsWith('/posts/videos')?[]:
      path.endsWith('/stories/rail')?{groups:[],nextOffset:null}:
      path.endsWith('/appearance')?{preference:{effectiveThemeKey:'system'},themes:[]}:
      path.endsWith('/i18n/preferences')?{locale:'fr',direction:'ltr'}:{};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/feed');
  const tile=page.getByRole('button',{name:'Ouvrir le média 1 sur 1'});
  await expect(tile.locator('.km-post-collage-poster')).toHaveCount(1);
  await expect(tile.locator('.km-post-collage-video-play')).toHaveCount(1);
  await expect(tile.locator('video')).toHaveCount(0);
  // A cover rendered with absolute positioning must still reserve real
  // portrait space in the feed; a zero-height grid cannot receive taps.
  await expect(tile).toBeVisible();
  const box=await tile.boundingBox();
  expect(box?.height??0).toBeGreaterThan(150);
  await tile.click();
  await expect(page.getByRole('dialog',{name:'Galerie de la publication'})).toBeVisible();
});
