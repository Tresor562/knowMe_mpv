import {expect,test} from '@playwright/test';

test.use({serviceWorkers:'block'});

test('shows the current account\'s red filled heart and toggles it from feed and after reload',async({page})=>{
  const actor={id:'viewer',username:'viewer',displayName:'Moi'};
  const author={id:'author',username:'author',displayName:'Auteur'};
  let mine=true;
  const post={id:'post-one',content:'Publication de test',
    authorId:'author',createdAt:'2026-10-18T00:00:00Z',author,
    _count:{likes:1,comments:0}};
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','selected-heart-e2e-token');
    localStorage.setItem('knowme-locale','fr');
  });
  await page.route('**/api/knowme/**',async route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    if(req.method()==='POST'&&path.endsWith('/posts/post-one/like')){
      mine=!mine;
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({liked:mine})});
      return;
    }
    let data:unknown={};
    if(path.endsWith('/users/me'))data=actor;
    else if(path.endsWith('/posts/feed'))data=[{...post,_count:{...post._count,likes:mine?1:0}}];
    else if(path.endsWith('/post-like-status'))data={'post-one':mine};
    else if(path.endsWith('/appearance'))data={preference:{effectiveThemeKey:'system'},themes:[]};
    else if(path.endsWith('/i18n/preferences'))data={locale:'fr',direction:'ltr'};
    else if(path.endsWith('/media/public/post-capabilities'))data={enabled:false};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/feed');
  const liked=page.getByRole('button',{name:'Retirer mon J’aime'});
  await expect(liked).toBeVisible();
  await expect(liked).toHaveAttribute('aria-pressed','true');
  await expect(liked.locator('svg')).toHaveAttribute('fill','currentColor');
  await liked.click();
  const unliked=page.getByRole('button',{name:'Réagir à la publication'});
  await expect(unliked).toBeVisible();
  await expect(unliked).toHaveAttribute('aria-pressed','false');
  await expect(unliked.locator('svg')).toHaveAttribute('fill','none');
  await unliked.click();
  await expect(liked).toBeVisible();
  await page.reload();
  await expect(liked).toHaveAttribute('aria-pressed','true');
});

test('comment emoji is the only react label; pressing it removes the same reaction',async({page})=>{
  const actor={id:'viewer',username:'viewer',displayName:'Moi'};
  const author={id:'friend',username:'friend',displayName:'Ami'};
  const post={id:'post-two',content:'Bonjour',authorId:'friend',author,
    createdAt:'2026-10-18T00:00:00Z',_count:{likes:0,comments:1}};
  const comment={id:'comment-two',content:'Salut',createdAt:'2026-10-18T00:00:00Z',
    author,parentId:null,_count:{replies:0}};
  let reaction:string|null='😂';
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','comment-toggle-e2e-token');
    localStorage.setItem('knowme-locale','fr');
  });
  await page.route('**/api/knowme/**',async route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    if(path.endsWith('/posts/post-two/comments/comment-two/reaction')&&req.method()==='DELETE'){
      reaction=null;
      await route.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify({mine:null,total:0,emojis:[]})});
      return;
    }
    let data:unknown={};
    if(path.endsWith('/users/me'))data=actor;
    else if(path.endsWith('/posts/post-two'))data=post;
    else if(path.endsWith('/posts/post-two/comments'))data=[comment];
    else if(path.endsWith('/post-like-status'))data={'post-two':false};
    else if(path.endsWith('/posts/post-two/comments/reaction-summaries')){
      data={'comment-two':{mine:reaction,total:reaction?1:0,
        emojis:reaction?[{emoji:reaction,count:1}]:[]}};
    } else if(path.endsWith('/appearance'))data={preference:{effectiveThemeKey:'system'},themes:[]};
    else if(path.endsWith('/i18n/preferences'))data={locale:'fr',direction:'ltr'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/feed/post-two');
  const react=page.getByRole('button',{name:'Réagir au commentaire de Ami'});
  await expect(react).toContainText('😂');
  await expect(react).not.toContainText('Réagir');
  await react.click();
  await expect(react).toHaveAttribute('aria-pressed','false');
  await expect(react).toContainText('Réagir');
});
