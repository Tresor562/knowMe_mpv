import {expect,test} from '@playwright/test';

test.use({serviceWorkers:'block'});

test('Reels share sheet sends an authorized conversation message and reports the original Reel',async({page})=>{
  const written:Array<{method:string;path:string;payload:Record<string,unknown>}>=[];
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','reels-sharing-test');
    localStorage.setItem('knowme-locale','fr');
  });
  await page.route('**/api/knowme/**',async route=>{
    const request=route.request();
    const path=new URL(request.url()).pathname;
    if(request.method()==='POST'){
      written.push({method:'POST',path,payload:request.postDataJSON() as Record<string,unknown>});
      await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({id:'created'})});
      return;
    }
    let payload:unknown={};
    if(path.endsWith('/users/me'))payload={id:'reader',username:'reader',displayName:'Reader'};
    else if(path.endsWith('/posts/videos'))payload=[{
      id:'reel-post-1',content:'Une vidéo originale',createdAt:'2026-10-20T10:00:00Z',
      author:{id:'author',username:'author',displayName:'Auteur'},
      _count:{likes:5,comments:1},
      media:[{url:'/media/public/post/reel1',mimeType:'video/mp4',position:0}]
    }];
    else if(path.endsWith('/conversations'))payload=[
      {id:'chat-1',title:'Alice',isGroup:false,members:[
        {userId:'reader',user:{id:'reader',username:'reader',displayName:'Moi'}},
        {userId:'alice',user:{id:'alice',username:'alice',displayName:'Alice'}}
      ]}
    ];
    else if(path.endsWith('/appearance'))payload={preference:{effectiveThemeKey:'system'},themes:[]};
    else if(path.endsWith('/i18n/preferences'))payload={locale:'fr',direction:'ltr'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
  });

  await page.goto('/reels');
  const share=page.getByRole('button',{name:'Partager la vidéo'});
  await expect(share).toBeVisible();
  await share.click();
  const sheet=page.getByRole('dialog',{name:'Partager le Reel'});
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('Alice',{exact:true})).toBeVisible();
  await sheet.getByRole('button',{name:'Alice'}).click();
  await sheet.getByPlaceholder('Ajouter un message (facultatif)').fill('Regarde cette vidéo');
  await sheet.getByRole('button',{name:'Envoyer',exact:true}).click();
  await expect(sheet).not.toBeVisible();
  expect(written[0]?.path).toMatch(/\/conversations\/chat-1\/messages$/);
  expect(String(written[0]?.payload.content)).toContain('Regarde cette vidéo');
  expect(String(written[0]?.payload.content)).toContain('/feed/reel-post-1');

  await share.click();
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button',{name:'Signaler ce Reel'}).click();
  await sheet.getByRole('button',{name:'Spam ou arnaque'}).click();
  await sheet.getByRole('button',{name:'Envoyer le signalement'}).click();
  await expect(sheet.getByText('Signalement envoyé.')).toBeVisible();
  expect(written[1]).toMatchObject({path:expect.stringMatching(/\/reports$/),
    payload:{targetType:'POST',targetId:'reel-post-1',reason:'Spam ou arnaque'}});
  await page.keyboard.press('Escape');
  await expect(sheet).not.toBeVisible();

  await share.click();
  await sheet.getByRole('button',{name:'Ma Story'}).click();
  await sheet.getByRole('button',{name:'Amis'}).click();
  await expect(sheet).not.toBeVisible();
  expect(written[2]).toMatchObject({path:expect.stringMatching(/\/stories$/),
    payload:{type:'LINK',audience:'FRIENDS'}});
});
