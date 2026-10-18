import {expect,test} from '@playwright/test';
test.use({serviceWorkers:'block'});
test('Friends: sent request is shown, add is disabled and cancellation is persisted',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','friends-sent-test');
    localStorage.setItem('knowme-locale','fr');
  });
  const target={id:'other',username:'other',displayName:'Ami cible'};
  let sent=true;
  let cancellations=0;
  await page.route('**/api/knowme/**',async route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    let data:unknown={};
    if(path.endsWith('/users/me'))data={id:'me',username:'me',displayName:'Moi'};
    else if(path.endsWith('/social/friend-requests/incoming'))data=[];
    else if(path.endsWith('/social/friend-requests/outgoing'))data=sent?[{id:'request1',addressee:target}]:[];
    else if(path.endsWith('/social/friends'))data=[];
    else if(path.endsWith('/social/search'))data=[target];
    else if(path.endsWith('/social/friend-requests/request1')&&req.method()==='DELETE'){
      sent=false;cancellations++;data={removed:true};
    }
    else if(path.endsWith('/appearance'))data={preference:{effectiveThemeKey:'system'},themes:[]};
    else if(path.endsWith('/i18n/preferences'))data={locale:'fr',direction:'ltr'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/friends');
  await expect(page.getByRole('heading',{name:'Demandes envoyées (1)'})).toBeVisible();
  await page.getByPlaceholder('Nom, pseudo ou centre d’intérêt...').fill('other');
  await page.getByRole('button',{name:'Rechercher'}).click();
  await expect(page.getByRole('button',{name:'En attente'})).toBeDisabled();
  await page.getByRole('button',{name:'Annuler la demande'}).click();
  await expect.poll(()=>cancellations).toBe(1);
  await expect(page.getByRole('heading',{name:'Demandes envoyées (1)'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Ajouter'})).toBeEnabled();
});
