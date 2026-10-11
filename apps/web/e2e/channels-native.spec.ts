import { expect, test, type Page } from '@playwright/test';

async function session(page:Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('knowme_token','channels-test-token');
    window.localStorage.setItem('knowme-locale','fr');
  });
  await page.route('**/api/knowme/users/me', route => route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({id:'me',username:'owner',displayName:'Owner',email:'owner@example.test'})
  }));
  await page.route('**/api/knowme/i18n/preferences', route => route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({locale:'fr',direction:'ltr',source:'user',version:1,persisted:true,updatedAt:'2026-10-11T00:00:00.000Z'})
  }));
  await page.route('**/api/knowme/appearance**', route => route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({preference:{effectiveThemeKey:'system'}})
  }));
}

test('mobile channel creation publishes through real endpoints and opens owner composer', async ({page}) => {
  await session(page);
  await page.setViewportSize({width:360,height:760});
  const channel={
    id:'mychannel',name:'Actualités KnowMe',username:'knowme_news',description:'Une chaîne de test',
    visibility:'PUBLIC',ownerId:'me',createdAt:'2026-10-11T00:00:00.000Z',following:true,
    owner:{username:'owner',displayName:'Owner',avatarUrl:null},_count:{subscriptions:1,posts:0}
  };
  let creationBody:unknown=null;
  let publicationBody:unknown=null;
  await page.route('**/api/knowme/channels', async route => {
    if (route.request().method()==='POST') {
      creationBody=route.request().postDataJSON();
      return route.fulfill({status:201,contentType:'application/json',body:JSON.stringify(channel)});
    }
    return route.fulfill({status:200,contentType:'application/json',body:'[]'});
  });
  await page.route('**/api/knowme/channels/mychannel', route => route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify(channel)
  }));
  await page.route('**/api/knowme/channels/mychannel/posts', async route => {
    if(route.request().method()==='POST'){
      publicationBody=route.request().postDataJSON();
      return route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({
        id:'post1',channelId:'mychannel',content:'Bonjour aux abonnés',
        createdAt:'2026-10-11T00:00:00.000Z',author:{displayName:'Owner',username:'owner'}
      })});
    }
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items:[],nextCursor:null})});
  });
  await page.goto('/channels/new');
  await page.getByRole('textbox',{name:'Nom de la chaîne'}).fill('Actualités KnowMe');
  await page.getByRole('textbox',{name:'Description (facultatif)'}).fill('Une chaîne de test');
  await page.getByRole('textbox',{name:'Identifiant public (facultatif)'}).fill('knowme_news');
  await page.getByRole('button',{name:'Créer la chaîne'}).click();
  await expect(page).toHaveURL(/\/channels\/mychannel$/);
  await expect(page.getByRole('heading',{name:'Actualités KnowMe'}).first()).toBeVisible();
  expect(creationBody).toMatchObject({name:'Actualités KnowMe',username:'knowme_news',visibility:'PUBLIC'});
  await page.getByRole('textbox',{name:'Nouvelle publication'}).fill('Bonjour aux abonnés');
  await page.getByRole('button',{name:'Publier'}).click();
  await expect(page.getByText('Bonjour aux abonnés')).toBeVisible();
  expect(publicationBody).toMatchObject({content:'Bonjour aux abonnés'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1)).toBe(false);
});
