import {
  DEFAULT_LOCALE,
  formatDate,
  formatNumber,
  resolveTextDirection,
  translate,
  type MessageKey,
  type SupportedLocale,
  type TranslationParams
} from '@knowme/i18n-contract';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { apiFetch, hasSession, type ApiError } from './api';
import {
  getRuntimeLocale,
  loadRuntimeLocale,
  persistRuntimeLocale
} from './i18n-runtime';

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
  direction: 'ltr' | 'rtl';
  version: number;
  persisted: boolean;
  ready: boolean;
  t: (key: MessageKey, params?: TranslationParams) => string;
  number: (value: number, options?: Intl.NumberFormatOptions) => string;
  date: (
    value: Date | string | number,
    options?: Intl.DateTimeFormatOptions
  ) => string;
  setLocalLocale: (locale: SupportedLocale) => Promise<void>;
  syncLocale: (locale: SupportedLocale) => Promise<LocalePreference>;
  refresh: () => Promise<LocalePreference | null>;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<SupportedLocale>(getRuntimeLocale());
  const [version, setVersion] = useState(0);
  const [persisted, setPersisted] = useState(false);
  const [ready, setReady] = useState(false);

  const apply = useCallback(async (nextLocale: SupportedLocale) => {
    setLocale(nextLocale);
    await persistRuntimeLocale(nextLocale);
  }, []);

  const refresh = useCallback(async () => {
    if (!(await hasSession())) return null;
    const preference = await apiFetch<LocalePreference>('/i18n/preferences');
    setVersion(preference.version);
    setPersisted(preference.persisted);
    await apply(preference.locale);
    return preference;
  }, [apply]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const initial = await loadRuntimeLocale();
      if (active) setLocale(initial);
      await refresh().catch(() => null);
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
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
        await apply(preference.locale);
        return preference;
      } catch (cause) {
        if ((cause as ApiError)?.code === 'I18N_VERSION_CONFLICT') {
          await refresh().catch(() => null);
        }
        throw cause;
      }
    },
    [apply, refresh, version]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      direction: resolveTextDirection(locale),
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

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider.');
  }
  return context;
}
