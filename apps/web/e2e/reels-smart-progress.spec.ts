import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('Reels hide short timelines and retain a minimal long-video progress rail', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token', 'smart-progress-test');
    localStorage.setItem('knowme-locale', 'fr');
  });
  await page.route('**/api/knowme/**', async route => {
    const url = new URL(route.request().url()).pathname;
    let body: unknown = {};
    if (url.endsWith('/users/me')) body = { id:'reader', username:'reader', displayName:'Reader' };
    else if (url.endsWith('/posts/videos')) body = [{
      id:'video-1', content:'Reel intelligent', createdAt:'2026-10-20T10:00:00Z',
      author:{id:'creator',username:'creator',displayName:'Creator'},
      _count:{likes:0,comments:0},
      media:[{url:'/media/public/post/video-asset',mimeType:'video/mp4',position:0}]
    }];
    else if (url.endsWith('/appearance')) body = { preference:{effectiveThemeKey:'system'},themes:[] };
    else if (url.endsWith('/i18n/preferences')) body = { locale:'fr',direction:'ltr' };
    await route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(body) });
  });
  await page.goto('/reels');
  const video = page.locator('.km-reel-video');
  await expect(video).toHaveCount(1);
  await video.evaluate((element:HTMLVideoElement) => {
    Object.defineProperty(element, 'duration', { configurable:true, writable:true, value:24 });
    Object.defineProperty(element, 'currentTime', { configurable:true, writable:true, value:4 });
    element.play = async () => { element.dispatchEvent(new Event('play')); };
    element.pause = () => { element.dispatchEvent(new Event('pause')); };
    element.dispatchEvent(new Event('durationchange'));
    element.dispatchEvent(new Event('timeupdate'));
    element.dispatchEvent(new Event('play'));
  });
  await expect(page.locator('.km-reel-player-controls--hidden')).toHaveCount(1);
  await expect(page.locator('.km-reel-minimal-timeline')).toHaveCount(0);

  await page.locator('.km-reels-viewport').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.km-reel-player-controls--expanded')).toBeVisible();
  await expect(page.getByText('0:14 / 0:24')).toBeVisible();
  await expect(page.locator('.km-reel-player-controls--hidden')).toHaveCount(1,{timeout:5500});

  await video.evaluate((element:HTMLVideoElement) => {
    Object.defineProperty(element, 'duration', { configurable:true, value:180 });
    element.dispatchEvent(new Event('durationchange'));
  });
  await expect(page.locator('.km-reel-minimal-timeline')).toBeVisible();
  await expect(page.locator('.km-reel-player-controls--hidden')).toHaveCount(1);
  await page.locator('.km-reel-minimal-timeline').click();
  await expect(page.locator('.km-reel-player-controls--expanded')).toBeVisible();
  await expect(page.getByRole('slider',{name:'Position dans la vidéo'})).toBeVisible();
});
