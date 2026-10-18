import { expect, test, type Page } from '@playwright/test';

const members = [
  {userId:'me',role:'MEMBER',user:{id:'me',displayName:'Moi',username:'moi',avatarUrl:null}},
  {userId:'owner',role:'OWNER',user:{id:'owner',displayName:'Alice',username:'alice',avatarUrl:null}}
];
const messages = [
  {id:'img1',conversationId:'grp1',createdAt:'2026-10-17T12:00:00Z',
    content:'',sender:{displayName:'Alice'},presentation:{kind:'IMAGE',assetId:'private-media'}},
  {id:'web1',conversationId:'grp1',createdAt:'2026-10-16T12:00:00Z',
    content:'Lien https://example.com/ressource',sender:{displayName:'Moi'},
    presentation:{kind:'TEXT',text:'Lien https://example.com/ressource'}},
  {id:'file1',conversationId:'grp1',createdAt:'2026-10-15T12:00:00Z',
    content:'',sender:{displayName:'Alice'},
    presentation:{kind:'DOCUMENT',assetId:'private-file',fileName:'document.pdf'}}
];
async function setup(page: Page, allowed = true) {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token','group-info-design-test');
    localStorage.setItem('knowme-locale','fr');
  });
  let left=false;
  await page.route('**/api/knowme/**', async route => {
    const {pathname,searchParams}=new URL(route.request().url());
    if (pathname.endsWith('/media/private-file/content')) {
      return route.fulfill({status:200,contentType:'application/pdf',body:'%PDF-1.4 fake test content'});
    }
    let result: unknown = {};
    if (pathname.endsWith('/media/private-file/download-grant'))
      result={path:'/media/private-file/content?token=test-grant'};
    if (pathname.endsWith('/users/me')) result={id:'me',username:'moi',displayName:'Moi',email:'me@example.test'};
    if (pathname.endsWith('/i18n/preferences')) result={locale:'fr',direction:'ltr',source:'user',version:1,persisted:true};
    if (pathname.endsWith('/conversations')) result=allowed?[{id:'grp1',isGroup:true,title:'Groupe Révisions',members}]:[];
    if (pathname.endsWith('/conversations/grp1/messages')) result=searchParams.has('cursor')
      ? {items:[messages[2]],nextCursor:null,readStates:[]}
      : {items:messages.slice(0,2),nextCursor:'page2',readStates:[]};
    if (pathname.endsWith('/notifications/center')) result={items:[],totals:{unread:0}};
    if (pathname.endsWith('/notifications/unread-count')) result={count:0};
    if (pathname.endsWith('/conversations/grp1/group/members/me')) {
      left=true;result={removed:true,userId:'me'};
    }
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
  });
  return {hasLeft:()=>left};
}

