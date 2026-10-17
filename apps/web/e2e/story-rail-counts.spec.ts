import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

test('the story rail shows one card per author and counts beyond 50 stories', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token', 'story-rail-e2e-token');
    localStorage.setItem('knowme-locale', 'fr');
  });
  await page.route('**/api/knowme/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = {};
    if (path.endsWith('/users/me')) {
      body = { id: 'viewer', username: 'viewer', displayName: 'Viewer' };
    } else if (path.endsWith('/posts/feed')) {
      body = [];
    } else if (path.endsWith('/media/public/post-capabilities')) {
      body = { publicPostImage: false };
    } else if (path.endsWith('/stories/rail')) {
      body = {
        nextOffset: null,
        groups: [
          {
            count: 2,
            story: {
              id: 'mine', type: 'TEXT', viewer: { own: true },
              author: { id:'viewer',username:'viewer',displayName:'Viewer',avatarUrl:null }
            }
          },
          {
            count: 76,
            story: {
              id: 'friend-latest', type: 'TEXT', viewer: { own: false },
              author: { id:'friend',username:'friend',displayName:'Ami KnowMe',avatarUrl:null }
            }
          },
          {
            count: 1,
            story: {
              id: 'other', type: 'TEXT', viewer: { own: false },
              author: { id:'other',username:'other',displayName:'Autre profil',avatarUrl:null }
            }
          }
        ]
      };
    } else if (path.endsWith('/appearance')) {
      body = { preference:{ effectiveThemeKey:'system' }, themes:[] };
    } else if (path.endsWith('/i18n/preferences')) {
      body = { locale:'fr', direction:'ltr' };
    }
    await route.fulfill({
      status:200,contentType:'application/json',body:JSON.stringify(body)
    });
  });
  await page.goto('/feed');
  const rail = page.locator('.km-stories-rail');
  await expect(rail).toBeVisible();
  await expect(rail.locator('.km-story-card')).toHaveCount(3);
  await expect(rail.locator('.km-story-card-count')).toHaveCount(2);
  await expect(rail.locator('.km-story-card-count').first()).toHaveText('2');
  await expect(rail.locator('.km-story-card-count').last()).toHaveText('76');
  await expect(rail.getByRole('link', { name: /Ami KnowMe.*76/ })).toHaveAttribute(
    'href', '/stories/friend-latest'
  );
});
