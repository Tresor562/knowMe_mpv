import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('sharing a post into a selected group sends a real message only after confirmation', async ({ page }) => {
  const messages: Array<{ path:string; content:string }> = [];
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token','share-chat-e2e');
    localStorage.setItem('knowme-locale','fr');
  });
  await page.route('**/api/knowme/**', async route => {
    const req=route.request();
    const path=new URL(req.url()).pathname;
    if (path.endsWith('/conversations/knowme-group/messages') && req.method()==='POST') {
      messages.push({path,content:String(req.postDataJSON().content)});
      await route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({id:'message-123'})});
      return;
    }
    const post={
      id:'sample-post',content:'Bonjour à tous',createdAt:'2026-10-18T08:00:00Z',
      author:{id:'owner',username:'owner',displayName:'Auteur KnowMe',avatarUrl:null},
      _count:{likes:1,comments:0}
    };
    let result: unknown={};
    if (path.endsWith('/users/me')) result={id:'me',username:'me',displayName:'Moi'};
    else if (path.endsWith('/posts/feed')) result=[post];
    else if (path.endsWith('/stories/rail')) result={groups:[],nextOffset:null};
    else if (path.endsWith('/media/public/post-capabilities')) result={publicPostImage:false};
    else if (path.endsWith('/appearance')) result={preference:{effectiveThemeKey:'system'},themes:[]};
    else if (path.endsWith('/i18n/preferences')) result={locale:'fr',direction:'ltr'};
    else if (path.endsWith('/conversations')) result=[
      {id:'knowme-group',title:'Nexus Team',isGroup:true,members:[]},
      {id:'private-chat',title:'Moi et une amie',isGroup:false,members:[]}
    ];
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
  });
  await page.goto('/feed');
  await page.getByRole('button',{name:'Partager la publication'}).click();
  const sheet=page.getByRole('dialog',{name:'Partager la publication'});
  await sheet.getByRole('button',{name:'Messages et groupes'}).click();
  const picker=sheet.getByRole('region',{name:'Choisir une conversation'});
  await expect(picker.getByText('Nexus Team')).toBeVisible();
  await picker.getByRole('textbox',{name:'Rechercher une conversation ou un groupe'}).fill('Nexus');
  await expect(picker.getByText('Moi et une amie')).toHaveCount(0);
  await picker.getByRole('radio',{name:/Nexus Team/}).check();
  await expect(messages).toHaveLength(0);
  await sheet.getByLabel('Ajouter un commentaire au partage…').fill('Regardez ceci');
  await picker.getByRole('button',{name:'Envoyer dans cette conversation'}).click();
  await expect(sheet).not.toBeVisible();
  expect(messages).toHaveLength(1);
  expect(messages[0].path).toMatch(/\/conversations\/knowme-group\/messages$/);
  expect(messages[0].content).toContain('Regardez ceci');
  expect(messages[0].content).toContain('Auteur KnowMe');
  expect(messages[0].content).toContain('/feed/sample-post');
});
