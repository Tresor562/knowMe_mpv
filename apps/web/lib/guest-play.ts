'use client';

import { getRuntimeLocale, localizeApiFailure } from './i18n-runtime';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const GUEST_TOKEN_KEY = 'knowme_guest_token';
const GUEST_GAME_SESSION_KEY = 'knowme_guest_quick_math_session';
export const GUEST_CONSENT_VERSION = '2026-08-22';

export type GuestAgeGateState = 'ADULT' | 'MINOR_ALLOWED';

export type GuestIdentity = {
  id: string;
  publicAlias: string | null;
  locale: string;
  consentVersion: string;
  ageGateState: GuestAgeGateState | 'UNKNOWN';
  status: 'ACTIVE' | 'REVOKED' | 'CONVERTED' | 'BLOCKED';
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
};

export type GuestGameQuestion = {
  left: number;
  right: number;
  operator: '+' | '-';
};

export type GuestQuickMathState = {
  engine: 'QUICK_MATH_V1';
  phase: 'READY' | 'ACTIVE' | 'COMPLETED';
  round: number;
  maxRounds: number;
  score: number;
  question: GuestGameQuestion | null;
  lastOutcome: {
    round: number;
    submittedAnswer: number;
    correctAnswer: number;
    correct: boolean;
  } | null;
  completed: boolean;
};

export type GuestQuickMathSession = {
  id: string;
  game: {
    key: 'quick-math';
    version: number;
    name: string;
    description: string;
    rules: unknown;
  };
  status: 'ACTIVE' | 'COMPLETED' | 'ABANDONED' | 'EXPIRED';
  sequence: number;
  state: GuestQuickMathState;
  stateHash: string;
  currentTurnPosition: number | null;
  result: {
    outcome: string;
    score: number;
    correctAnswers: number;
    rounds: number;
  } | null;
  expiresAt: string;
  completedAt: string | null;
  serverAuthoritative: true;
  economicStake: null;
  accountRequired: false;
  replayed?: boolean;
};

type GuestCreationResponse = {
  token: string;
  guest: GuestIdentity;
};

type ApiFailure = {
  code?: string;
  message?: string | string[];
  requestId?: string;
};

export function getGuestToken() {
  return typeof window === 'undefined' ? null : window.localStorage.getItem(GUEST_TOKEN_KEY);
}

export function clearGuestSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(GUEST_TOKEN_KEY);
  window.localStorage.removeItem(GUEST_GAME_SESSION_KEY);
}

export function getSavedQuickMathSessionId() {
  return typeof window === 'undefined'
    ? null
    : window.localStorage.getItem(GUEST_GAME_SESSION_KEY);
}

export function saveQuickMathSessionId(sessionId: string) {
  window.localStorage.setItem(GUEST_GAME_SESSION_KEY, sessionId);
}

export function clearQuickMathSessionId() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(GUEST_GAME_SESSION_KEY);
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null) as T | ApiFailure | null;
  if (response.ok) return data as T;

  const failure = data as ApiFailure | null;
  const requestId = failure?.requestId ?? response.headers.get('x-request-id') ?? undefined;
  const fallback = Array.isArray(failure?.message)
    ? failure.message.join(', ')
    : failure?.message ?? 'Une erreur est survenue.';
  const error = new Error(localizeApiFailure(failure?.code, fallback, requestId)) as Error & {
    status?: number;
    code?: string;
  };
  error.status = response.status;
  error.code = failure?.code;
  throw error;
}

async function guestRequest<T>(path: string, init: RequestInit = {}, token = getGuestToken()) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  headers.set('Accept-Language', getRuntimeLocale());
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: 'no-store'
  });
  return parseResponse<T>(response);
}

export async function createGuestIdentity(input: {
  publicAlias?: string;
  ageGateState: GuestAgeGateState;
}) {
  const response = await fetch(`${API_URL}/guest/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': getRuntimeLocale()
    },
    body: JSON.stringify({
      ...(input.publicAlias?.trim() ? { publicAlias: input.publicAlias.trim() } : {}),
      locale: getRuntimeLocale(),
      consentVersion: GUEST_CONSENT_VERSION,
      ageGateState: input.ageGateState
    }),
    cache: 'no-store'
  });
  const created = await parseResponse<GuestCreationResponse>(response);
  window.localStorage.setItem(GUEST_TOKEN_KEY, created.token);
  return created.guest;
}

export function resumeGuestIdentity() {
  return guestRequest<GuestIdentity>('/guest/session');
}

export async function createQuickMathSession() {
  const idempotencyKey = `web:quick-math:${crypto.randomUUID()}`;
  const session = await guestRequest<GuestQuickMathSession>('/guest/games/quick-math/sessions', {
    method: 'POST',
    body: JSON.stringify({ idempotencyKey })
  });
  saveQuickMathSessionId(session.id);
  return session;
}

export function resumeQuickMathSession(sessionId: string) {
  return guestRequest<GuestQuickMathSession>(`/guest/games/sessions/${encodeURIComponent(sessionId)}`);
}

export async function submitQuickMathAction(
  session: GuestQuickMathSession,
  actionType: 'START' | 'ANSWER',
  payload: Record<string, unknown>
) {
  const idempotencyKey = `web:quick-math:${actionType.toLowerCase()}:${crypto.randomUUID()}`;
  try {
    return await guestRequest<GuestQuickMathSession>(
      `/guest/games/sessions/${encodeURIComponent(session.id)}/actions`,
      {
        method: 'POST',
        body: JSON.stringify({
          actionType,
          payload,
          expectedSequence: session.sequence,
          idempotencyKey
        })
      }
    );
  } catch (cause) {
    // A transport can fail after the server accepted an idempotent action.
    // Re-read authoritative state before surfacing an error so refresh/retry does not double-apply it.
    try {
      const recovered = await resumeQuickMathSession(session.id);
      if (recovered.sequence > session.sequence) return recovered;
    } catch {
      // Keep the original failure; recovery is best effort and never invents state.
    }
    throw cause;
  }
}
