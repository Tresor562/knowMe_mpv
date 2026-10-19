import { test, expect } from '@playwright/test';

const tinyPng=Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==',
  'base64'
);

async function setup(page: import('@playwright/test').Page, role:'ADMIN'|'MEMBER'='ADMIN') {
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','group-photo-e2e');
    localStorage.setItem('knowme-locale','fr');
  });
  let photo=false;
  let uploads=0;
  await page.route('**/api/knowme/**',async route=>{
    const {pathname}=new URL(route.request().url());
    const method=route.request().method();
    const json=(data:unknown,status=200)=>route.fulfill({
      status,contentType:'application/json',body:JSON.stringify(data)
    });
    if(pathname.endsWith('/users/me'))
      return json({id:'me',username:'moi',displayName:'Moi',email:'me@example.test'});
    if(pathname.endsWith('/i18n/preferences'))
      return json({locale:'fr',direction:'ltr',source:'user',version:1});
    if(pathname.endsWith('/conversations'))
      return json([{id:'group-1',title:'Club de sciences',description:'Discussions et révisions',
        isGroup:true,members:[
          {userId:'me',role,user:{id:'me',username:'moi',displayName:'Moi',avatarUrl:null}},
          {userId:'other',role:'OWNER',
            user:{id:'other',username:'autre',displayName:'Autre',avatarUrl:null}}
        ]}]);
    if(pathname.endsWith('/conversations/group-1/group/avatar/capabilities'))
      return json({read:true,canEdit:role==='ADMIN',maxBytes:5242880,
        allowedMime:['image/jpeg','image/png','image/webp']});
    if(pathname.endsWith('/conversations/group-1/group/avatar')){
      if(method==='GET')return photo
        ? route.fulfill({status:200,contentType:'image/png',body:tinyPng})
        : json({code:'GROUP_AVATAR_NOT_FOUND'},404);
      if(method==='PATCH'){
        const body=route.request().postDataJSON();
        if(body.mediaAssetId!=='asset-good')return json({code:'BAD_ASSET'},400);
        photo=true;return json({updated:true,conversationId:'group-1'});
      }
      if(method==='DELETE'){photo=false;return json({removed:true});}
    }
    if(pathname.endsWith('/media/uploads')&&method==='POST'){
      uploads++;return json({id:'session-1',uploadToken:'test-session-token'});
    }
    if(pathname.endsWith('/media/uploads/session-1/complete')&&method==='POST')
      return json({id:'asset-good',status:'AVAILABLE',scannerVerdict:'CLEAN'});
    if(pathname.endsWith('/notifications/center'))return json({items:[],totals:{unread:0}});
    if(pathname.endsWith('/notifications/unread-count'))return json({count:0});
    return json({});
  });
  return {uploads:()=>uploads,hasPhoto:()=>photo};
}

