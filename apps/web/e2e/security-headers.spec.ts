import { expect, test } from '@playwright/test';

const expectedStaticHeaders = {
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'x-dns-prefetch-control': 'off',
  'cross-origin-opener-policy': 'same-origin'
};

test('production web responses expose the privacy-safe security baseline', async ({ request }) => {
  for (const path of ['/login', '/register']) {
    const response = await request.get(path);
    expect(response.ok()).toBeTruthy();

    const headers = response.headers();
    for (const [name, value] of Object.entries(expectedStaticHeaders)) {
      expect(headers[name], `${path} ${name}`).toBe(value);
    }

    expect(headers['permissions-policy']).toBe(
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
    );
    expect(headers['strict-transport-security']).toBe(
      'max-age=31536000; includeSubDomains'
    );
  }
});

test('web security headers never reflect attacker-controlled URL data', async ({ request }) => {
  const secret = 'kmd-173-secret-token';
  const response = await request.get(`/login?next=%2Fprivate&token=${secret}`);
  expect(response.ok()).toBeTruthy();

  const serializedHeaders = JSON.stringify(response.headers());
  expect(serializedHeaders).not.toContain(secret);
  expect(serializedHeaders).not.toContain('/private');
});
