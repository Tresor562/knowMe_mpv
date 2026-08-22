import { safeExceptionPath } from './api-exception.filter';

describe('ApiExceptionFilter privacy boundary', () => {
  it('removes query strings from exception response and log paths', () => {
    expect(
      safeExceptionPath({
        originalUrl: '/auth/reset?token=super-secret&email=user@example.com',
        url: '/auth/reset?token=super-secret'
      })
    ).toBe('/auth/reset');
  });

  it('falls back to url and keeps only the path', () => {
    expect(safeExceptionPath({ url: '/account/export?code=1234' })).toBe('/account/export');
    expect(safeExceptionPath({ url: '/' })).toBe('/');
  });
});
