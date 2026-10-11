import { expect, test, type Page } from '@playwright/test';

async function authenticated(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('knowme_token', 'profile-link-e2e-token');
    window.localStorage.setItem('knowme-locale', 'fr');
  });
  await page.route('**/api/knowme/users/me', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      id: 'me', email: 'me@example.test', displayName: 'Moi', username: 'moi'
    })
  }));
  await page.route('**/api/knowme/i18n/preferences', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ locale: 'fr', direction: 'ltr', source: 'user',
      version: 1, persisted: true, updatedAt: '2026-10-11T00:00:00Z' })
  }));
  await page.route('**/api/knowme/appearance**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ preference: { effectiveThemeKey: 'system' } })
  }));
}

test('feed author avatar and identity open the same public profile', async ({ page }) => {
  await authenticated(page);
  await page.route('**/api/knowme/posts/feed', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{
      id: 'post-1', content: 'Bienvenue dans KnowMe',
      createdAt: '2026-10-11T15:00:00Z',
      author: { id: 'alice', displayName: 'Alice', username: 'alice', avatarUrl: null },
      _count: { likes: 0, comments: 1 }
    }])
  }));
  await page.goto('/feed');
  await expect(page.getByRole('link', { name: 'Voir le profil de Alice' }))
    .toHaveAttribute('href', '/profile/alice');
  await expect(page.getByRole('link', { name: /Bienvenue dans KnowMe/ }))
    .toHaveAttribute('href', '/feed/post-1');
});

test('comment author has a profile link independent of moderation controls', async ({ page }) => {
  await authenticated(page);
  const post = {
    id: 'post-1', authorId: 'alice', content: 'Test', imageUrl: null,
    createdAt: '2026-10-11T15:00:00Z',
    author: { id: 'alice', displayName: 'Alice', username: 'alice' },
    _count: { likes: 0, comments: 1 }
  };
  await page.route('**/api/knowme/posts/post-1', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(post)
  }));
  await page.route('**/api/knowme/posts/post-1/comments**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([{
      id: 'comment-1', content: 'Bonjour',
      author: { id: 'bob', displayName: 'Bob', username: 'bob', avatarUrl: null },
      createdAt: '2026-10-11T15:05:00Z'
    }])
  }));
  await page.goto('/feed/post-1');
  await expect(page.getByRole('link', { name: /Bob.*@bob/ }))
    .toHaveAttribute('href', '/profile/bob');
});
