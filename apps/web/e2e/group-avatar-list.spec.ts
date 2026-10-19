import { expect, test, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==',
  'base64'
);
const picture = Buffer.concat([tinyPng, Buffer.alloc(1100)]);

async function setup(page: Page, includeGroup = true) {
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token', 'chat-avatar-test-token');
    localStorage.setItem('knowme-locale', 'fr');
  });
  let available = true;
  let reads = 0;
  let authenticated = 0;
  await page.route('**/api/knowme/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    const json = (data: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) });

    if (pathname.endsWith('/users/me'))
      return json({ id: 'me', username: 'moi', displayName: 'Moi', email: 'me@example.test' });
    if (pathname.endsWith('/i18n/preferences'))
      return json({ locale: 'fr', direction: 'ltr', source: 'user', version: 1 });
    if (pathname.endsWith('/conversations'))
      return json(includeGroup ? [{
        id: 'group-1', isGroup: true, title: 'Club de sciences', unreadCount: 0,
        members: [
          { userId: 'me', user: { id: 'me', displayName: 'Moi', username: 'moi' } },
          { userId: 'other', user: { id: 'other', displayName: 'Ali', username: 'ali' } }
        ], messages: []
      }] : []);
    if (pathname.endsWith('/conversation-pins')) return json({ items: [], limit: 5 });
    if (pathname.endsWith('/conversations/group-1/group/avatar')) {
      reads++;
      if (route.request().headers()['authorization'] === 'Bearer chat-avatar-test-token') authenticated++;
      return available
        ? route.fulfill({ status: 200, contentType: 'image/png', body: picture })
        : json({ code: 'GROUP_AVATAR_NOT_FOUND' }, 404);
    }
    if (pathname.endsWith('/notifications/center'))
      return json({ items: [], totals: { unread: 0 } });
    if (pathname.endsWith('/notifications/unread-count')) return json({ count: 0 });
    return json({});
  });
  return { reads: () => reads, authenticated: () => authenticated,
    removePicture: () => { available = false; } };
}

test('chat list displays a member-only group photo through the authenticated image endpoint', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/messages');
  await expect(page.getByRole('link', { name: 'Ouvrir la discussion Club de sciences' })).toBeVisible();
  const avatar = page.locator('.km-chat-row .km-group-chat-thumbnail');
  await expect(avatar.locator('img.km-chat-avatar-image')).toBeVisible();
  await expect(avatar.locator('img')).toHaveAttribute('src', /^blob:/);
  expect(state.reads()).toBe(1);
  expect(state.authenticated()).toBe(1);

  // A server-side removal must not leave the old blob visibly cached after refresh.
  state.removePicture();
  await page.getByRole('button', { name: 'Actualiser' }).click();
  await expect(avatar.locator('img')).toHaveCount(0);
  await expect(avatar).toContainText('C');
  expect(state.reads()).toBe(2);
});

test('group avatar is never requested when the user has no listed group membership', async ({ page }) => {
  const state = await setup(page, false);
  await page.goto('/messages');
  await expect(page.getByText('Aucune discussion pour le moment')).toBeVisible();
  expect(state.reads()).toBe(0);
});