test('group administrator can upload, preview, and remove a private group photo',async({page})=>{
  const state=await setup(page);
  await page.setViewportSize({width:360,height:760});
  await page.goto('/messages/group-1/info');
  await expect(page.getByRole('heading',{name:'Club de sciences'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'À propos du groupe'})).toBeVisible();
  const change=page.getByRole('button',{name:'Changer la photo du groupe'});
  await expect(change).toBeVisible();
  await page.locator('input[aria-label="Choisir une photo du groupe"]').setInputFiles({
    name:'club.png',mimeType:'image/png',buffer:Buffer.concat([tinyPng,Buffer.alloc(1024)])
  });
  const editor=page.getByRole('dialog',{name:'Recadrer la photo du groupe'});
  await expect(editor).toBeVisible();
  expect(state.uploads()).toBe(0); // cropping is local until explicit confirmation
  await editor.getByRole('slider',{name:'Agrandir ou réduire la photo'}).fill('1.5');
  await expect(editor.getByText('1.50×')).toBeVisible();
  await editor.getByRole('button',{name:'Recentrer'}).click();
  await expect(editor.getByText('1.00×')).toBeVisible();
  await editor.getByRole('button',{name:'Terminé'}).click();
  await expect(editor).toHaveCount(0);
  await expect(page.getByRole('status').filter({hasText:'Photo du groupe enregistrée.'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Voir la photo du groupe'})).toBeVisible();
  expect(state.uploads()).toBe(1);
  expect(state.hasPhoto()).toBe(true);
  await page.getByRole('button',{name:'Voir la photo du groupe'}).click();
  await expect(page.getByRole('dialog',{name:'Photo du groupe'})).toBeVisible();
  await page.getByRole('button',{name:'Fermer'}).click();
  await page.getByRole('button',{name:'Retirer la photo'}).click();
  await expect(page.getByRole('dialog',{name:'Confirmation'})).toBeVisible();
  await page.getByRole('dialog',{name:'Confirmation'}).getByRole('button',{name:'Confirmer'}).click();
  await expect(page.getByRole('button',{name:'Avatar de groupe par défaut'})).toBeVisible();
  expect(state.hasPhoto()).toBe(false);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
});

test('ordinary group member sees avatar but cannot upload or remove it',async({page})=>{
  const state=await setup(page,'MEMBER');
  await page.goto('/messages/group-1/info');
  await expect(page.getByRole('heading',{name:'Club de sciences'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Changer la photo du groupe'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Retirer la photo'})).toHaveCount(0);
  expect(state.uploads()).toBe(0);
});

test('group info uses a distinct sidebar and a content pane on desktop',async({page})=>{
  await setup(page);
  await page.setViewportSize({width:1280,height:830});
  await page.goto('/messages/group-1/info');
  await expect(page.getByRole('heading',{name:'À propos du groupe'})).toBeVisible();
  const values=await page.evaluate(()=>{
    const left=document.querySelector('.km-group-sidebar')!.getBoundingClientRect();
    const right=document.querySelector('.km-group-main-pane')!.getBoundingClientRect();
    return {leftRight:left.right,rightLeft:right.left,viewport:document.documentElement.scrollWidth};
  });
  expect(values.rightLeft).toBeGreaterThan(values.leftRight);
  expect(values.viewport).toBeLessThanOrEqual(1281);
});


test('cancel and Escape discard local edits without uploading any photo',async({page})=>{
  const state=await setup(page);
  await page.goto('/messages/group-1/info');
  const file=page.locator('input[aria-label="Choisir une photo du groupe"]');
  await file.setInputFiles({name:'club.png',mimeType:'image/png',
    buffer:Buffer.concat([tinyPng,Buffer.alloc(1024)])});
  const editor=page.getByRole('dialog',{name:'Recadrer la photo du groupe'});
  await expect(editor).toBeVisible();
  await editor.getByRole('button',{name:'Annuler le recadrage'}).click();
  await expect(editor).toHaveCount(0);
  expect(state.uploads()).toBe(0);
  expect(state.hasPhoto()).toBe(false);
  await file.setInputFiles({name:'club.png',mimeType:'image/png',
    buffer:Buffer.concat([tinyPng,Buffer.alloc(1024)])});
  await expect(editor).toBeVisible();
  await editor.getByRole('slider',{name:'Agrandir ou réduire la photo'}).fill('2');
  await page.keyboard.press('Escape');
  await expect(editor).toHaveCount(0);
  expect(state.uploads()).toBe(0);
  expect(state.hasPhoto()).toBe(false);
});

test('group crop preview supports accessible keyboard movement and has no mobile overflow',async({page})=>{
  const state=await setup(page);
  await page.setViewportSize({width:360,height:760});
  await page.goto('/messages/group-1/info');
  await page.locator('input[aria-label="Choisir une photo du groupe"]').setInputFiles({
    name:'club.png',mimeType:'image/png',buffer:Buffer.concat([tinyPng,Buffer.alloc(1024)])
  });
  const editor=page.getByRole('dialog',{name:'Recadrer la photo du groupe'});
  await expect(editor).toBeVisible();
  await editor.getByRole('img',{name:'Photo à recadrer, déplaçable avec les flèches'}).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await editor.getByRole('slider',{name:'Agrandir ou réduire la photo'}).fill('2');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  expect(state.uploads()).toBe(0);
});


test('crop frame remains fully usable without horizontal scrolling at 320px',async({page})=>{
  const state=await setup(page);
  await page.setViewportSize({width:320,height:640});
  await page.goto('/messages/group-1/info');
  await page.locator('input[aria-label="Choisir une photo du groupe"]').setInputFiles({
    name:'club.png',mimeType:'image/png',buffer:Buffer.concat([tinyPng,Buffer.alloc(1024)])
  });
  const editor=page.getByRole('dialog',{name:'Recadrer la photo du groupe'});
  await expect(editor).toBeVisible();
  await expect(editor.getByRole('button',{name:'Terminé'})).toBeEnabled();
  const widths=await editor.evaluate(element=>{
    const body=element.querySelector('.km-group-crop-body') as HTMLElement;
    const viewport=element.querySelector('.km-group-crop-viewport') as HTMLElement;
    const outer=element.querySelector('.km-group-avatar-crop-panel') as HTMLElement;
    const frame=viewport.getBoundingClientRect();
    const panel=outer.getBoundingClientRect();
    return {clientWidth:body.clientWidth,scrollWidth:body.scrollWidth,
      frameWidth:frame.width,frameLeft:frame.left,frameRight:frame.right,
      panelLeft:panel.left,panelRight:panel.right};
  });
  expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth+1);
  expect(widths.frameWidth).toBe(288);
  expect(widths.frameLeft).toBeGreaterThanOrEqual(widths.panelLeft);
  expect(widths.frameRight).toBeLessThanOrEqual(widths.panelRight);
  expect(state.uploads()).toBe(0);
  await editor.getByRole('button',{name:'Annuler le recadrage'}).click();
  expect(state.uploads()).toBe(0);
});
