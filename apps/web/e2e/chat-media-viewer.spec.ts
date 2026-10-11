import { expect, test } from '@playwright/test';

const self = {id:'me',displayName:'Testeur',username:'testeur',email:'test@example.test'};
const peer = {id:'peer',displayName:'Alice',username:'alice'};
// Small local PNG: no external image URL or real user asset is required.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Ylc9yIAAAAASUVORK5CYII=',
  'base64'
);

test('mobile chat images open a private full-screen viewer and restore focus', async ({page})=>{
  await page.setViewportSize({width:360,height:760});
  await page.addInitScript(()=>{
    window.localStorage.setItem('knowme_token','media-viewer-e2e-token');
    window.localStorage.setItem('knowme-locale','fr');
  });
  await page.route('**/api/knowme/users/me',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify(self)
  }));
  await page.route('**/api/knowme/i18n/preferences',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({locale:'fr',direction:'ltr',source:'user',version:1,persisted:true})
  }));
  await page.route('**/api/knowme/appearance**',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({preference:{effectiveThemeKey:'system'}})
  }));
  await page.route('**/api/knowme/conversations',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify([{id:'chat-1',title:null,isGroup:false,members:[{userId:'me'},{userId:'peer'}]}])
  }));
  await page.route('**/api/knowme/conversations/chat-1/read',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({userId:'me',lastReadAt:'2026-10-11T10:00:00.000Z',unread:0})
  }));
  await page.route('**/api/knowme/conversations/chat-1/messages**',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({
      items:[{
        id:'message-image',conversationId:'chat-1',content:'',senderId:'peer',
        sender:peer,createdAt:'2026-10-11T10:00:00.000Z',
        presentation:{kind:'IMAGE',assetId:'img-1',mimeType:'image/png',fileName:'photo.png'}
      }],
      nextCursor:null,
      readStates:[
        {userId:'me',lastReadAt:'2026-10-11T10:00:00.000Z',user:self},
        {userId:'peer',lastReadAt:'2026-10-11T10:00:00.000Z',user:peer}
      ]
    })
  }));
  await page.route('**/api/knowme/media/img-1/download-grant',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({path:'/media/img-1/blob'})
  }));
  await page.route('**/api/knowme/media/img-1/blob',route=>route.fulfill({
    status:200,contentType:'image/png',body:png
  }));

  await page.goto('/messages/chat-1');
  const preview = page.getByRole('button',{name:"Agrandir l'image"});
  await expect(preview).toBeVisible();
  await preview.click();
  const viewer = page.getByRole('dialog',{name:'Visionneuse de médias'});
  await expect(viewer).toBeVisible();
  await expect(viewer.getByRole('img',{name:'Image'})).toBeVisible();
  await expect(viewer.getByRole('link',{name:'Télécharger le média'})).toHaveAttribute('download','photo.png');
  await expect(page.locator('body')).toHaveCSS('overflow','hidden');
  await page.keyboard.press('Escape');
  await expect(viewer).toHaveCount(0);
  await expect(preview).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('overflow','hidden');
});
