import { expect, test } from '@playwright/test';

test.use({serviceWorkers:'block'});

function postMedia(index:number) {
  return {url:`/media/public/post/media-${index}`,
    mimeType:index===3?'video/mp4':'image/png',position:index};
}

test('publications show all media in a collage and open an accessible viewer',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','media-e2e-token');
    localStorage.setItem('knowme-locale','fr');
  });
  const post={id:'post-one',content:'Six fichiers',createdAt:'2026-10-18T04:00:00Z',
    author:{id:'someone',username:'someone',displayName:'Un membre',avatarUrl:null},
    imageUrl:'/media/public/post/media-0',
    _count:{likes:0,comments:0},
    media:Array.from({length:6},(_,i)=>postMedia(i))};
  await page.route('**/api/knowme/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    const mockImage=path.includes('/media/public/post/');
    const data=path.endsWith('/users/me')
      ? {id:'user-one',username:'user',displayName:'User'}
      :path.endsWith('/posts/feed')?[post]
      :path.endsWith('/stories/rail')?{groups:[],nextOffset:null}
      :path.endsWith('/appearance')?{preference:{effectiveThemeKey:'system'},themes:[]}
      :path.endsWith('/i18n/preferences')?{locale:'fr',direction:'ltr'}
      :{};
    await route.fulfill(mockImage
      ? {status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXkMAAAAASUVORK5CYII=','base64')}
      :{status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/feed');
  const mosaic=page.locator('.km-post-collage');
  await expect(mosaic).toBeVisible();
  await expect(mosaic.locator('button.km-post-collage-tile')).toHaveCount(5);
  await expect(mosaic.locator('.km-post-collage-more')).toHaveText('+1');
  await mosaic.getByRole('button',{name:'Ouvrir le média 1 sur 6'}).click();
  const viewer=page.getByRole('dialog',{name:'Galerie de la publication'});
  await expect(viewer).toBeVisible();
  await expect(viewer.locator('.km-post-media-viewer-counter')).toHaveText('1 / 6');
  await page.keyboard.press('ArrowRight');
  await expect(viewer.locator('.km-post-media-viewer-counter')).toHaveText('2 / 6');
  await page.keyboard.press('Escape');
  await expect(viewer).not.toBeVisible();
});

test('post composer uploads two photos and creates an image-only post in order',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','media-upload-e2e-token');
    localStorage.setItem('knowme-locale','fr');
  });
  let uploadIndex=0;
  let posted:Record<string,unknown>|null=null;
  await page.route('**/api/knowme/**',async route=>{
    const request=route.request();
    const path=new URL(request.url()).pathname;
    if(request.method()==='POST' && path.endsWith('/media/uploads')){
      uploadIndex+=1;
      await route.fulfill({status:201,contentType:'application/json',
        body:JSON.stringify({id:`session-${uploadIndex}`,uploadToken:'token'})});
      return;
    }
    if(request.method()==='POST' && /\/media\/uploads\/session-\d+\/complete$/.test(path)){
      const index=Number(path.match(/session-(\d+)/)?.[1]??0);
      await route.fulfill({status:201,contentType:'application/json',
        body:JSON.stringify({id:`asset-${index}`,status:'AVAILABLE'})});
      return;
    }
    if(request.method()==='POST' && path.endsWith('/posts')){
      posted=request.postDataJSON() as Record<string,unknown>;
      await route.fulfill({status:201,contentType:'application/json',body:'{"id":"posted"}'});
      return;
    }
    const data=path.endsWith('/users/me')
      ? {id:'user-one',username:'user',displayName:'User'}
      :path.endsWith('/posts/feed')?[]
      :path.endsWith('/media/public/post-capabilities')?{publicPostImage:true}
      :path.endsWith('/stories/rail')?{groups:[],nextOffset:null}
      :path.endsWith('/appearance')?{preference:{effectiveThemeKey:'system'},themes:[]}
      :path.endsWith('/i18n/preferences')?{locale:'fr',direction:'ltr'}
      :{};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/feed');
  await page.getByRole('button',{name:'Ouvrir l’éditeur'}).click();
  const dialog=page.getByRole('dialog',{name:'Créer une publication'});
  await expect(dialog).toBeVisible();
  await page.getByLabel('Sélectionner plusieurs photos et vidéos').setInputFiles([
    {name:'photo-1.png',mimeType:'image/png',buffer:Buffer.alloc(2048,1)},
    {name:'photo-2.png',mimeType:'image/png',buffer:Buffer.alloc(2048,2)}
  ]);
  await expect(dialog.getByText('Pièces jointes (2)')).toBeVisible();
  await dialog.getByRole('button',{name:'Publier'}).first().click();
  await expect(dialog).not.toBeVisible();
  expect(posted).toEqual({content:'',mediaAssetIds:['asset-1','asset-2']});
});
