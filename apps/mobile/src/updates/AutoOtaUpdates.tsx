import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import * as Updates from 'expo-updates';

// The native runtime selects only its own compatible update manifest.
// Download silently; NEVER reload over a draft, call, recording or upload.
// The verified update is loaded by expo-updates at the next cold start.
export function AutoOtaUpdates() {
  useEffect(() => {
    if (__DEV__ || Platform.OS !== 'android' || !Updates.isEnabled) return;

    let stopped = false;
    let lastAttemptAt = 0;
    let pending = false;

    const check = async () => {
      if (stopped || pending || Date.now() - lastAttemptAt < 15 * 60 * 1000) return;
      lastAttemptAt = Date.now();
      pending = true;
      try {
        const result = await Updates.checkForUpdateAsync();
        if (!stopped && result.isAvailable) {
          await Updates.fetchUpdateAsync();
          // Expo's crash recovery retains the embedded/fallback bundle.
        }
      } catch {
        // Offline mode, service outage or incompatible bundle must not block
        // reading chats or using the installed app.
      } finally {
        pending = false;
      }
    };

    const listener = AppState.addEventListener('change', (next) => {
      if (next === 'active') void check();
    });
    void check();

    return () => {
      stopped = true;
      listener.remove();
    };
  }, []);
  return null;
}
