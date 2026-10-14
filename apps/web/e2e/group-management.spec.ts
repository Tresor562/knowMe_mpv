import { expect, test } from '@playwright/test';

test('native group admin screen supports owner-only promotion and friends-only addition on mobile',async({page})=>{
  await page.addInitScript(()=>{
    window.localStorage.setItem('knowme_token','group-ui-e2e-token');
    window.localStorage.setItem('knowme-locale','fr');
  });
  await page.route('**/api/knowme/users/me',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({
      id:'owner',username:'owner',displayName:'Propriétaire',email:'owner@example.test'
    })
  }));
  await page.route('**/api/knowme/i18n/preferences',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({
      locale:'fr',direction:'ltr',source:'user',version:1,persisted:true,
      updatedAt:'2026-10-11T00:00:00.000Z'
    })
  }));
  await page.route('**/api/knowme/appearance**',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({preference:{effectiveThemeKey:'system'}})
  }));
  let promoted=false, added=false;
  const group=()=>({
    id:'group1',title:'Études Terminale',description:'Préparation BAC',
    viewerRole:'OWNER',memberCount:added?3:2,
    members:[
      {userId:'owner',role:'OWNER',user:{id:'owner',displayName:'Propriétaire',username:'owner',avatarUrl:null}},
      {userId:'alice',role:promoted?'ADMIN':'MEMBER',user:{id:'alice',displayName:'Alice',username:'alice',avatarUrl:null}},
      ...(added?[{userId:'bob',role:'MEMBER',user:{id:'bob',displayName:'Bob',username:'bob',avatarUrl:null}}]:[])
    ]
  });
  await page.route('**/api/knowme/conversations/group1/group',async route=>{
    if(route.request().method()==='GET')
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(group())});
    return route.fulfill({status:200,contentType:'application/json',body:'{}'});
  });
  await page.route('**/api/knowme/conversations/group1/group/members',async route=>{
    if(route.request().method()==='POST') added=true;
    await route.fulfill({status:200,contentType:'application/json',body:'{"added":1}'});
  });
  await page.route('**/api/knowme/conversations/group1/group/members/alice/role',async route=>{
    if(route.request().method()==='PATCH') promoted=true;
    await route.fulfill({status:200,contentType:'application/json',body:'{"role":"ADMIN"}'});
  });
  await page.route('**/api/knowme/social/friends',route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify([
      {user:{id:'bob',displayName:'Bob',username:'bob',avatarUrl:null}}
    ])
  }));
  await page.setViewportSize({width:360,height:760});
  const response=await page.goto('/messages/group1/manage');
  expect(response?.ok()).toBeTruthy();
  await expect(page.getByRole('heading',{name:'Gestion du groupe'})).toBeVisible();
  await expect(page.getByText('Préparation BAC')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1)).toBe(false);
  // KnowMe uses its own branded confirmation dialog, not window.confirm().
  await page.locator('.km-group-role-row').filter({hasText:'Alice'}).getByRole('button',{name:'Nommer administrateur'}).click();
  const confirmation=page.getByRole('dialog',{name:'Confirmation'});
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText('Nommer Alice administrateur ?');
  await confirmation.getByRole('button',{name:'Confirmer'}).click();
  await expect(page.locator('.km-group-role-row').filter({hasText:'Alice'})).toContainText('Administrateur');
  await page.getByRole('button',{name:'Ajouter des membres'}).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:/Ajouter \(1\)/}).click();
  await expect(page.locator('.km-group-role-row').filter({hasText:'Bob'})).toBeVisible();
});
