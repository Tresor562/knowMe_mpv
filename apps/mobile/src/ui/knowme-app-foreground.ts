import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

// A single native AppState subscription for all icon components, including
// large notification lists. No animation remains active in the background.
let foregroundSnapshot = AppState.currentState === 'active';
const listeners = new Set<() => void>();
let eventSubscription: { remove(): void } | null = null;
function publishForeground(status: string) {
  const next = status === 'active';
  if (next === foregroundSnapshot) return;
  foregroundSnapshot = next;
  listeners.forEach(listener => listener());
}
function subscribeForeground(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    publishForeground(AppState.currentState);
    eventSubscription = AppState.addEventListener('change', publishForeground);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      eventSubscription?.remove();
      eventSubscription = null;
    }
  };
}
function getForegroundSnapshot() { return foregroundSnapshot; }
function getServerForegroundSnapshot() { return true; }

export function useKnowMeAppForeground() {
  return useSyncExternalStore(
    subscribeForeground, getForegroundSnapshot, getServerForegroundSnapshot
  );
}
