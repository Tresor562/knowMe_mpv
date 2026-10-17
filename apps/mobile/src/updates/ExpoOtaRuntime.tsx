import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import * as Updates from 'expo-updates';
import { KnowMeAlert as Alert } from '../ui/KnowMeFeedback';

// Expo OTA may change the JS bundle and assets but never native modules,
// Android permissions, Play signing keys or the compatible runtimeVersion.
// The embedded APK is always the offline fallback.
let lastCheckAt = 0;
let inFlight: Promise<void> | null = null;
const CHECK_INTERVAL_MS = 30 * 60_000;

export async function checkKnowMeOtaNow(force = false) {
  if (__DEV__ || Platform.OS !== 'android' || !Updates.isEnabled) return;
  const now = Date.now();
  if (inFlight) return inFlight;
  if (!force && now - lastCheckAt < CHECK_INTERVAL_MS) return;
  lastCheckAt = now;
  inFlight = (async () => {
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) return;
      const downloaded = await Updates.fetchUpdateAsync();
      if (!downloaded.isNew) return;
      Alert.alert(
        'KnowMe est à jour',
        'Les nouvelles fonctionnalités ont été téléchargées. Redémarre KnowMe pour les utiliser.',
        [
          { text: 'Plus tard', style:'cancel' },
          { text: 'Redémarrer', onPress: () => { void Updates.reloadAsync().catch(() => undefined); } }
        ]
      );
    } catch {
      // Never interrupt login, active chats, or offline work because of OTA.
      // On the next startup the embedded or last verified JS remains usable.
    }
  })().finally(() => { inFlight = null; });
  return inFlight;
}

export function ExpoOtaRuntime() {
  useEffect(() => {
    void checkKnowMeOtaNow();
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') void checkKnowMeOtaNow();
    });
    return () => listener.remove();
  }, []);
  return null;
}
