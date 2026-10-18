import {expect,test} from '@playwright/test';

const self={id:'me',displayName:'Testeur',username:'testeur',email:'test@example.test'};
const peer={id:'peer',displayName:'Alice',username:'alice'};
async function conversation(page:import('@playwright/test').Page){
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','voice-preview-e2e-token');
    localStorage.setItem('knowme-locale','fr');
    // Deterministic browser audio: no microphone permission or real audio is requested by this test.
    Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,
      value:async()=>({getTracks:()=>[{stop:()=>undefined}]})});
    class FakeAudioContext {
      sampleRate=48000;
      destination={};
      createMediaStreamSource(){return{connect(){},disconnect(){}};}
      createScriptProcessor(){
        const processor:{onaudioprocess:((event:{inputBuffer:{getChannelData:()=>Float32Array}})=>void)|null;
          connect:()=>void;disconnect:()=>void}={onaudioprocess:null,connect(){},disconnect(){}};
        const timer=setInterval(()=>{
          if(processor.onaudioprocess)processor.onaudioprocess({
            inputBuffer:{getChannelData:()=>new Float32Array(4096).fill(.15)}
          });
        },14);
        processor.disconnect=()=>clearInterval(timer);
        return processor;
      }
      createGain(){return{gain:{value:0},connect(){},disconnect(){}};}
      resume(){return Promise.resolve();}
      close(){return Promise.resolve();}
    }
    Object.defineProperty(window,'AudioContext',{configurable:true,value:FakeAudioContext});
  });
  await page.route('**/api/knowme/users/me',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify(self)
  }));
  await page.route('**/api/knowme/i18n/preferences',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({locale:'fr',direction:'ltr',source:'user',version:1,persisted:true})
  }));
  await page.route('**/api/knowme/appearance**',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({preference:{effectiveThemeKey:'system'}})
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
    status:200,contentType:'application/json',body:JSON.stringify({
      items:[],nextCursor:null,readStates:[
        {userId:'me',lastReadAt:'2026-10-11T10:00:00.000Z',user:self},
        {userId:'peer',lastReadAt:'2026-10-11T10:00:00.000Z',user:peer}
      ]
    })
  }));
  await page.goto('/messages/chat-1');
}
test('voice recording stops into local preview without sending, then discard',async({page})=>{
  await conversation(page);
  let sentRequests=0;
  await page.route('**/api/knowme/media/uploads**',route=>{sentRequests++;return route.abort();});
  await page.getByRole('button',{name:'Enregistrer une note vocale'}).click();
  const dialog=page.getByRole('dialog',{name:'Note vocale'});
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(250);
  await dialog.getByRole('button',{name:'Terminer'}).click();
  await expect(dialog.getByRole('button',{name:'Envoyer le vocal'})).toBeVisible();
  await expect(dialog.locator('audio')).toBeVisible();
  expect(sentRequests).toBe(0);
  await dialog.getByRole('button',{name:'Supprimer',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  expect(sentRequests).toBe(0);
});
test('explicit send is required after recording and preview',async({page})=>{
  await conversation(page);
  let createdUploads=0;
  await page.route('**/api/knowme/media/uploads',route=>{
    createdUploads++;
    return route.fulfill({status:201,contentType:'application/json',
      body:JSON.stringify({id:'voice-upload',uploadToken:'fake-test-token'})});
  });
  await page.route('**/api/knowme/media/uploads/voice-upload/complete',route=>
    route.fulfill({status:201,contentType:'application/json',
      body:JSON.stringify({id:'voice-asset',status:'AVAILABLE'})}));
  await page.route('**/api/knowme/conversations/chat-1/media-messages',route=>
    route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({
      id:'voice-message',conversationId:'chat-1',senderId:'me',sender:self,content:'',
      createdAt:'2026-10-18T14:10:00.000Z',
      presentation:{kind:'AUDIO',assetId:'voice-asset',mimeType:'audio/wav'}
    })}));
  await page.getByRole('button',{name:'Enregistrer une note vocale'}).click();
  const dialog=page.getByRole('dialog',{name:'Note vocale'});
  await page.waitForTimeout(250);
  await dialog.getByRole('button',{name:'Terminer'}).click();
  await expect(dialog.locator('audio')).toBeVisible();
  expect(createdUploads).toBe(0);
  await dialog.getByRole('button',{name:'Envoyer le vocal'}).click();
  await expect(dialog).toHaveCount(0);
  expect(createdUploads).toBe(1);
});
