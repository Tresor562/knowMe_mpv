'use client';

import { getRuntimeLocale, localizeApiFailure } from './i18n-runtime';

const API_URL = '/api/knowme';
const TRUSTED_DEVICE_KEY = 'knowme_trusted_device_token';

export type ApiError = Error & {
  status?: number;
  code?: string;
  requestId?: string;
  details?: unknown;
};

type RefreshResponse = {
  accessToken: string;
  refreshToken?: string;
};

type ApiErrorPayload = {
  code?: string;
  message?: string | string[];
  details?: unknown;
  requestId?: string;
};

let refreshRequest: Promise<boolean> | null = null;

export function getAccessToken() {
  return typeof window === 'undefined'
    ? null
    : window.localStorage.getItem('knowme_token');
}

export function getRefreshToken() {
  return typeof window === 'undefined'
    ? null
    : window.localStorage.getItem('knowme_refresh_token');
}

export function getTrustedDeviceToken() {
  return typeof window === 'undefined'
    ? null
    : window.localStorage.getItem(TRUSTED_DEVICE_KEY);
}

export function saveTrustedDeviceToken(token: string) {
  window.localStorage.setItem(TRUSTED_DEVICE_KEY, token);
}

export function clearTrustedDeviceToken() {
  window.localStorage.removeItem(TRUSTED_DEVICE_KEY);
}

export function saveSession(accessToken: string, refreshToken?: string) {
  window.localStorage.setItem('knowme_token', accessToken);
  if (refreshToken) {
    window.localStorage.setItem('knowme_refresh_token', refreshToken);
  }
}

export function clearSession() {
  window.localStorage.removeItem('knowme_token');
  window.localStorage.removeItem('knowme_refresh_token');
}

async function refreshSession() {
  if (refreshRequest) return refreshRequest;

  refreshRequest = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    let response: Response;
    try {
      response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': getRuntimeLocale()
        },
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
        signal: AbortSignal.timeout(16000)
      });
    } catch {
      // A transient backend outage must not log the user out.
      return false;
    }

    if (!response.ok) {
      // Only an explicitly rejected refresh token invalidates the session.
      if ([400, 401, 403].includes(response.status)) clearSession();
      return false;
    }

    const data = await response.json() as RefreshResponse;
    saveSession(data.accessToken, data.refreshToken);
    return true;
  })().finally(() => {
    refreshRequest = null;
  });

  return refreshRequest;
}


/** Retry only read-only requests. POST uploads/posts can have succeeded before
 * their response was lost; retrying them here would create duplicates. */
async function fetchWithReadRetries(path: string, init: RequestInit, headers: Headers): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const readOnly = method === 'GET' || method === 'HEAD';
  const attempts = readOnly ? 3 : 1;
  const timeout = init.body instanceof FormData ? 120000 : 16000;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(`${API_URL}${path}`, {
        ...init,
        headers,
        cache: 'no-store',
        signal: init.signal ?? AbortSignal.timeout(timeout)
      });
      if (readOnly && [502, 503, 504].includes(response.status) && attempt < attempts - 1) {
        await new Promise<void>(resolve => setTimeout(resolve, 300 * (attempt + 1)));
        continue;
      }
      return response;
    } catch (cause) {
      if (init.signal?.aborted) throw cause;
      if (readOnly && attempt < attempts - 1) {
        await new Promise<void>(resolve => setTimeout(resolve, 300 * (attempt + 1)));
        continue;
      }
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      const timedOut = cause instanceof Error &&
        (cause.name === 'TimeoutError' || cause.name === 'AbortError');
      const error = new Error(offline
        ? 'Connexion Internet indisponible. Vérifie ton réseau.'
        : timedOut
          ? 'Le serveur KnowMe met trop de temps à répondre. Réessaie.'
          : 'KnowMe est momentanément inaccessible. Réessaie.') as ApiError;
      error.code = offline ? 'KNOWME_OFFLINE' : timedOut ? 'KNOWME_TIMEOUT' : 'KNOWME_NETWORK_UNAVAILABLE';
      throw error;
    }
  }
  throw new Error('Requête KnowMe non aboutie.');
}

async function request(path: string, init: RequestInit, retryAfterRefresh: boolean) {
  const token = getAccessToken();
  const headers = new Headers(init.headers);

  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('Accept-Language')) {
    headers.set('Accept-Language', getRuntimeLocale());
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetchWithReadRetries(path, init, headers);

  if (response.status === 401 && retryAfterRefresh && !path.startsWith('/auth/')) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return request(path, init, false);
    }
  }

  const data = await response.json().catch(() => null) as ApiErrorPayload | null;

  if (!response.ok) {
    const requestId = data?.requestId ?? response.headers.get('x-request-id') ?? undefined;
    const fallback = Array.isArray(data?.message)
      ? data.message.join(', ')
      : data?.message ?? (response.status >= 500 ? 'Le serveur KnowMe est momentanément indisponible. Réessayez dans un instant.' : 'Une erreur est survenue.');
    const error = new Error(
      localizeApiFailure(data?.code, fallback, requestId)
    ) as ApiError;
    error.status = response.status;
    error.code = data?.code;
    error.requestId = requestId;
    error.details = data?.details;
    throw error;
  }

  return data;
}

async function requestBlob(path: string, retryAfterRefresh: boolean): Promise<Blob> {
  const token = getAccessToken();
  const headers = new Headers({ 'Accept-Language': getRuntimeLocale() });
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(90000)
    });
  } catch {
    const error = new Error('Téléchargement impossible : serveur KnowMe inaccessible.') as ApiError;
    error.code = 'KNOWME_NETWORK_UNAVAILABLE';
    throw error;
  }

  if (response.status === 401 && retryAfterRefresh && !path.startsWith('/auth/')) {
    const refreshed = await refreshSession();
    if (refreshed) return requestBlob(path, false);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null) as ApiErrorPayload | null;
    const requestId = data?.requestId ?? response.headers.get('x-request-id') ?? undefined;
    const fallback = Array.isArray(data?.message)
      ? data.message.join(', ')
      : data?.message ?? 'Une erreur est survenue.';
    const error = new Error(localizeApiFailure(data?.code, fallback, requestId)) as ApiError;
    error.status = response.status;
    error.code = data?.code;
    error.requestId = requestId;
    error.details = data?.details;
    throw error;
  }

  return response.blob();
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  return request(path, init, true) as Promise<T>;
}

export function apiFetchBlob(path: string): Promise<Blob> {
  return requestBlob(path, true);
}
