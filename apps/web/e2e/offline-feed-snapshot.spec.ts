import {expect,test} from '@playwright/test';

test.use({serviceWorkers:'block'});

test('public posts previously opened stay readable on API failure but interactions are disabled',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','feed-offline-test');
    localStorage.setItem('knowme-locale','fr');
  });
  let unavailable=false;
  let likeRequests=0;
  const post={
    id:'offline-public-post',content:'Une publication publique consultée hier',
    createdAt:'2026-10-17T20:00:00Z',
    author:{id:'writer',username:'writer',displayName:'Auteur'},
    _count:{likes:3,comments:1},media:[]
  };
  await page.route('**/api/knowme/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith('/posts/feed')&&unavailable){
      await route.abort('failed');
      return;
    }
    if(path.endsWith('/posts/offline-public-post/like'))likeRequests++;
    let data:unknown={};
    if(path.endsWith('/users/me'))data={id:'reader',username:'reader',displayName:'Lecteur'};
    else if(path.endsWith('/posts/feed'))data=[post];
    else if(path.endsWith('/stories/rail'))data={groups:[],nextOffset:null};
    else if(path.endsWith('/media/public/post-capabilities'))data={publicPostImage:false};
    else if(path.endsWith('/appearance'))data={preference:{effectiveThemeKey:'system'},themes:[]};
    else if(path.endsWith('/i18n/preferences'))data={locale:'fr',direction:'ltr'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });

  await page.goto('/feed');
  await expect(page.getByText(post.content)).toBeVisible();
  // The cache write is deliberately asynchronous so it cannot block the feed.
  await expect.poll(()=>page.evaluate(async()=>{
    return new Promise<number>(resolve=>{
      const open=indexedDB.open('knowme-offline-feed-v1',1);
      open.onerror=()=>resolve(0);
      open.onsuccess=()=>{
        const database=open.result;
        const req=database.transaction('snapshots','readonly').objectStore('snapshots').get('reader');
        req.onsuccess=()=>{const count=req.result?.posts?.length??0;database.close();resolve(count);};
        req.onerror=()=>{database.close();resolve(0);};
      };
    });
  })).toBe(1);

  unavailable=true;
  await page.reload();
  await expect(page.getByText(post.content)).toBeVisible();
  await expect(page.getByText(/Fil hors ligne du/)).toBeVisible();
  await expect(page.getByRole('button',{name:'Réagir à la publication'}).first()).toBeDisabled();
  expect(likeRequests).toBe(0);
});
