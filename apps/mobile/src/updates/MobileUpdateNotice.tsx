import { KnowMeAlert as Alert } from '../ui/KnowMeFeedback';
import * as FileSystem from 'expo-file-system';
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef, useState } from 'react';
import {
  AppState,
  Modal,
  NativeModules,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { apiFetch } from '../api';
import { useAppearance } from '../AppearanceProvider';

type ApkInstaller = {
  getInstalledVersionCode(): Promise<number>;
  installApk(uri: string, sha256: string, versionCode: number): Promise<boolean>;
};

const installer = NativeModules.KnowMeApkInstaller as ApkInstaller | undefined;

type AndroidReleaseNotice = {
  versionCode: number;
  version: string;
  url: string;
  sha256: string;
  notes: string;
  required: boolean;
};
type AndroidReleaseFeed = { release: AndroidReleaseNotice | null };

export type MobileUpdateCheckResult =
  | 'available'
  | 'current'
  | 'unavailable'
  | 'unsupported';

// The update modal is mounted once at the app root. Settings requests a fresh
// check through this shared controller; it does not duplicate installers.
let checkFromSettings: (() => Promise<MobileUpdateCheckResult>) | null = null;
export async function checkKnowMeUpdateNow(): Promise<MobileUpdateCheckResult> {
  if (Platform.OS !== 'android' || !installer || !checkFromSettings) return 'unsupported';
  return checkFromSettings();
}


function trustedDownloadUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function formatDownloadProgress(value: number) {
  return `Téléchargement… ${Math.round(value * 100)} %`;
}

export function MobileUpdateNotice() {
  const { colors } = useAppearance();
  const [release, setRelease] = useState<AndroidReleaseNotice | null>(null);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const downloaded = useRef<{
    uri: string;
    versionCode: number;
    sha256: string;
  } | null>(null);
  const inFlight = useRef<{
    versionCode: number;
    sha256: string;
    promise: Promise<string>;
  } | null>(null);
  const [readyVersion, setReadyVersion] = useState(0);
  const dismissedVersion = useRef(0);
  const lastCheckAt = useRef(0);
  const requestInProgress = useRef(false);

  // Android still requires system consent, but there is no Downloads-folder step.
  const stageDownload = async (next: AndroidReleaseNotice): Promise<string> => {
    const cached = downloaded.current;
    if (cached?.versionCode === next.versionCode && cached.sha256 === next.sha256) {
      const info = await FileSystem.getInfoAsync(cached.uri);
      if (info.exists) return cached.uri;
    }
    const pending = inFlight.current;
    if (pending?.versionCode === next.versionCode && pending.sha256 === next.sha256) {
      return pending.promise;
    }
    if (!FileSystem.cacheDirectory) throw new Error('CACHE_UNAVAILABLE');
    const destination = FileSystem.cacheDirectory +
      `knowme-update-${next.versionCode}-${next.sha256.slice(0, 12)}.apk`;
    const promise = (async () => {
      await FileSystem.deleteAsync(destination, { idempotent: true });
      const task = FileSystem.createDownloadResumable(
        next.url, destination, {},
        (event) => {
          if (event.totalBytesExpectedToWrite > 0) {
            setProgress(Math.min(1,
              event.totalBytesWritten / event.totalBytesExpectedToWrite));
          }
        }
      );
      const result = await task.downloadAsync();
      if (!result || result.status < 200 || result.status >= 300) {
        throw new Error('DOWNLOAD_FAILED');
      }
      downloaded.current = {
        uri: result.uri, versionCode: next.versionCode, sha256: next.sha256
      };
      setReadyVersion(next.versionCode);
      return result.uri;
    })();
    inFlight.current = {
      versionCode: next.versionCode, sha256: next.sha256, promise
    };
    try {
      return await promise;
    } catch (error) {
      // Discard partial payloads; native installation verifies SHA-256 and package.
      await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => {});
      throw error;
    } finally {
      if (inFlight.current?.promise === promise) inFlight.current = null;
    }
  };

  const prefetchOverWifi = async (next: AndroidReleaseNotice) => {
    try {
      const connection = await NetInfo.fetch();
      if (connection.isConnected !== true ||
          connection.isInternetReachable === false ||
          (connection.type !== 'wifi' && connection.type !== 'ethernet') ||
          connection.details?.isConnectionExpensive !== false) return;
      await stageDownload(next);
    } catch {
      // Prefetch is optional; button still downloads on demand.
    }
  };

  useEffect(() => {
    // The native module is part of the next APK, never present retroactively.
    if (Platform.OS !== 'android' || __DEV__ || !installer) return;
    let active = true;

    const check = async (manual = false): Promise<MobileUpdateCheckResult> => {
      if (requestInProgress.current) return 'unavailable';
      if (!manual && Date.now() - lastCheckAt.current < 60_000) {
        return 'current';
      }
      if (manual) dismissedVersion.current = 0;
      lastCheckAt.current = Date.now();
      requestInProgress.current = true;
      try {
        // Public endpoint: works before sign-in and for guest accounts.
        const [feed, installedVersion] = await Promise.all([
          apiFetch<AndroidReleaseFeed>('/mobile-updates/android'),
          installer.getInstalledVersionCode()
        ]);
        const next = feed.release;
        if (!active) return 'unavailable';
        if (
          next &&
          Number.isSafeInteger(next.versionCode) &&
          next.versionCode > installedVersion &&
          next.versionCode !== dismissedVersion.current &&
          /^[a-f0-9]{64}$/i.test(next.sha256) &&
          trustedDownloadUrl(next.url)
        ) {
          setRelease(next);
          // Prefetch on unmetered Wi-Fi/Ethernet; never install silently.
          void prefetchOverWifi(next);
          return 'available';
        } else {
          setRelease(null);
          return 'current';
        }
      } catch {
        // Outages never prevent using existing KnowMe functionality.
        return 'unavailable';
      } finally {
        requestInProgress.current = false;
      }
    };

    checkFromSettings = () => check(true);
    void check();
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    const interval = setInterval(() => void check(), 15 * 60_000);
    return () => {
      active = false;
      checkFromSettings = null;
      foreground.remove();
      clearInterval(interval);
    };
  }, []);

  if (Platform.OS !== 'android' || !installer || !release) return null;

  const dismiss = () => {
    if (release.required || installing) return;
    dismissedVersion.current = release.versionCode;
    setRelease(null);
  };

  const install = async () => {
    if (installing) return;
    const current = release;
    setInstalling(true);
    try {
      setProgress(0);
      const uri = await stageDownload(current);
      // Native code verifies the complete SHA-256, APK package and version
      // before launching Android's official installer with a content:// URI.
      await installer.installApk(uri, current.sha256, current.versionCode);
    } catch (failure) {
      const code = failure instanceof Error
        ? (failure as Error & { code?: string }).code : undefined;
      const message = code === 'INSTALL_PERMISSION_REQUIRED'
        ? 'Autorise l’installation depuis KnowMe dans les paramètres Android, puis reviens appuyer sur « Mettre à jour ».'
        : code === 'DIGEST_MISMATCH' || code === 'INCOMPATIBLE_APK'
          ? 'Cette mise à jour a échoué à la vérification de sécurité. Aucun fichier ne sera installé.'
          : 'Le téléchargement ou l’installation n’a pas abouti. Vérifie ta connexion et réessaie.';
      if (code === 'DIGEST_MISMATCH' || code === 'INCOMPATIBLE_APK') {
        downloaded.current = null;
      }
      Alert.alert('Mise à jour KnowMe', message);
    } finally {
      setInstalling(false);
    }
  };

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={dismiss}
      statusBarTranslucent
    >
      <View style={styles.scrim}>
        <View style={[styles.sheet, {
          backgroundColor: colors.surface, borderColor: colors.border
        }]}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>
            KNOWME · NOUVELLE VERSION
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>
            KnowMe {release.version} est disponible
          </Text>
          <Text style={[styles.details, { color: colors.muted }]}>
            {release.notes}
          </Text>
          <Text style={[styles.caption, { color: colors.muted }]}>
            {readyVersion === release.versionCode
              ? 'Mise à jour préparée dans KnowMe. Android demandera ton autorisation pour l’installation.'
              : 'KnowMe peut préparer cette mise à jour via Wi-Fi, sans fichier dans tes téléchargements. Android demandera ton autorisation pour l’installation.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={installing}
            onPress={() => void install()}
            style={[styles.primary, { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.primaryText, { color: colors.accentText }]}>
              {installing ? formatDownloadProgress(progress) : 'Mettre à jour'}
            </Text>
          </Pressable>
          {!release.required ? (
            <Pressable
              accessibilityRole="button"
              disabled={installing}
              onPress={dismiss}
              style={styles.secondary}
            >
              <Text style={[styles.secondaryText, { color: colors.text }]}>
                Plus tard
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(2, 10, 8, 0.78)'
  },
  sheet: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 28,
    paddingHorizontal: 23,
    paddingVertical: 24,
    gap: 12
  },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  title: { fontSize: 23, lineHeight: 28, fontWeight: '800' },
  details: { fontSize: 14, lineHeight: 21 },
  caption: { fontSize: 12, lineHeight: 18 },
  primary: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    marginTop: 4
  },
  primaryText: { fontWeight: '800', fontSize: 15 },
  secondary: { minHeight: 42, justifyContent: 'center', alignItems: 'center' },
  secondaryText: { fontSize: 13, fontWeight: '700' }
});