test('group media/files/links are real, paginated and deep-link to their message', async({page})=>{
  await setup(page);
  await page.setViewportSize({width:360,height:760});
  await page.goto('/messages/grp1/info');
  await expect(page.getByRole('heading',{name:'Groupe Révisions'})).toBeVisible();
  await expect(page.getByRole('tab',{name:'Aperçu'})).toHaveAttribute('aria-selected','true');
  await expect(page.getByRole('heading',{name:'À propos du groupe'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Contenus partagés'})).toBeVisible();
  await expect(page.getByRole('heading',{name:/Membres/})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Paramètres du groupe'})).toBeVisible();
  await expect(page.locator('.km-group-overview-member-list .km-info-member-row')).toHaveCount(2);
  await expect(page.locator('.km-group-identity-mark')).toBeVisible();
  await expect(page.locator('.km-info-group-avatar img')).toHaveCount(0);
  await page.getByRole('button',{name:'Voir tous'}).click();
  await expect(page.getByRole('tab',{name:'Membres',exact:true})).toHaveAttribute('aria-selected','true');
  await page.getByRole('tab',{name:'Aperçu'}).click();
  await page.getByRole('button',{name:'Médias',exact:true}).click();
  await expect(page.getByRole('tab',{name:'Médias'})).toHaveAttribute('aria-selected','true');
  await page.getByRole('tab',{name:'Liens'}).click();
  await expect(page.getByRole('link',{name:'https://example.com/ressource'}))
    .toHaveAttribute('rel','noopener noreferrer');
  await expect(page.getByRole('link',{name:'Voir le message'}))
    .toHaveAttribute('href','/messages/grp1?message=web1');
  await page.getByRole('tab',{name:'Fichiers'}).click();
  await expect(page.getByText('Aucun résultat dans les messages chargés')).toBeVisible();
  await page.getByRole('button',{name:'Charger les messages plus anciens'}).click();
  await expect(page.getByRole('link',{name:'Voir le message'}))
    .toHaveAttribute('href','/messages/grp1?message=file1');
  const fileFilters=page.getByRole('group',{name:'Filtrer les contenus partagés'});
  await fileFilters.getByRole('button',{name:'Documents'}).click();
  await expect(page.getByRole('button',{name:'Télécharger'})).toBeVisible();
  await fileFilters.getByRole('button',{name:'Audios'}).click();
  await expect(page.getByRole('button',{name:'Télécharger'})).toHaveCount(0);
  await fileFilters.getByRole('button',{name:'Documents'}).click();
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Télécharger'}).click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('document.pdf');
  await page.getByRole('tab',{name:'Médias'}).click();
  await expect(page.getByRole('link',{name:'Voir le message'}))
    .toHaveAttribute('href','/messages/grp1?message=img1');
  await page.getByRole('button',{name:'Sélectionner',exact:true}).click();
  await page.getByRole('checkbox',{name:/Sélectionner le message de Alice/}).check();
  await expect(page.getByRole('button',{name:'Copier les liens vers les messages'})).toBeEnabled();
  await page.getByRole('tab',{name:'Fichiers'}).click();
  await expect(page.getByRole('checkbox',{name:/Sélectionner le message de Alice/})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Sélectionner',exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'Recherche'}).click();
  await page.getByRole('searchbox',{name:'Rechercher les messages du groupe'}).fill('ressource');
  await expect(page.getByRole('link',{name:'Voir le message'}))
    .toHaveAttribute('href','/messages/grp1?message=web1');
  const noOverflow=await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1);
  expect(noOverflow).toBeTruthy();
});

test('leaving a group requires confirmation and uses authenticated endpoint',async({page})=>{
  const state=await setup(page);
  await page.goto('/messages/grp1/info');
  await page.locator('.km-info-more > summary[aria-label="Autres options du groupe"]').click();
  await page.getByRole('button',{name:'Quitter le groupe'}).click();
  const dialog=page.getByRole('dialog',{name:'Confirmation'});
  await expect(dialog).toBeVisible();
  await expect(page.getByText('Quitter ce groupe ?')).toBeVisible();
  expect(state.hasLeft()).toBe(false);
  await dialog.getByRole('button',{name:'Confirmer'}).click();
  await expect.poll(state.hasLeft).toBe(true);
});

test('non-members cannot browse group media or roster', async({page})=>{
  await setup(page,false);
  await page.goto('/messages/grp1/info');
  await expect(page.locator('.km-info-page .km-auth-error[role="alert"]')).toContainText('introuvable');
  await expect(page.getByRole('tab',{name:'Médias'})).toHaveCount(0);
  await expect(page.getByRole('link',{name:/Alice/})).toHaveCount(0);
});

test('group member filters distinguish owner/admin and ordinary members without leaking roles', async({page})=>{
  await setup(page);
  await page.setViewportSize({width:360,height:760});
  await page.goto('/messages/grp1/info');
  const controls=page.getByRole('group',{name:'Filtrer les membres'});
  await expect(controls.getByRole('button',{name:'Tous'})).toHaveAttribute('aria-pressed','true');
  await controls.getByRole('button',{name:'Admins'}).click();
  await expect(page.getByRole('link',{name:/Alice/})).toBeVisible();
  await expect(page.getByRole('link',{name:/Moi/})).toHaveCount(0);
  await controls.getByRole('button',{name:'Membres'}).click();
  await expect(page.getByRole('link',{name:/Moi/})).toBeVisible();
  await expect(page.getByRole('link',{name:/Alice/})).toHaveCount(0);
  await controls.getByRole('button',{name:'Tous'}).click();
  await expect(page.getByRole('link',{name:/Alice/})).toBeVisible();
  await expect(page.getByRole('link',{name:/Moi/})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1)).toBe(false);
});


test('group actions menu closes on Escape and outside touch without obscuring the page',async({page})=>{
  await setup(page);
  await page.setViewportSize({width:360,height:760});
  await page.goto('/messages/grp1/info');
  const menu=page.locator('.km-info-more');
  const trigger=menu.locator('summary');
  await trigger.click();
  await expect(menu).toHaveAttribute('open','');
  await page.keyboard.press('Escape');
  await expect(menu).not.toHaveAttribute('open','');
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(menu).toHaveAttribute('open','');
  await page.locator('.km-info-identity').click();
  await expect(menu).not.toHaveAttribute('open','');
  await expect(page.getByRole('heading',{name:'Groupe Révisions'})).toBeVisible();
});
