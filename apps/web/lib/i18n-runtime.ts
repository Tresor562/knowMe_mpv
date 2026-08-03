'use client';

import {
  DEFAULT_LOCALE,
  normalizeLocale,
  resolveTextDirection,
  translateApiError,
  withSupportReference,
  type SupportedLocale
} from '@knowme/i18n-contract';

export const LOCALE_STORAGE_KEY = 'knowme-locale';
export const LOCALE_CHANGE_EVENT = 'knowme:locale-change';

export function getRuntimeLocale(): SupportedLocale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored) return normalizeLocale(stored);
  const detected = window.navigator.languages?.[0] ?? window.navigator.language;
  return normalizeLocale(detected);
}

export function applyRuntimeLocale(locale: SupportedLocale) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.documentElement.dir = resolveTextDirection(locale);
  document.documentElement.dataset.locale = locale;
}

export function persistRuntimeLocale(locale: SupportedLocale) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  applyRuntimeLocale(locale);
  window.dispatchEvent(
    new CustomEvent<SupportedLocale>(LOCALE_CHANGE_EVENT, { detail: locale })
  );
}

export function localizeApiFailure(
  code: string | undefined,
  fallback: string,
  requestId?: string
) {
  const locale = getRuntimeLocale();
  return withSupportReference(
    locale,
    translateApiError(locale, code, fallback),
    requestId
  );
}
