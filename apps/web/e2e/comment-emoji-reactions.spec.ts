import {expect,test} from '@playwright/test';
test.use({serviceWorkers:'block'});

test('reacts with a heart, switches emoji and removes an existing reaction',async({page})=>{
  const actor={id:'user',username:'user',displayName:'Utilisateur'};
  const author={id:'friend',username:'friend',displayName:'Ami'};
  const post={id:'post',content:'Bonjour',createdAt:'2026-10-18T00:00:00Z',
    authorId:'friend',author,_count:{likes:0,comments:1}};
  const comment={id:'comment',postId:'post',parentId:null,content:'Salut',
    createdAt:'2026-10-18T00:00:00Z',author,_count:{replies:0}};
  let myEmoji:string|null=null;
  const all:string[]=[];
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','reaction-e2e-token');
    localStorage.setItem('knowme-locale','fr');
  });
  await page.route('**/api/knowme/**',async route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    if(path.endsWith('/comments/comment/reaction') && ['PUT','DELETE'].includes(req.method())){
      myEmoji=req.method()==='DELETE'?null:(req.postDataJSON() as {emoji:string}).emoji;
      all.push(myEmoji??'removed');
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
        total:myEmoji?1:0,mine:myEmoji,emojis:myEmoji?[{emoji:myEmoji,count:1}]:[]
      })});return;
    }
    let data:unknown={};
    if(path.endsWith('/users/me'))data=actor;
    else if(path.endsWith('/posts/post'))data=post;
    else if(path.endsWith('/posts/post/comments'))data=[comment];
    else if(path.endsWith('/posts/post/comments/reaction-summaries')) data={
      comment:{total:myEmoji?1:0,mine:myEmoji,
        emojis:myEmoji?[{emoji:myEmoji,count:1}]:[]}
    };
    else if(path.endsWith('/appearance')) data={preference:{effectiveThemeKey:'system'},themes:[]};
    else if(path.endsWith('/i18n/preferences'))data={locale:'fr',direction:'ltr'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/feed/post');
  const main=page.getByRole('button',{name:'Réagir au commentaire de Ami'});
  await expect(main).toBeVisible();
  await main.click();
  await expect(main).toHaveAttribute('aria-pressed','true');
  await expect(main).toContainText('1');
  // The extra picker button is intentionally absent from the visible footer.
  await expect(page.getByRole('button',{name:'Choisir une réaction pour le commentaire de Ami'})).toBeHidden();
  await expect(page.getByRole('button',{name:'Répondre'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Copier le lien'})).toHaveCount(0);
  // Right-click on the quick reaction opens the same full emoji picker.
  await main.click({button:'right'});
  const selector=page.getByRole('dialog',{name:'Choisir une réaction'});
  await expect(selector).toBeVisible();
  await selector.getByRole('button',{name:'Réagir avec 😂'}).click();
  await expect(main).toContainText('😂');
  await main.click(); // the selected emoji is removed directly
  await expect(main).toHaveAttribute('aria-pressed','false');
  await expect(main).toContainText('Réagir');
  // Holding/right-clicking the comment body reveals the full permission-aware
  // context sheet without a row of destructive buttons.
  await page.locator('.km-post-comment').first().click({button:'right'});
  const actions=page.getByRole('dialog',{name:'Actions sur le commentaire de Ami'});
  await expect(actions).toBeVisible();
  await expect(actions.getByRole('button',{name:'Copier le texte'})).toBeVisible();
  await expect(actions.getByRole('button',{name:'Signaler le commentaire'})).toBeVisible();
  await expect(actions.getByRole('button',{name:'Modifier le commentaire'})).toHaveCount(0);
  await actions.getByRole('button',{name:'Fermer les actions'}).click();

  expect(all).toEqual(['❤️','😂','removed']);
});
