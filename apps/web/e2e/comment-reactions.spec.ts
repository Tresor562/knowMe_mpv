import { expect, test } from '@playwright/test';

test.use({serviceWorkers:'block'});

test('react to a comment, change emoji and remove it through API',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','reaction-e2e-token');
    localStorage.setItem('knowme-locale','fr');
  });
  const user={id:'me',username:'me',displayName:'Moi'};
  const author={id:'friend',username:'friend',displayName:'Un ami'};
  const comment={id:'comment-1',postId:'post-1',content:'Magnifique !',
    author,createdAt:'2026-10-17T14:00:00Z',parentId:null,_count:{replies:0}};
  const post={id:'post-1',authorId:'friend',author,content:'Exemple de publication',
    createdAt:'2026-10-17T13:00:00Z',_count:{likes:2,comments:1}};
  let mine:string|null=null;
  const calls:Array<{method:string,emoji?:string}>=[];

  await page.route('**/api/knowme/**',async route=>{
    const req=route.request();
    const path=new URL(req.url()).pathname;
    let body:unknown={};
    if(path.endsWith('/users/me'))body=user;
    else if(path.endsWith('/posts/post-1'))body=post;
    else if(path.endsWith('/posts/post-1/comments'))body=[comment];
    else if(path.endsWith('/posts/post-1/comments/comment-1/reactions')){
      if(req.method()==='PUT'){
        const input=req.postDataJSON() as {emoji:string};
        mine=input.emoji;
        calls.push({method:'PUT',emoji:mine});
      }
      if(req.method()==='DELETE'){
        mine=null;
        calls.push({method:'DELETE'});
      }
      body={commentId:'comment-1',total:mine?1:0,
        emojis:mine?[{emoji:mine,count:1}]:[],mine};
    } else if(path.endsWith('/appearance')){
      body={preference:{effectiveThemeKey:'system'},themes:[]};
    } else if(path.endsWith('/i18n/preferences')){
      body={locale:'fr',direction:'ltr'};
    }
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto('/feed/post-1');
  const reaction=page.getByRole('button',{name:'Réagir au commentaire'});
  await expect(reaction).toBeVisible();
  await reaction.click();
  await expect(page.getByRole('button',{name:'Modifier la réaction au commentaire'})).toBeVisible();
  expect(calls).toEqual([{method:'PUT',emoji:'❤️'}]);
  await page.getByRole('button',{name:'Choisir une réaction emoji'}).click();
  await page.getByRole('button',{name:'Réagir 😂'}).click();
  expect(calls.at(-1)).toEqual({method:'PUT',emoji:'😂'});
  await page.getByRole('button',{name:'Choisir une réaction emoji'}).click();
  await page.getByRole('button',{name:'Réagir 😂'}).click();
  expect(calls.at(-1)).toEqual({method:'DELETE'});
});
