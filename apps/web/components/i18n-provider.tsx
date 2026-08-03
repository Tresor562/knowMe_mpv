'use client';

import {
  DEFAULT_LOCALE,
  formatDate,
  formatNumber,
  translate,
  type MessageKey,
  type SupportedLocale,
  type TranslationParams
} from '@knowme/i18n-contract';
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { apiFetch, getAccessToken, type ApiError } from '../lib/api';
import {
  LOCALE_CHANGE_EVENT,
  applyRuntimeLocale,
  getRuntimeLocale,
  persistRuntimeLocale
} from '../lib/i18n-runtime';

type LocalePreference = {
  locale: SupportedLocale;
  direction: 'ltr' | 'rtl';
  source: string;
  version: number;
  persisted: boolean;
  updatedAt: string | null;
};

type I18nContextValue = {
  locale: SupportedLocale;
  version: number;
  persisted: boolean;
  ready: boolean;
  t: (key: MessageKey, params?: TranslationParams) => string;
  number: (value: number, options?: Intl.NumberFormatOptions) => string;
  date: (
    value: Date | string | number,
    options?: Intl.DateTimeFormatOptions
  ) => string;
  setLocalLocale: (locale: SupportedLocale) => void;
  syncLocale: (locale: SupportedLocale) => Promise<LocalePreference>;
  refresh: () => Promise<LocalePreference | null>;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<SupportedLocale>(DEFAULT_LOCALE);
  const [version, setVersion] = useState(0);
  const [persisted, setPersisted] = useState(false);
  const [ready, setReady] = useState(false);

  const apply = useCallback((nextLocale: SupportedLocale) => {
    setLocale(nextLocale);
    persistRuntimeLocale(nextLocale);
  }, []);

  const refresh = useCallback(async () => {
    if (!getAccessToken()) return null;
    const preference = await apiFetch<LocalePreference>('/i18n/preferences');
    setVersion(preference.version);
    setPersisted(preference.persisted);
    apply(preference.locale);
    return preference;
  }, [apply]);

  useEffect(() => {
    const initial = getRuntimeLocale();
    setLocale(initial);
    applyRuntimeLocale(initial);
    setReady(true);

    const onLocaleChange = (event: Event) => {
      const nextLocale = (event as CustomEvent<SupportedLocale>).detail;
      if (nextLocale) setLocale(nextLocale);
    };
    window.addEventListener(LOCALE_CHANGE_EVENT, onLocaleChange);
    void refresh().catch(() => undefined);
    return () => window.removeEventListener(LOCALE_CHANGE_EVENT, onLocaleChange);
  }, [refresh]);

  const syncLocale = useCallback(
    async (nextLocale: SupportedLocale) => {
      try {
        const preference = await apiFetch<LocalePreference>('/i18n/preferences', {
          method: 'PUT',
          body: JSON.stringify({ locale: nextLocale, expectedVersion: version })
        });
        setVersion(preference.version);
        setPersisted(true);
        apply(preference.locale);
        return preference;
      } catch (cause) {
        if ((cause as ApiError)?.code === 'I18N_VERSION_CONFLICT') {
          await refresh().catch(() => undefined);
        }
        throw cause;
      }
    },
    [apply, refresh, version]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      version,
      persisted,
      ready,
      t: (key, params) => translate(locale, key, params),
      number: (value, options) => formatNumber(locale, value, options),
      date: (value, options) => formatDate(locale, value, options),
      setLocalLocale: apply,
      syncLocale,
      refresh
    }),
    [apply, locale, persisted, ready, refresh, syncLocale, version]
  );

  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider.');
  }
  return context;
}
