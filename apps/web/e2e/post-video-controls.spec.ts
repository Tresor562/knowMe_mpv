import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('publication video player exposes seeking, speed and sound controls', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token', 'video-controls-test');
    localStorage.setItem('knowme-locale', 'fr');
  });
  await page.route('**/api/knowme/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = {};
    if (path.endsWith('/users/me')) {
      data = {id:'me',username:'me',displayName:'Moi'};
    } else if (path.endsWith('/posts/feed')) {
      data = [{
        id:'post-video',content:'Une vidéo',createdAt:'2026-10-18T10:00:00.000Z',
        author:{id:'alice',username:'alice',displayName:'Alice'},
        _count:{likes:0,comments:0},
        media:[{url:'/media/public/post/video-001',mimeType:'video/mp4',position:0}]
      }];
    } else if (path.endsWith('/stories/rail')) {
      data = {groups:[],nextOffset:null};
    } else if (path.endsWith('/media/public/post-capabilities')) {
      data = {publicPostImage:false};
    } else if (path.endsWith('/appearance')) {
      data = {preference:{effectiveThemeKey:'system'},themes:[]};
    } else if (path.endsWith('/i18n/preferences')) {
      data = {locale:'fr',direction:'ltr'};
    }
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });

  await page.goto('/feed');
  await page.getByRole('button',{name:'Ouvrir le média 1 sur 1'}).click();
  const viewer = page.getByRole('dialog',{name:'Galerie de la publication'});
  const player = viewer.locator('.km-post-video-player');
  await expect(player).toBeVisible();
  // All interactive media pictograms use actual KnowMe paths, never emojis.
  const toolbar = player.locator('.km-post-video-toolbar');
  for (const icon of ['play','rewind-10','forward-10','volume','fullscreen']) {
    await expect(toolbar.locator('[data-knowme-icon="' + icon + '"]')).toBeVisible();
  }
  const targets = await toolbar.locator('button').evaluateAll(buttons =>
    buttons.map(button => ({ width: button.getBoundingClientRect().width,
      height: button.getBoundingClientRect().height })));
  expect(targets.every(target => target.width >= 44 && target.height >= 44)).toBe(true);
  await expect(player.getByRole('button',{name:'Mettre la vidéo en pause'})).toHaveCount(0);
  await expect(player.getByRole('button',{name:'Lire la vidéo'})).toBeVisible();
  await expect(player.getByRole('button',{name:'Reculer de 10 secondes'})).toBeVisible();
  await expect(player.getByRole('button',{name:'Avancer de 10 secondes'})).toBeVisible();
  await player.getByRole('button',{name:'Vitesse de lecture'}).click();
  await expect(player.getByRole('button',{name:'Vitesse de lecture'})).toContainText('1.25×');
  await player.getByRole('button',{name:'Couper le son'}).click();
  await expect(player.getByRole('button',{name:'Activer le son'})).toBeVisible();
  await expect(toolbar.locator('[data-knowme-icon="volume-off"]')).toBeVisible();

  await player.locator('video').evaluate(video => {
    Object.defineProperty(video,'duration',{configurable:true,value:3661});
    Object.defineProperty(video,'currentTime',{configurable:true,writable:true,value:125});
    video.dispatchEvent(new Event('durationchange'));
  });
  await expect(player.getByText('2:05 / 1:01:01')).toBeVisible();
  await player.getByRole('button',{name:'Avancer de 10 secondes'}).click();
  await expect(player.getByText('2:15 / 1:01:01')).toBeVisible();
  await expect(toolbar.locator('.km-state-icon--forward-10')).toHaveAttribute('data-icon-burst', /[0-9]+/);

  await viewer.getByRole('button',{name:'Fermer la galerie'}).click();
  await expect(viewer).not.toBeVisible();
});
