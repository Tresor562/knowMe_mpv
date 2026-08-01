'use client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type ApiError = Error & { status?: number };

export function getAccessToken() {
  return typeof window === 'undefined'
    ? null
    : window.localStorage.getItem('knowme_token');
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

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
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

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      Array.isArray(data?.message)
        ? data.message.join(', ')
        : data?.message ?? 'Une erreur est survenue.'
    ) as ApiError;
    error.status = response.status;
    throw error;
  }

  return data as T;
}
