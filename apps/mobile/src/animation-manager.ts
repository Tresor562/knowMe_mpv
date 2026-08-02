import {
  AnimationPreferenceMode,
  DeviceClass,
  resolveAnimationPlan
} from '@knowme/animation-contract';
import { AccessibilityInfo, Platform } from 'react-native';
import { apiFetch } from './api';

export type MobileAnimationPreference = {
  mode: AnimationPreferenceMode;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
};

export async function createMobileAnimationPlan(input: {
  eventKey: string;
  preference: MobileAnimationPreference;
  deviceClass?: DeviceClass;
}) {
  const clientReducedMotion = await AccessibilityInfo.isReduceMotionEnabled();
  return resolveAnimationPlan({
    eventKey: input.eventKey,
    preferenceMode: input.preference.mode,
    clientReducedMotion,
    deviceClass: input.deviceClass ?? 'UNKNOWN',
    soundEnabled: input.preference.soundEnabled,
    hapticsEnabled: input.preference.hapticsEnabled
  });
}

export async function reportMobileAnimation(input: {
  eventKey: string;
  outcome: 'PLAYED' | 'FALLBACK' | 'SKIPPED' | 'ERROR';
  durationMs: number;
  assetBytes: number;
  deviceClass?: DeviceClass;
  errorCode?: string;
}) {
  const clientReducedMotion = await AccessibilityInfo.isReduceMotionEnabled();
  const clientEventId = `mobile:${Date.now()}:${Math.random().toString(36).slice(2, 12)}`;
  return apiFetch('/concept-k/telemetry', {
    method: 'POST',
    body: JSON.stringify({
      ...input,
      clientEventId,
      clientReducedMotion,
      deviceClass: input.deviceClass ?? 'UNKNOWN',
      platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID'
    })
  });
}
