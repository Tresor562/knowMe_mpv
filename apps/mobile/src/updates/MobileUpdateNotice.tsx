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
import { getRealtimeSocket } from '../realtime';
import { useAppearance } from '../AppearanceProvider';

type ApkInstaller = {
  startUpdateWatcher?: () => Promise<boolean>;
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


// The APK feed and binaries are hosted directly by KnowMe on its VPS.
// No Firebase, Vercel, GitHub Releases or external notification provider
// is needed for the installed APK's update checks. The server publishes the
// APK only after checking its signing certificate, package and SHA-256.
function trustedKnowMeApk(release: AndroidReleaseNotice | null): boolean {
  if (!release || !Number.isSafeInteger(release.versionCode) || release.versionCode < 1 ||
    !/^\d+\.\d+\.\d+$/.test(release.version) ||
    !/^[a-f0-9]{64}$/i.test(release.sha256)) return false;
  const expected = 'https://31-56-85-53.sslip.io/knowme-api/mobile-updates/android/apk/' +
    'KnowMe-' + release.version + '-preview.apk';
  return release.url === expected;
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


    const check = async (manual = false, immediate = false): Promise<MobileUpdateCheckResult> => {
      if (requestInProgress.current) return 'unavailable';
      if (!manual && !immediate && Date.now() - lastCheckAt.current < 60_000) {
        return 'current';
      }
      if (manual) dismissedVersion.current = 0;
      lastCheckAt.current = Date.now();
      requestInProgress.current = true;
      try {
        // The public self-hosted API is available before authentication.
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
          trustedKnowMeApk(next)
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
    // Live release signals travel through KnowMe's existing authenticated
    // Socket.IO connection. No Google/Firebase token or provider required.
    let subscribedSocket: Awaited<ReturnType<typeof getRealtimeSocket>> = null;
    const onUpdateAvailable = () => { void check(false, true); };
    const connectSignals = () => {
      void getRealtimeSocket().then((socket) => {
        if (!active || !socket || socket === subscribedSocket) return;
        subscribedSocket?.off('update:available', onUpdateAvailable);
        subscribedSocket = socket;
        socket.on('update:available', onUpdateAvailable);
      }).catch(() => undefined);
    };
    connectSignals();
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        connectSignals();
        void check();
      }
    });
    // While the app is open, check occasionally even without a session
    // (guests have no authenticated Socket.IO connection).
    const interval = setInterval(() => { connectSignals(); void check(); }, 2 * 60_000);
    return () => {
      active = false;
      checkFromSettings = null;
      subscribedSocket?.off('update:available', onUpdateAvailable);
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
