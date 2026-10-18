import { expect, test } from '@playwright/test';

const prefs = {
  masterEnabled: true, realtimeEnabled: true, digestMode: 'INSTANT',
  quietHoursEnabled: false, mutedTypes: [], categorySettings: { SOCIAL: true, MESSAGING: true }
};
const old = {
  id: 'old-message', type: 'MESSAGE', category: 'MESSAGING',
  title: 'Message précédent', body: 'Déjà dans le centre',
  createdAt: '2026-10-18T12:00:00Z', readAt: null,
  data: { route: '/messages' }
};
const fresh = {
  id: 'new-mention', type: 'COMMENT_MENTION', category: 'SOCIAL',
  title: 'Mention dans un commentaire', body: 'On vous a mentionné dans une publication',
  createdAt: '2026-10-18T14:00:00Z', readAt: null,
  data: { route: '/feed/123' }
};

test('notifications arrive inside the app without replaying old activity', async ({ page }) => {
  let includeNew = false;
  await page.addInitScript(() => {
    localStorage.setItem('knowme_token', 'notification-e2e');
    localStorage.setItem('knowme-locale', 'fr');
  });
  await page.route('**/api/knowme/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = {};
    if (path.endsWith('/users/me')) body = {
      id: 'design-test', username: 'design', displayName: 'Design', email: 'design@example.test'
    };
    if (path.endsWith('/security')) body = {
      twoFactorEnabled: false, recoveryCodesRemaining: 0, sessions: [],
      trustedDevices: [], events: []
    };
    if (path.endsWith('/notifications/center')) body = {
      items: includeNew ? [fresh, old] : [old],
      totals: { unread: includeNew ? 2 : 1 }, preferences: prefs
    };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.goto('/security');
  await expect(page.getByRole('heading', { name: 'Centre de sécurité' })).toBeVisible();
  await expect(page.getByRole('link', { name: /1 notifications non lues/ })).toBeVisible();
  await expect(page.getByText('Mention dans un commentaire')).toHaveCount(0);
  includeNew = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('button', { name: /Ouvrir la notification : Mention dans un commentaire/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /2 notifications non lues/ })).toBeVisible();
  await page.getByRole('button', { name: 'Fermer cette notification' }).click();
  await expect(page.getByRole('button', { name: /Ouvrir la notification : Mention/ })).toHaveCount(0);
});

test('quiet-hours preferences suppress non-critical popups while preserving unread badge', async ({ page }) => {
  let includeNew = false;
  await page.addInitScript(() => localStorage.setItem('knowme_token', 'notification-e2e'));
  await page.route('**/api/knowme/**', async route => {
    const path = new URL(route.request().url()).pathname;
    let body: unknown = {};
    if (path.endsWith('/users/me')) body = {
      id: 'design-test', username: 'design', displayName: 'Design', email: 'design@example.test'
    };
    if (path.endsWith('/security')) body = {
      twoFactorEnabled: false, recoveryCodesRemaining: 0, sessions: [], trustedDevices: [], events: []
    };
    if (path.endsWith('/notifications/center')) body = {
      items: includeNew ? [fresh, old] : [old],
      totals: { unread: includeNew ? 2 : 1 },
      preferences: { ...prefs, quietHoursEnabled: true, quietStartMinute: 0, quietEndMinute: 1439, timezone: 'UTC' }
    };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/security');
  await expect(page.getByRole('link', { name: /1 notifications/ })).toBeVisible();
  includeNew = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('link', { name: /2 notifications/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Mention dans un commentaire/ })).toHaveCount(0);
});

test('unread count follows the existing navigation when it becomes available', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('knowme_token', 'notification-e2e'));
  await page.route('**/api/knowme/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    let body: unknown = {};
    if (pathname.endsWith('/users/me')) body = {
      id: 'design-test', username: 'design', displayName: 'Design', email: 'design@example.test'
    };
    if (pathname.endsWith('/security')) body = {
      twoFactorEnabled: false, recoveryCodesRemaining: 0,
      sessions: [], trustedDevices: [], events: []
    };
    if (pathname.endsWith('/notifications/center')) body = {
      items: [old], totals: { unread: 1 }, preferences: prefs
    };
    if (pathname.endsWith('/notifications/unread-count')) body = { count: 145 };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.goto('/security');
  await expect(page.getByRole('link', { name: /145 notifications/ })).toBeVisible();

  await page.evaluate(() => {
    const nav = document.createElement('nav');
    nav.className = 'km-smart-nav';
    const link = document.createElement('a');
    link.href = '/notifications';
    link.textContent = 'Alertes';
    nav.appendChild(link);
    document.body.appendChild(nav);
  });
  await expect(page.locator('nav.km-smart-nav a[href="/notifications"] .km-live-nav-badge')).toHaveText('99+');
  await expect(page.locator('.km-live-notification-counter')).toHaveCount(0);
  await page.evaluate(() => document.querySelector('nav.km-smart-nav')?.remove());
  await expect(page.getByRole('link', { name: /145 notifications/ })).toBeVisible();
});

test('session changes update alerts without hydration mismatches or leaking previous account notices', async ({ page }) => {
  await page.route('**/api/knowme/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    let data: unknown = {};
    if (pathname.endsWith('/users/me')) data = {
      id: 'design-user', username: 'design', displayName: 'Design', email: 'design@example.test'
    };
    if (pathname.endsWith('/notifications/center')) data = {
      items: [old], totals: { unread: 1 }, preferences: prefs
    };
    if (pathname.endsWith('/notifications/unread-count')) data = { count: 1 };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto('/login');
  await expect(page.locator('.km-live-notification-dock')).toHaveCount(0);
  await page.evaluate(() => {
    localStorage.setItem('knowme_token', 'new-account-token');
    window.dispatchEvent(new Event('knowme-session-changed'));
  });
  await expect(page.locator('.km-live-notification-counter')).toContainText('1');
  await page.evaluate(() => {
    localStorage.removeItem('knowme_token');
    window.dispatchEvent(new Event('knowme-session-changed'));
  });
  await expect(page.locator('.km-live-notification-dock')).toHaveCount(0);
});
