import {expect,test} from '@playwright/test';
test.use({serviceWorkers:'block'});

test('four compact actions persist the red heart and never fake a saved post',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','four-actions-test-token');
    localStorage.setItem('knowme-locale','fr');
  });
  const me={id:'owner',username:'owner',displayName:'Moi'};
  let liked=false,heartRequests=0;
  await page.route('**/api/knowme/**',async route=>{
    const req=route.request();
    const path=new URL(req.url()).pathname;
    let payload:unknown={};
    if(path.endsWith('/users/me'))payload=me;
    else if(path.endsWith('/posts/feed'))payload=[{
      id:'post-four',content:'Publication à quatre actions',
      createdAt:'2026-10-21T10:00:00Z',author:me,
      _count:{likes:liked?13:12,comments:4}
    }];
    else if(path.endsWith('/post-like-status'))payload={'post-four':liked};
    else if(path.endsWith('/posts/post-four/like')&&req.method()==='POST'){
      heartRequests++; liked=!liked;payload={liked};
    }
    else if(path.endsWith('/stories/rail'))payload={groups:[],nextOffset:null};
    else if(path.endsWith('/media/public/post-capabilities'))payload={publicPostImage:false};
    else if(path.endsWith('/appearance'))payload={preference:{effectiveThemeKey:'system'},themes:[]};
    else if(path.endsWith('/i18n/preferences'))payload={locale:'fr',direction:'ltr'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
  });
  await page.goto('/feed');
  const post=page.locator('article.km-feed-post').filter({hasText:'Publication à quatre actions'});
  const bar=post.getByRole('group',{name:'Actions de la publication'});
  await expect(bar.getByRole('button')).toHaveCount(4);
  const heart=bar.getByRole('button',{name:'J’aime la publication'});
  const save=bar.getByRole('button',{name:'Enregistrement actuellement indisponible'});
  await expect(heart).toHaveAttribute('aria-pressed','false');
  await expect(save).toBeDisabled();
  await heart.click();
  await expect(bar.getByRole('button',{name:'Retirer ma réaction'})).toHaveAttribute('aria-pressed','true');
  await expect(bar.locator('.km-post-heart')).toHaveCSS('color','rgb(231, 61, 87)');
  expect(heartRequests).toBe(1);
  await page.reload();
  await expect(bar.getByRole('button',{name:'Retirer ma réaction'})).toHaveAttribute('aria-pressed','true');
  await bar.getByRole('button',{name:'Retirer ma réaction'}).click();
  await expect(bar.getByRole('button',{name:'J’aime la publication'})).toHaveAttribute('aria-pressed','false');
  expect(heartRequests).toBe(2);
  await expect(save).toBeDisabled();
});

test('saving uses the private API and survives reload without optimistic claims',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','save-post-test-token');
    localStorage.setItem('knowme-locale','fr');
  });
  const me={id:'reader',username:'reader',displayName:'Lecteur'};
  let saved=false, writes=0;
  await page.route('**/api/knowme/**',async route=>{
    const req=route.request();
    const path=new URL(req.url()).pathname;
    let payload:unknown={};
    if(path.endsWith('/users/me'))payload=me;
    else if(path.endsWith('/posts/feed'))payload=[{
      id:'post-four',content:'Publication à enregistrer',createdAt:'2026-10-21T10:00:00Z',
      author:me,_count:{likes:2,comments:1}
    }];
    else if(path.endsWith('/post-like-status'))payload={'post-four':false};
    else if(path.endsWith('/posts/saved'))payload=[];
    else if(path.endsWith('/posts/post-four/saved'))payload={saved};
    else if(path.endsWith('/posts/post-four/save')){
      writes++;
      saved=req.method()==='POST';
      payload={saved};
    }
    else if(path.endsWith('/stories/rail'))payload={groups:[],nextOffset:null};
    else if(path.endsWith('/media/public/post-capabilities'))payload={publicPostImage:false};
    else if(path.endsWith('/appearance'))payload={preference:{effectiveThemeKey:'system'},themes:[]};
    else if(path.endsWith('/i18n/preferences'))payload={locale:'fr',direction:'ltr'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
  });
  await page.goto('/feed');
  const bar=page.locator('article.km-feed-post .km-post-action-bar').first();
  const save=bar.getByRole('button',{name:'Enregistrer la publication'});
  await expect(save).toBeEnabled();
  await save.click();
  await expect(bar.getByRole('button',{name:'Retirer des favoris'})).toHaveAttribute('aria-pressed','true');
  expect(writes).toBe(1);
  await page.reload();
  await expect(bar.getByRole('button',{name:'Retirer des favoris'})).toHaveAttribute('aria-pressed','true');
  await bar.getByRole('button',{name:'Retirer des favoris'}).click();
  await expect(save).toHaveAttribute('aria-pressed','false');
  expect(writes).toBe(2);
});
