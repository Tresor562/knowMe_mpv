import {expect,test} from '@playwright/test';
test.use({serviceWorkers:'block'});

test('Reference Reels tabs, follows and direct comments use real API routes',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','reference-reels-test');
    localStorage.setItem('knowme-locale','fr');
  });
  let follows=0,comments=0,followingFeed=0;
  const post={id:'post-1',content:'Vidéo amusante #funny',
    createdAt:'2026-10-20T09:00:00Z',
    author:{id:'creator-1',username:'creator',displayName:'Créateur'},
    _count:{likes:3,comments:1},
    media:[{url:'/media/public/post/asset-1',mimeType:'video/mp4',position:0}]};
  await page.route('**/api/knowme/**',async route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    let body:unknown={};
    if(path.endsWith('/users/me'))body={id:'viewer',username:'viewer',displayName:'Spectateur'};
    else if(path.endsWith('/posts/videos'))body=[post];
    else if(path.endsWith('/reels/following')){followingFeed++;body=[post];}
    else if(path.endsWith('/reels/likes'))body={likedPostIds:[]};
    else if(path.endsWith('/reels/creators/creator-1/follow-status'))
      body={following:follows>0,isOwner:false};
    else if(path.endsWith('/reels/creators/creator-1/follow')){
      if(req.method()==='PUT')follows++;
      body={following:true};
    }
    else if(path.endsWith('/posts/post-1/comments')){
      if(req.method()==='POST'){
        expect(req.postDataJSON()).toEqual({content:'Bravo pour cette vidéo !'});
        comments++;
      }
      body={id:'comment-1',content:'Bravo pour cette vidéo !'};
    }
    else if(path.endsWith('/appearance'))body={preference:{effectiveThemeKey:'system'},themes:[]};
    else if(path.endsWith('/i18n/preferences'))body={locale:'fr',direction:'ltr'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('/reels');
  await expect(page.getByRole('tab',{name:'Pour toi'})).toHaveAttribute('aria-selected','true');
  const follow=page.getByRole('button',{name:'Suivre'});
  await expect(follow).toBeEnabled();
  await follow.click();
  await expect.poll(()=>follows).toBe(1);
  await expect(page.getByRole('button',{name:'Ne plus suivre'})).toBeVisible();

  await page.getByRole('button',{name:'Ajouter un commentaire'}).click();
  const dialog=page.getByRole('dialog',{name:'Rédiger un commentaire'});
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox',{name:'Ton commentaire'}).fill('Bravo pour cette vidéo !');
  await dialog.getByRole('button',{name:'Publier'}).click();
  await expect.poll(()=>comments).toBe(1);
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Ouvrir les commentaires'})).toContainText('2');

  await page.getByRole('tab',{name:'Abonnements'}).click();
  await expect.poll(()=>followingFeed).toBe(1);
  await expect(page.getByRole('tab',{name:'Abonnements'})).toHaveAttribute('aria-selected','true');
  await expect(page.locator('.km-reel-video')).toHaveCount(1);
});
