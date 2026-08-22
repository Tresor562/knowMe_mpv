import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { getRuntimeLocale, localizeApiFailure } from './i18n-runtime';

const DEVELOPMENT_API_URL = 'http://10.0.2.2:4000';

export function resolveApiUrl(rawValue: string | undefined, isDevelopment: boolean) {
  const candidate = rawValue?.trim();
  if (!candidate) {
    if (isDevelopment) return DEVELOPMENT_API_URL;
    throw new Error('KnowMe mobile production requires EXPO_PUBLIC_API_URL.');
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('EXPO_PUBLIC_API_URL must be a valid absolute URL.');
  }

  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('EXPO_PUBLIC_API_URL must not contain credentials, query parameters, or fragments.');
  }

  if (!isDevelopment) {
    const host = parsed.hostname.toLowerCase();
    const localHost = host === 'localhost'
      || host === '127.0.0.1'
      || host === '0.0.0.0'
      || host === '::1'
      || host === '10.0.2.2';
    if (parsed.protocol !== 'https:') {
      throw new Error('EXPO_PUBLIC_API_URL must use HTTPS in production.');
    }
    if (localHost) {
      throw new Error('EXPO_PUBLIC_API_URL must not target a local host in production.');
    }
  } else if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('EXPO_PUBLIC_API_URL must use HTTP or HTTPS.');
  }

  return candidate.replace(/\/+$/, '');
}

export const API_URL = resolveApiUrl(process.env.EXPO_PUBLIC_API_URL, __DEV__);
const ACCESS_KEY = 'knowme_access_token';
const REFRESH_KEY = 'knowme_refresh_token';
const TRUSTED_DEVICE_KEY = 'knowme_trusted_device_token';

export type SessionTokens = {
  accessToken: string;
  refreshToken?: string;
  trustedDeviceToken?: string;
};
export type ApiError = Error & {
  status?: number;
  code?: string;
  requestId?: string;
  details?: unknown;
};

type ApiErrorPayload = {
  code?: string;
  message?: string | string[];
  details?: unknown;
  requestId?: string;
};

let refreshPromise: Promise<string | null> | null = null;

async function secureGet(key: string) {
  if (Platform.OS === 'web') return AsyncStorage.getItem(key);

  try {
    const value = await SecureStore.getItemAsync(key);
    if (value) return value;

    const legacy = await AsyncStorage.getItem(key);
    if (legacy) {
      await SecureStore.setItemAsync(key, legacy, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
      });
      await AsyncStorage.removeItem(key);
    }
    return legacy;
  } catch {
    return AsyncStorage.getItem(key);
  }
}

async function secureSet(key: string, value: string) {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
    return;
  }

  try {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
    });
    await AsyncStorage.removeItem(key);
  } catch {
    await AsyncStorage.setItem(key, value);
  }
}

async function secureDelete(key: string) {
  await AsyncStorage.removeItem(key);
  if (Platform.OS === 'web') return;
  await SecureStore.deleteItemAsync(key).catch(() => undefined);
}

export function getAccessToken() {
  return secureGet(ACCESS_KEY);
}

export function getTrustedDeviceToken() {
  return secureGet(TRUSTED_DEVICE_KEY);
}

export async function saveTrustedDeviceToken(token: string) {
  await secureSet(TRUSTED_DEVICE_KEY, token);
}

export function clearTrustedDeviceToken() {
  return secureDelete(TRUSTED_DEVICE_KEY);
}

export async function saveSession(tokens: SessionTokens) {
  await secureSet(ACCESS_KEY, tokens.accessToken);
  if (tokens.refreshToken) await secureSet(REFRESH_KEY, tokens.refreshToken);
  if (tokens.trustedDeviceToken) {
    await saveTrustedDeviceToken(tokens.trustedDeviceToken);
  }
}

export async function clearSession() {
  await Promise.all([secureDelete(ACCESS_KEY), secureDelete(REFRESH_KEY)]);
}

export async function hasSession() {
  return Boolean(await getAccessToken());
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = await secureGet(REFRESH_KEY);
    if (!refreshToken) return null;

    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': getRuntimeLocale()
      },
      body: JSON.stringify({ refreshToken })
    });

    if (!response.ok) {
      await clearSession();
      return null;
    }

    const tokens = (await response.json()) as SessionTokens;
    await saveSession(tokens);
    return tokens.accessToken;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  allowRefresh = true
): Promise<T> {
  const accessToken = await getAccessToken();
  const headers = new Headers(init.headers);

  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('Accept-Language')) {
    headers.set('Accept-Language', getRuntimeLocale());
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (response.status === 401 && allowRefresh && !path.startsWith('/auth/')) {
    const renewedToken = await refreshAccessToken();
    if (renewedToken) return apiFetch<T>(path, init, false);
  }

  const data = await response.json().catch(() => null) as ApiErrorPayload | null;
  if (!response.ok) {
    const requestId = data?.requestId ?? response.headers.get('x-request-id') ?? undefined;
    const fallback = Array.isArray(data?.message)
      ? data.message.join(', ')
      : data?.message ?? 'Une erreur est survenue.';
    const error = new Error(
      localizeApiFailure(data?.code, fallback, requestId)
    ) as ApiError;
    error.status = response.status;
    error.code = data?.code;
    error.requestId = requestId;
    error.details = data?.details;
    throw error;
  }

  return data as T;
}
