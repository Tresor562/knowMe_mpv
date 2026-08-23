import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_URL } from './api';
import { shouldClearGuestCredentialAfterRevocationFailure } from './guest-revocation-model';
import { getRuntimeLocale, localizeApiFailure } from './i18n-runtime';

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

export type GuestQuickMathState = {
  engine: 'QUICK_MATH_V1';
  phase: 'READY' | 'ACTIVE' | 'COMPLETED';
  round: number;
  maxRounds: number;
  score: number;
  question: { left: number; right: number; operator: '+' | '-' } | null;
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

type GuestCreationResponse = { token: string; guest: GuestIdentity };
type ApiFailure = {
  code?: string;
  message?: string | string[];
  requestId?: string;
};

async function guestSecureGet(key: string) {
  if (Platform.OS === 'web') return AsyncStorage.getItem(key);
  try {
    const stored = await SecureStore.getItemAsync(key);
    if (stored) return stored;
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

async function guestSecureSet(key: string, value: string) {
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

async function guestSecureDelete(key: string) {
  await AsyncStorage.removeItem(key);
  if (Platform.OS !== 'web') {
    await SecureStore.deleteItemAsync(key).catch(() => undefined);
  }
}

export function getGuestToken() {
  return guestSecureGet(GUEST_TOKEN_KEY);
}

export function getSavedQuickMathSessionId() {
  return AsyncStorage.getItem(GUEST_GAME_SESSION_KEY);
}

export function saveQuickMathSessionId(sessionId: string) {
  return AsyncStorage.setItem(GUEST_GAME_SESSION_KEY, sessionId);
}

export function clearQuickMathSessionId() {
  return AsyncStorage.removeItem(GUEST_GAME_SESSION_KEY);
}

export async function clearGuestSession() {
  await Promise.all([
    guestSecureDelete(GUEST_TOKEN_KEY),
    AsyncStorage.removeItem(GUEST_GAME_SESSION_KEY)
  ]);
}

function newIdempotencyKey(scope: string) {
  const randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto);
  const unique = randomUUID
    ? randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `mobile:${scope}:${unique}`;
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

async function guestRequest<T>(path: string, init: RequestInit = {}, token?: string | null) {
  const guestToken = token === undefined ? await getGuestToken() : token;
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  headers.set('Accept-Language', getRuntimeLocale());
  if (guestToken) headers.set('Authorization', `Bearer ${guestToken}`);

  return parseResponse<T>(await fetch(`${API_URL}${path}`, { ...init, headers }));
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
    })
  });
  const created = await parseResponse<GuestCreationResponse>(response);
  await guestSecureSet(GUEST_TOKEN_KEY, created.token);
  return created.guest;
}

export function resumeGuestIdentity() {
  return guestRequest<GuestIdentity>('/guest/session');
}

export async function revokeGuestSession() {
  const token = await getGuestToken();
  if (!token) {
    await clearGuestSession();
    return { revoked: false, alreadyInactive: true } as const;
  }

  try {
    const result = await guestRequest<{ revoked: true }>(
      '/guest/session',
      { method: 'DELETE' },
      token
    );
    await clearGuestSession();
    return result;
  } catch (cause) {
    const status = (cause as { status?: number }).status;
    if (shouldClearGuestCredentialAfterRevocationFailure(status)) {
      await clearGuestSession();
      return { revoked: false, alreadyInactive: true } as const;
    }
    throw cause;
  }
}

export async function createQuickMathSession() {
  const session = await guestRequest<GuestQuickMathSession>('/guest/games/quick-math/sessions', {
    method: 'POST',
    body: JSON.stringify({ idempotencyKey: newIdempotencyKey('quick-math') })
  });
  await saveQuickMathSessionId(session.id);
  return session;
}

export function resumeQuickMathSession(sessionId: string) {
  return guestRequest<GuestQuickMathSession>(
    `/guest/games/sessions/${encodeURIComponent(sessionId)}`
  );
}

export async function submitQuickMathAction(
  session: GuestQuickMathSession,
  actionType: 'START' | 'ANSWER',
  payload: Record<string, unknown>
) {
  try {
    return await guestRequest<GuestQuickMathSession>(
      `/guest/games/sessions/${encodeURIComponent(session.id)}/actions`,
      {
        method: 'POST',
        body: JSON.stringify({
          actionType,
          payload,
          expectedSequence: session.sequence,
          idempotencyKey: newIdempotencyKey(`quick-math:${actionType.toLowerCase()}`)
        })
      }
    );
  } catch (cause) {
    try {
      const recovered = await resumeQuickMathSession(session.id);
      if (recovered.sequence > session.sequence) return recovered;
    } catch {
      // Recovery is best effort; never fabricate client-side state.
    }
    throw cause;
  }
}
