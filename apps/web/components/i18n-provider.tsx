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
import { useEffect, useMemo, useSyncExternalStore } from 'react';
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

type LocaleState = {
  locale: SupportedLocale;
  version: number;
  persisted: boolean;
  ready: boolean;
};

const serverState: LocaleState = {
  locale: DEFAULT_LOCALE,
  version: 0,
  persisted: false,
  ready: false
};
let state: LocaleState = serverState;
const listeners = new Set<() => void>();
let runtimeConsumers = 0;
let localeEventListener: ((event: Event) => void) | null = null;

function emit(next: Partial<LocaleState>) {
  const candidate = { ...state, ...next };
  if (
    candidate.locale === state.locale &&
    candidate.version === state.version &&
    candidate.persisted === state.persisted &&
    candidate.ready === state.ready
  ) {
    return;
  }
  state = candidate;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return serverState;
}

function applyLocale(locale: SupportedLocale, persist: boolean) {
  emit({ locale });
  if (persist) {
    persistRuntimeLocale(locale);
  } else {
    applyRuntimeLocale(locale);
  }
}

async function refreshLocalePreference() {
  if (!getAccessToken()) return null;
  const preference = await apiFetch<LocalePreference>('/i18n/preferences');
  emit({
    locale: preference.locale,
    version: preference.version,
    persisted: preference.persisted
  });
  persistRuntimeLocale(preference.locale);
  return preference;
}

async function syncLocalePreference(nextLocale: SupportedLocale) {
  try {
    const preference = await apiFetch<LocalePreference>('/i18n/preferences', {
      method: 'PUT',
      body: JSON.stringify({
        locale: nextLocale,
        expectedVersion: state.version
      })
    });
    emit({
      locale: preference.locale,
      version: preference.version,
      persisted: true
    });
    persistRuntimeLocale(preference.locale);
    return preference;
  } catch (cause) {
    if ((cause as ApiError)?.code === 'I18N_VERSION_CONFLICT') {
      await refreshLocalePreference().catch(() => undefined);
    }
    throw cause;
  }
}

function mountRuntime() {
  runtimeConsumers += 1;
  if (runtimeConsumers === 1) {
    const initial = getRuntimeLocale();
    state = { ...state, locale: initial, ready: true };
    applyRuntimeLocale(initial);
    listeners.forEach((listener) => listener());

    localeEventListener = (event: Event) => {
      const nextLocale = (event as CustomEvent<SupportedLocale>).detail;
      if (nextLocale) emit({ locale: nextLocale });
    };
    window.addEventListener(LOCALE_CHANGE_EVENT, localeEventListener);
    void refreshLocalePreference().catch(() => undefined);
  }

  return () => {
    runtimeConsumers = Math.max(0, runtimeConsumers - 1);
    if (runtimeConsumers === 0 && localeEventListener) {
      window.removeEventListener(LOCALE_CHANGE_EVENT, localeEventListener);
      localeEventListener = null;
    }
  };
}

export function I18nRuntime() {
  useEffect(() => mountRuntime(), []);
  return null;
}

export function useI18n() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return useMemo(
    () => ({
      ...snapshot,
      t: (key: MessageKey, params?: TranslationParams) =>
        translate(snapshot.locale, key, params),
      number: (value: number, options?: Intl.NumberFormatOptions) =>
        formatNumber(snapshot.locale, value, options),
      date: (
        value: Date | string | number,
        options?: Intl.DateTimeFormatOptions
      ) => formatDate(snapshot.locale, value, options),
      setLocalLocale: (locale: SupportedLocale) => applyLocale(locale, true),
      syncLocale: syncLocalePreference,
      refresh: refreshLocalePreference
    }),
    [snapshot]
  );
}
