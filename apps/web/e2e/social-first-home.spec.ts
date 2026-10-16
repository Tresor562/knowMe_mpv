import { expect, test, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const browserExceptions: string[] = [];
test.beforeEach(async ({page}) => {
  browserExceptions.length = 0;
  page.on('pageerror', error => browserExceptions.push(error.stack ?? error.message));
  page.on('console', message => {
    if (message.type() === 'error') browserExceptions.push('console: ' + message.text());
  });
});

async function checkSocialHome(page: Page) {
  try {
    await expect(page.getByRole('heading', {name:/^(Fil d’actualité|Feed)$/})).toBeVisible({timeout:15000});
  } catch (cause) {
    console.log('KnowMe social home diagnostic', {url:page.url(), body:(await page.locator('body').innerText()).slice(0,700), browserExceptions});
    throw cause;
  }
}


async function stubAuthenticatedSocialHome(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token', 'social-first-e2e-token');
    localStorage.setItem('knowme-locale', 'fr');
  });
  await page.route('**/api/knowme/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/users/me')) {
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ id:'social-user', username:'knowmeqa', displayName:'KnowMe QA', email:'qa@example.test' }) });
      return;
    }
    if (path.endsWith('/posts/feed')) {
      await route.fulfill({ status:200, contentType:'application/json', body:'[]' });
      return;
    }
    if (path.endsWith('/stories/feed')) {
      await route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({stories:[],nextCursor:null}) });
      return;
    }
    if (path.endsWith('/media/public/post-capabilities')) {
      await route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({publicPostImage:false}) });
      return;
    }
    if (path.endsWith('/appearance')) {
      await route.fulfill({ status:200, contentType:'application/json',
        body:JSON.stringify({preference:{effectiveThemeKey:'system'},themes:[]}) });
      return;
    }
    if (path.endsWith('/i18n/preferences')) {
      await route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify({locale:'fr',direction:'ltr'}) });
      return;
    }
    await route.fulfill({status:200,contentType:'application/json',body:'{}'});
  });
}

test('a signed-in KnowMe user opens the social feed, never Chats by default', async ({page}) => {
  await stubAuthenticatedSocialHome(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/feed$/);
  await checkSocialHome(page);
  await expect(page.locator('nav.km-smart-nav')).toBeVisible();
  await expect(page.locator('nav.km-smart-nav a[href="/feed"]')).toBeVisible();
  await expect(page.locator('nav.km-smart-nav a[href="/messages"]')).toBeVisible();
});

test('desktop social home keeps the complete KnowMe main navigation visible', async ({page}) => {
  await page.setViewportSize({width:1280,height:800});
  await stubAuthenticatedSocialHome(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/feed$/);
  await checkSocialHome(page);
  const navigation = page.locator('nav.km-smart-nav');
  await expect(navigation).toBeVisible();
  await expect(navigation).toHaveAttribute('data-layout','desktop');
  await expect(navigation.getByRole('link', {name:'Accueil'})).toBeVisible();
  await expect(navigation.getByRole('link', {name:'Suggestions'})).toBeVisible();
  await expect(navigation.getByRole('button', {name:'Créer'})).toBeVisible();
  await expect(navigation.getByRole('link', {name:'Notifications'})).toBeVisible();
  await expect(navigation.getByRole('link', {name:'Messages'})).toBeVisible();
  await expect(navigation.getByRole('link', {name:'Profil'})).toBeVisible();
});
