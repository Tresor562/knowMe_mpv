import {
  DEFAULT_LOCALE,
  formatDate,
  formatNumber,
  normalizeLocale,
  parseAcceptLanguage,
  resolveTextDirection,
  translate,
  translateApiError,
  translateCount,
  withSupportReference
} from '@knowme/i18n-contract';

describe('KMD-049 shared i18n contract', () => {
  it('normalizes regional tags and falls back deterministically', () => {
    expect(normalizeLocale('en-US')).toBe('en');
    expect(normalizeLocale('fr_BJ')).toBe('fr');
    expect(normalizeLocale('pt-BR')).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale(null)).toBe(DEFAULT_LOCALE);
  });

  it('honors Accept-Language quality while ignoring unsupported languages', () => {
    expect(parseAcceptLanguage('pt-BR;q=1, en-US;q=0.8, fr;q=0.4')).toBe('en');
    expect(parseAcceptLanguage('en;q=0.2, fr-BJ;q=0.9')).toBe('fr');
    expect(parseAcceptLanguage('de, es;q=0.7')).toBe('fr');
  });

  it('interpolates messages and applies locale plural rules', () => {
    expect(translate('en', 'common.currentLanguage', { language: 'English' })).toBe(
      'Current language: English'
    );
    expect(translateCount('fr', 1, 'notifications.one', 'notifications.other')).toBe(
      '1 alerte'
    );
    expect(translateCount('en', 4, 'messages.one', 'messages.other')).toBe(
      '4 messages'
    );
  });

  it('localizes stable API codes and preserves request references', () => {
    const localized = translateApiError('en', 'FORBIDDEN', 'Texte serveur');
    expect(localized).toBe('You are not allowed to perform this action.');
    expect(withSupportReference('en', localized, 'req-049')).toBe(
      'You are not allowed to perform this action. (Support reference: req-049)'
    );
    expect(translateApiError('fr', 'UNKNOWN_CODE', 'Message métier précis.')).toBe(
      'Message métier précis.'
    );
  });

  it('exposes deterministic direction and Intl-based formatting', () => {
    expect(resolveTextDirection('ar-BJ')).toBe('rtl');
    expect(resolveTextDirection('fr-BJ')).toBe('ltr');
    expect(formatNumber('en', 1250, { maximumFractionDigits: 0 })).toMatch(/1,250/);
    expect(
      formatDate('fr', '2026-08-03T12:00:00.000Z', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      })
    ).toContain('03');
  });
});
