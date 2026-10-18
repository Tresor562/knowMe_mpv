import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

async function openCreator(page: import('@playwright/test').Page, options: {
  following: boolean; owner?: boolean
}) {
  await page.addInitScript(() => {
    window.localStorage.setItem('knowme_token', 'creator-follow-test-token');
    window.localStorage.setItem('knowme-locale', 'fr');
  });
  let followerCount = 42;
  let following = options.following;
  const methods: string[] = [];
  const owner = Boolean(options.owner);
  await page.route('**/api/knowme/**', async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const method = req.method();
    let data: unknown = {};
    if (path.endsWith('/users/me')) {
      data = { id: 'owner-test', username: owner ? 'author' : 'follower',
        displayName: 'Utilisateur test', email: 'test@example.test' };
    } else if (path.endsWith('/appearance')) {
      data = { preference: { effectiveThemeKey: 'system' }, themes: [] };
    } else if (path.endsWith('/i18n/preferences')) {
      data = { locale: 'fr', direction: 'ltr' };
    } else if (path.endsWith('/creators/author/follow-status')) {
      data = { following, isOwner: owner, followerCount };
    } else if (path.endsWith('/creators/author/follow') && (method === 'PUT' || method === 'DELETE')) {
      methods.push(method);
      const next = method === 'PUT';
      const replayed = following === next;
      if (!replayed) followerCount += next ? 1 : -1;
      following = next;
      data = { following, replayed };
    } else if (path.endsWith('/creators/author/view')) {
      data = { counted: true };
    } else if (path.endsWith('/creators/author')) {
      data = { userId: 'owner-test', slug: 'author', title: 'Atelier de création',
        category: 'ART', bio: 'Une page de créateur', followerCount: 42,
        owner: { username: 'author', displayName: 'Auteur', avatarUrl: null },
        pinnedPosts: [], recentPosts: [] };
    }
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(data) });
  });
  await page.goto('/creator/author');
  await expect(page.getByRole('heading', { name: 'Atelier de création' })).toBeVisible();
  return { methods };
}

test('an existing subscription is correctly shown and unfollowed exactly once', async ({ page }) => {
  const state = await openCreator(page, { following: true });
  const unfollow = page.getByRole('button', { name: 'Ne plus suivre' });
  await expect(unfollow).toBeVisible();
  await expect(page.getByText('42 abonnés')).toBeVisible();
  await unfollow.click();
  await expect(page.getByRole('button', { name: 'Suivre', exact: true })).toBeVisible();
  await expect(page.getByText('41 abonnés')).toBeVisible();
  expect(state.methods).toEqual(['DELETE']);
});

test('creator owners see edit, never their own follow action', async ({ page }) => {
  const state = await openCreator(page, { following: false, owner: true });
  await expect(page.getByRole('link', { name: 'Modifier ma page' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Suivre', exact: true })).toHaveCount(0);
  expect(state.methods).toEqual([]);
});
