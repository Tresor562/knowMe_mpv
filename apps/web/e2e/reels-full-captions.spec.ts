import {expect,test} from '@playwright/test';
test.use({serviceWorkers:'block'});
test('Reel caption exposes entire long post without network fetch or truncation',async({page})=>{
  const text='Une longue description KnowMe. '.repeat(230)+'Fin du texte visible.';
  await page.addInitScript(()=>{
    localStorage.setItem('knowme_token','reels-full-caption-test');
    localStorage.setItem('knowme-locale','fr');
  });
  await page.route('**/api/knowme/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    let data:unknown={};
    if(path.endsWith('/users/me'))data={id:'me',username:'me',displayName:'Moi'};
    else if(path.endsWith('/posts/videos'))data=[{
      id:'post-1',content:text,createdAt:'2026-10-18T08:00:00Z',
      author:{id:'author',username:'writer',displayName:'Auteur'},
      media:[{url:'/media/public/post/vid1',mimeType:'video/mp4',position:0}],
      _count:{likes:1,comments:0}
    }];
    else if(path.endsWith('/appearance'))data={preference:{effectiveThemeKey:'system'},themes:[]};
    else if(path.endsWith('/i18n/preferences'))data={locale:'fr',direction:'ltr'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto('/reels');
  await page.getByRole('button',{name:'Lire toute la description du Reel'}).click();
  const dialog=page.getByRole('dialog',{name:'Description complète du Reel'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Fin du texte visible.',{exact:false})).toBeVisible();
  await expect(dialog.locator('p')).toHaveText(text);
  await expect(dialog.getByRole('link',{name:'@writer'})).toHaveAttribute('href','/profile/writer');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});
