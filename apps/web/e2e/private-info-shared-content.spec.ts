import { expect, test } from '@playwright/test';

test('private chat has shared media, links, files and search without group admin controls', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token', 'private-info-e2e');
    localStorage.setItem('knowme-locale', 'fr');
  });
  const members = [
    { userId:'me',role:'MEMBER',user:{id:'me',username:'me',displayName:'Moi',avatarUrl:null} },
    { userId:'contact',role:'MEMBER',user:{id:'contact',username:'ami',displayName:'Ami',avatarUrl:null} }
  ];
  await page.route('**/api/knowme/**', async route => {
    const { pathname } = new URL(route.request().url());
    let body: unknown = {};
    if(pathname.endsWith('/users/me')) body={id:'me',username:'me',displayName:'Moi',email:'me@example.test'};
    if(pathname.endsWith('/i18n/preferences')) body={locale:'fr',direction:'ltr',source:'user',version:1};
    if(pathname.endsWith('/conversations')) body=[{id:'dm-1',isGroup:false,title:null,members}];
    if(pathname.endsWith('/conversations/dm-1/messages')) body={
      items:[
        {id:'dm-text',conversationId:'dm-1',createdAt:'2026-10-17T10:00:00Z',
          content:'Voici https://example.com/guide',sender:{displayName:'Ami'},presentation:{kind:'TEXT',text:'Voici https://example.com/guide'}},
        {id:'dm-photo',conversationId:'dm-1',createdAt:'2026-10-17T09:00:00Z',content:'',
          sender:{displayName:'Moi'},presentation:{kind:'IMAGE',assetId:'dm-image'}}
      ],nextCursor:null
    };
    if(pathname.endsWith('/notifications/center')) body={items:[],totals:{unread:0}};
    if(pathname.endsWith('/notifications/unread-count')) body={count:0};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.setViewportSize({width:360,height:760});
  await page.goto('/messages/dm-1/info');
  await expect(page.getByRole('heading',{name:'Ami'})).toBeVisible();
  await expect(page.getByRole('tab',{name:'Médias'})).toBeVisible();
  await expect(page.getByRole('tab',{name:'Fichiers'})).toBeVisible();
  await expect(page.getByRole('tab',{name:'Liens'})).toBeVisible();
  await expect(page.getByRole('tab',{name:'Recherche'})).toBeVisible();
  await page.getByRole('tab',{name:'Médias'}).click();
  const filters=page.getByRole('group',{name:'Filtrer les contenus partagés'});
  await filters.getByRole('button',{name:'Photos'}).click();
  await expect(page.getByRole('link',{name:'Voir le message'}))
    .toHaveAttribute('href','/messages/dm-1?message=dm-photo');
  await filters.getByRole('button',{name:'Vidéos'}).click();
  await expect(page.getByRole('link',{name:'Voir le message'})).toHaveCount(0);
  await expect(page.locator('.km-info-more')).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Profil'})).toHaveAttribute('href','/profile/ami');
  await page.getByRole('tab',{name:'Liens'}).click();
  await page.getByRole('combobox',{name:'Auteur des messages'}).selectOption('name:ami');
  await page.getByLabel('Date de début').fill('2026-10-18');
  await expect(page.getByRole('link',{name:'https://example.com/guide'})).toHaveCount(0);
  await page.getByLabel('Date de début').fill('2026-10-17');
  await expect(page.getByRole('link',{name:'https://example.com/guide'})).toHaveAttribute('rel','noopener noreferrer');
  await page.evaluate(() => {
    Object.defineProperty(navigator,'clipboard',{
      configurable:true,
      value:{writeText: async (value:string) => {
        (window as Window & { __lastKnowMeLinks?: string }).__lastKnowMeLinks=value;
      }}
    });
  });
  await page.getByRole('button',{name:'Sélectionner',exact:true}).click();
  await page.getByRole('button',{name:'Tout sélectionner'}).click();
  await expect(page.getByRole('checkbox',{name:/Sélectionner le message de Ami/})).toBeChecked();
  await page.getByRole('button',{name:'Effacer la sélection'}).click();
  await expect(page.getByRole('checkbox',{name:/Sélectionner le message de Ami/})).not.toBeChecked();
  await page.getByRole('checkbox',{name:/Sélectionner le message de Ami/}).check();
  await page.evaluate(()=>{
    Object.defineProperty(navigator,'share',{
      configurable:true,
      value:async (data:{text?:string})=>{
        (window as Window & { __lastSharedLinks?: string }).__lastSharedLinks=data.text;
      }
    });
  });
  await page.getByRole('button',{name:'Partager les liens'}).click();
  await expect.poll(()=>page.evaluate(()=>
    (window as Window & { __lastSharedLinks?: string }).__lastSharedLinks
  )).toContain('/messages/dm-1?message=dm-text');
  const saved:string[]=[];
  page.on('request',request=>{
    if(new URL(request.url()).pathname.endsWith('/saved-messages')&&request.method()==='POST'){
      const payload=request.postDataJSON() as {messageId:string};
      saved.push(payload.messageId);
    }
  });
  await page.getByRole('button',{name:'Enregistrer la sélection'}).click();
  await expect(page.locator('.km-shared-copy-status')).toContainText('1 message(s) enregistré(s).');
  expect(saved).toEqual(['dm-text']);
  await page.route('**/api/knowme/saved-messages',route=>
    route.fulfill({status:403,contentType:'application/json',body:'{"message":"Forbidden"}'})
  );
  await page.getByRole('button',{name:'Enregistrer la sélection'}).click();
  await expect(page.locator('.km-shared-copy-status')).toContainText('0 message(s) enregistré(s). 1 échec(s).');
  await expect(page.getByRole('button',{name:'Copier les liens vers les messages'})).toBeEnabled();
  await page.getByRole('button',{name:'Copier les liens vers les messages'}).click();
  await expect.poll(() => page.evaluate(()=>
    (window as Window & { __lastKnowMeLinks?: string }).__lastKnowMeLinks
  )).toContain('/messages/dm-1?message=dm-text');
  await page.getByRole('button',{name:'Annuler',exact:true}).click();
  await expect(page.getByRole('checkbox',{name:/Sélectionner le message de Ami/})).toHaveCount(0);
  await expect(page.getByRole('link',{name:'Voir le message'}))
    .toHaveAttribute('href','/messages/dm-1?message=dm-text');
  await page.getByRole('tab',{name:'Recherche'}).click();
  await page.getByRole('searchbox',{name:'Rechercher les messages privés'}).fill('guide');
  await expect(page.getByRole('link',{name:'Voir le message'}))
    .toHaveAttribute('href','/messages/dm-1?message=dm-text');
  // WAI-ARIA tablist: arrow/home/end navigate without hunting for tiny tabs.
  await page.getByRole('tab',{name:'Recherche'}).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('tab',{name:'Liens'})).toHaveAttribute('aria-selected','true');
  await page.keyboard.press('Home');
  await expect(page.getByRole('tab',{name:'Participants'})).toHaveAttribute('aria-selected','true');
  await page.keyboard.press('End');
  await expect(page.getByRole('tab',{name:'Recherche'})).toHaveAttribute('aria-selected','true');
  const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  expect(noOverflow).toBeTruthy();
});

test('a private conversation absent from the signed-in chat list never exposes its content',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','private-no-access-test');
    localStorage.setItem('knowme-locale','fr');
  });
  let fetched=false;
  await page.route('**/api/knowme/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith('/conversations/dm-secret/messages')) fetched=true;
    const response=path.endsWith('/users/me')
      ? {id:'viewer',username:'viewer',displayName:'Viewer',email:'v@example.test'}
      : path.endsWith('/conversations')?[]:{};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
  });
  await page.goto('/messages/dm-secret/info');
  await expect(page.locator('.km-info-page .km-auth-error[role="alert"]')).toContainText('introuvable');
  await expect(page.getByRole('tab',{name:'Médias'})).toHaveCount(0);
  await expect(page.getByRole('link',{name:/Voir le message/})).toHaveCount(0);
  expect(fetched).toBe(false);
});
