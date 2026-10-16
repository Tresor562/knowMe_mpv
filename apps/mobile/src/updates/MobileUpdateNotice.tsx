import { KnowMeAlert as Alert } from '../ui/KnowMeFeedback';
import * as FileSystem from 'expo-file-system';
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
  startUpdateWatcher?: () => Promise<boolean>;
  getInstalledVersionCode(): Promise<number>;
  installApk(uri: string, sha256: string, versionCode: number): Promise<boolean>;
};

const installer = NativeModules.KnowMeApkInstaller as ApkInstaller | undefined;
// Present only when the APK was built with a real Firebase Android config.
const firebasePush = NativeModules.KnowMeFirebasePush as
  | { subscribeToUpdates(): Promise<boolean> }
  | undefined;

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

const FIRST_PARTY_PREVIEW_FEED = 'https://knowme-nextech.vercel.app/api/updates/android';

function verifiedPreviewRelease(release: AndroidReleaseNotice | null): AndroidReleaseNotice | null {
  if (!release || !Number.isSafeInteger(release.versionCode) || release.versionCode < 1 ||
    !/^\d+\.\d+\.\d+$/.test(release.version) || !/^[a-f0-9]{64}$/i.test(release.sha256)) {
    return null;
  }
  const expected = `https://github.com/Tresor562/knowMe_mpv/releases/download/v${release.version}-preview/KnowMe-${release.version}-preview.apk`;
  return release.url === expected ? release : null;
}

function latestTrustedRelease(
  primary: AndroidReleaseNotice | null,
  firstPartyPreview: AndroidReleaseNotice | null
): AndroidReleaseNotice | null {
  const preview = verifiedPreviewRelease(firstPartyPreview);
  if (!primary) return preview;
  // The production signing channel must not be replaced by a debug-signed preview.
  if (!verifiedPreviewRelease(primary)) return primary;
  return preview && preview.versionCode > primary.versionCode ? preview : primary;
}

async function firstPartyRelease(): Promise<AndroidReleaseNotice | null> {
  // Expo/Hermes does not guarantee AbortSignal.timeout; use the native-safe
  // AbortController pattern to bound this optional fallback request.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(FIRST_PARTY_PREVIEW_FEED, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('PREVIEW_FEED_UNAVAILABLE');
    const data = await response.json() as AndroidReleaseFeed;
    return verifiedPreviewRelease(data.release);
  } finally {
    clearTimeout(timer);
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
  const downloaded = useRef<{ uri: string; versionCode: number } | null>(null);
  const dismissedVersion = useRef(0);
  const lastCheckAt = useRef(0);
  const requestInProgress = useRef(false);

  useEffect(() => {
    // The native module is part of the next APK, never present retroactively.
    if (Platform.OS !== 'android' || __DEV__ || !installer) return;
    let active = true;
    // Register an Android WorkManager check even when KnowMe is closed.
    // Android notifications only reopen the app; installation remains opt-in
    // and is always verified by the native installer.
    void installer.startUpdateWatcher?.().catch(() => undefined);
    // Subscribe once per app launch. Firebase persists and renews the topic
    // membership; failure never blocks the existing WorkManager fallback.
    void firebasePush?.subscribeToUpdates().catch(() => undefined);

    const check = async (manual = false): Promise<MobileUpdateCheckResult> => {
      if (requestInProgress.current) return 'unavailable';
      if (!manual && Date.now() - lastCheckAt.current < 60_000) {
        return 'current';
      }
      if (manual) dismissedVersion.current = 0;
      lastCheckAt.current = Date.now();
      requestInProgress.current = true;
      try {
        // Both endpoints are public. The trusted Web feed continues working
        // when the VPS API still advertises an older preview release.
        const [apiResult, previewResult, installedVersion] = await Promise.all([
          apiFetch<AndroidReleaseFeed>('/mobile-updates/android')
            .then(feed => feed.release)
            .catch(() => null),
          firstPartyRelease().catch(() => null),
          installer.getInstalledVersionCode()
        ]);
        const next = latestTrustedRelease(apiResult, previewResult);
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
      let uri = downloaded.current?.versionCode === current.versionCode
        ? downloaded.current.uri : null;
      if (uri) {
        const local = await FileSystem.getInfoAsync(uri);
        if (!local.exists) uri = null;
      }
      if (!uri) {
        if (!FileSystem.cacheDirectory) throw new Error('CACHE_UNAVAILABLE');
        const destination = FileSystem.cacheDirectory +
          `knowme-update-${current.versionCode}.apk`;
        await FileSystem.deleteAsync(destination, { idempotent: true });
        setProgress(0);
        const task = FileSystem.createDownloadResumable(
          current.url,
          destination,
          {},
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
        uri = result.uri;
        downloaded.current = { uri, versionCode: current.versionCode };
      }
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
            La mise à jour se télécharge dans KnowMe, sans fichier dans tes
            téléchargements. Android demandera ton accord pour l’installation.
            Si la signature ne correspond pas, l’installation est refusée et
            tes données existantes restent en place.
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
