import {expect,test} from '@playwright/test';
test.use({serviceWorkers:'block'});

test('private saved posts library is reachable, persists and removes only on API success',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','library-test-token');
    localStorage.setItem('knowme-locale','fr');
  });
  let saved=true,removeCalls=0;
  await page.route('**/api/knowme/**',async route=>{
    const request=route.request();
    const path=new URL(request.url()).pathname;
    let response:unknown={};
    if(path.endsWith('/users/me'))response={id:'reader',username:'reader',displayName:'Lecteur'};
    else if(path.endsWith('/posts/saved')){
      response=saved?[{postId:'post-2026',createdAt:'2026-10-21T12:00:00Z'}]:[];
    }else if(path.endsWith('/posts/post-2026/save')&&request.method()==='DELETE'){
      removeCalls++;saved=false;response={saved:false};
    }else if(path.endsWith('/i18n/preferences'))response={locale:'fr',direction:'ltr'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
  });
  await page.goto('/saved-posts');
  await expect(page.getByRole('heading',{name:'Publications enregistrées'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Voir la publication'})).toHaveAttribute('href','/feed/post-2026');
  await page.reload();
  await expect(page.getByRole('link',{name:'Voir la publication'})).toBeVisible();
  await page.getByRole('button',{name:'Retirer'}).click();
  await expect(page.getByText('Aucune publication enregistrée.',{exact:false})).toBeVisible();
  expect(removeCalls).toBe(1);
});

test('server error must not be represented as an empty library',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','library-test-token');
    localStorage.setItem('knowme-locale','fr');
  });
  await page.route('**/api/knowme/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith('/posts/saved')){
      await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Service indisponible'})});
    }else{
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(path.endsWith('/users/me')?{id:'reader',username:'reader',displayName:'Lecteur'}:{})});
    }
  });
  await page.goto('/saved-posts');
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('Aucune publication enregistrée.',{exact:false})).toHaveCount(0);
});
