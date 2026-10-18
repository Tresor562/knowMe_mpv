import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('edit is offered only on own comments and sends a verified PATCH request', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token','comment-edit-e2e-token');
    localStorage.setItem('knowme-locale','fr');
  });
  const actor = { id:'viewer', username:'viewer', displayName:'Moi' };
  const author = { id:'ada',username:'ada',displayName:'Ada' };
  const post = {
    id:'post-123',content:'Bonjour KnowMe',createdAt:'2026-10-17T15:00:00.000Z',
    authorId:'ada',author,_count:{likes:0,comments:2}
  };
  const comments=[
    {id:'other-comment',content:'Texte original d’Ada',createdAt:'2026-10-17T15:05:00.000Z',author},
    {id:'own-comment',content:'Mon commentaire original',createdAt:'2026-10-17T15:06:00.000Z',author:actor}
  ];
  const payloads: unknown[] = [];
  await page.route('**/api/knowme/**',async route=>{
    const request=route.request();
    const path=new URL(request.url()).pathname;
    if(request.method()==='PATCH' && path.endsWith('/posts/post-123/comments/own-comment')){
      const data=request.postDataJSON();
      payloads.push(data);
      const original=comments.find(item=>item.id==='own-comment')!;
      await route.fulfill({status:200,contentType:'application/json',
        body:JSON.stringify({...original,content:data.content})});
      return;
    }
    let data: unknown={};
    if(path.endsWith('/users/me')) data=actor;
    else if(path.endsWith('/posts/post-123')) data=post;
    else if(path.endsWith('/posts/post-123/comments')) data=comments;
    else if(path.endsWith('/appearance')) data={preference:{effectiveThemeKey:'system'},themes:[]};
    else if(path.endsWith('/i18n/preferences')) data={locale:'fr',direction:'ltr'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });

  await page.goto('/feed/post-123');
  const other=page.locator('#knowme-comment-other-comment');
  const mine=page.locator('#knowme-comment-own-comment');
  await expect(other).toBeVisible();
  await other.click({button:'right'});
  await expect(page.getByRole('button',{name:'Modifier le commentaire'})).toHaveCount(0);
  await page.keyboard.press('Escape');
  await mine.click({button:'right'});
  await page.getByRole('button',{name:'Modifier le commentaire'}).click();
  const edit=page.getByRole('dialog',{name:'Modifier le commentaire'});
  await expect(edit).toBeVisible();
  const draft=edit.getByLabel('Texte du commentaire');
  await expect(draft).toHaveValue('Mon commentaire original');
  await draft.fill('Texte enfin corrigé');
  await edit.getByRole('button',{name:'Enregistrer'}).click();
  await expect(edit).not.toBeVisible();
  await expect(mine).toContainText('Texte enfin corrigé');
  expect(payloads).toEqual([{content:'Texte enfin corrigé'}]);
});
