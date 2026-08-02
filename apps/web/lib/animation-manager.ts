import {
  AnimationPreferenceMode,
  DeviceClass,
  resolveAnimationPlan
} from '@knowme/animation-contract';
import { apiFetch } from './api';

export type AnimationManagerPreference = {
  mode: AnimationPreferenceMode;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
};

export function createWebAnimationPlan(input: {
  eventKey: string;
  preference: AnimationManagerPreference;
  deviceClass?: DeviceClass;
}) {
  const clientReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  return resolveAnimationPlan({
    eventKey: input.eventKey,
    preferenceMode: input.preference.mode,
    clientReducedMotion,
    deviceClass: input.deviceClass ?? 'UNKNOWN',
    soundEnabled: input.preference.soundEnabled,
    hapticsEnabled: input.preference.hapticsEnabled
  });
}

export async function reportWebAnimation(input: {
  eventKey: string;
  outcome: 'PLAYED' | 'FALLBACK' | 'SKIPPED' | 'ERROR';
  durationMs: number;
  assetBytes: number;
  deviceClass?: DeviceClass;
  errorCode?: string;
}) {
  const clientEventId = `web:${Date.now()}:${Math.random().toString(36).slice(2, 12)}`;
  const clientReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  return apiFetch('/concept-k/telemetry', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      clientEventId,
      clientReducedMotion,
      deviceClass: input.deviceClass ?? 'UNKNOWN',
      platform: 'WEB'
    })
  });
}
