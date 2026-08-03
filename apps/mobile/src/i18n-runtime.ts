import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_LOCALE,
  normalizeLocale,
  translateApiError,
  withSupportReference,
  type SupportedLocale
} from '@knowme/i18n-contract';

const LOCALE_STORAGE_KEY = 'knowme_locale';
let runtimeLocale: SupportedLocale = DEFAULT_LOCALE;

export function getRuntimeLocale() {
  return runtimeLocale;
}

export async function loadRuntimeLocale() {
  const stored = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
  const detected = Intl.DateTimeFormat().resolvedOptions().locale;
  runtimeLocale = normalizeLocale(stored ?? detected);
  return runtimeLocale;
}

export async function persistRuntimeLocale(locale: SupportedLocale) {
  runtimeLocale = locale;
  await AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

export function localizeApiFailure(
  code: string | undefined,
  fallback: string,
  requestId?: string
) {
  return withSupportReference(
    runtimeLocale,
    translateApiError(runtimeLocale, code, fallback),
    requestId
  );
}
