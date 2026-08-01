'use client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

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

    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store'
    });

    if (!response.ok) {
      clearSession();
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

async function request(path: string, init: RequestInit, retryAfterRefresh: boolean) {
  const token = getAccessToken();
  const headers = new Headers(init.headers);

  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: 'no-store'
  });

  if (response.status === 401 && retryAfterRefresh && !path.startsWith('/auth/')) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return request(path, init, false);
    }
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

  return data;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  return request(path, init, true) as Promise<T>;
}
