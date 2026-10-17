import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('nested replies are retrieved and a new reply targets the correct parent', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token', 'thread-e2e-token');
    localStorage.setItem('knowme-locale', 'fr');
  });
  const a = { id:'author', username:'author', displayName:'Auteure' };
  const me = { id:'viewer', username:'viewer', displayName:'Moi' };
  const post = { id:'post-a', content:'Bonjour', createdAt:'2026-10-18T00:00:00Z',
    authorId:'author', author:a, _count:{likes:0,comments:2} };
  const root = { id:'root-a', postId:'post-a', content:'Un avis', createdAt:'2026-10-18T00:01:00Z',
    author:a, parentId:null, _count:{replies:1} };
  const child = { id:'reply-a', postId:'post-a', content:'Merci !',createdAt:'2026-10-18T00:02:00Z',
    author:me,parentId:'root-a',_count:{replies:0} };
  let sent: Record<string, unknown>|null = null;
  await page.route('**/api/knowme/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const request = route.request();
    if (path.endsWith('/posts/post-a/comments') && request.method() === 'POST') {
      sent = request.postDataJSON() as Record<string,unknown>;
      await route.fulfill({ status:201,contentType:'application/json',body:JSON.stringify(child) });
      return;
    }
    let body:unknown={};
    if(path.endsWith('/users/me')) body=me;
    else if(path.endsWith('/posts/post-a')) body=post;
    else if(path.endsWith('/posts/post-a/comments')) body=[root];
    else if(path.endsWith('/posts/post-a/comments/root-a/replies')) body=[child];
    else if(path.endsWith('/appearance')) body={preference:{effectiveThemeKey:'system'},themes:[]};
    else if(path.endsWith('/i18n/preferences')) body={locale:'fr',direction:'ltr'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });

  await page.goto('/feed/post-a');
  await expect(page.getByRole('button',{name:'Afficher les réponses (1)'})).toBeVisible();
  await page.getByRole('button',{name:'Afficher les réponses (1)'}).click();
  await expect(page.locator('#knowme-comment-reply-a')).toBeVisible();
  await page.locator('#knowme-comment-root-a').getByRole('button',{name:'Répondre'}).click();
  await expect(page.getByText('Réponse à')).toBeVisible();
  await page.getByLabel('Commentaire').fill('À mon tour');
  await page.getByRole('button',{name:'Envoyer le commentaire'}).click();
  await expect.poll(() => sent).toMatchObject({
    content:'À mon tour', parentId:'root-a'
  });
});
