import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000';
const ACCESS_KEY = 'knowme_access_token';
const REFRESH_KEY = 'knowme_refresh_token';

export type SessionTokens = { accessToken: string; refreshToken?: string };
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

export async function getAccessToken() {
  return AsyncStorage.getItem(ACCESS_KEY);
}

export async function saveSession(tokens: SessionTokens) {
  const pairs: [string, string][] = [[ACCESS_KEY, tokens.accessToken]];
  if (tokens.refreshToken) pairs.push([REFRESH_KEY, tokens.refreshToken]);
  await AsyncStorage.multiSet(pairs);
}

export async function clearSession() {
  await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY]);
}

export async function hasSession() {
  return Boolean(await getAccessToken());
}

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = await AsyncStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return null;

    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
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
    const baseMessage = Array.isArray(data?.message)
      ? data.message.join(', ')
      : data?.message ?? 'Une erreur est survenue.';
    const message = requestId
      ? `${baseMessage} (référence support : ${requestId})`
      : baseMessage;
    const error = new Error(message) as ApiError;
    error.status = response.status;
    error.code = data?.code;
    error.requestId = requestId;
    error.details = data?.details;
    throw error;
  }

  return data as T;
}
