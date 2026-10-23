import { KnowMeAlert as Alert } from '../ui/KnowMeFeedback';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { useI18n } from '../I18nProvider';
import {
  installedUpdateNoticeStorageKey,
  shouldAutoAcknowledgeInstalledUpdate,
  shouldDisplayBackgroundUpdateStatus
} from './installed-receipt-model';

type BackgroundUpdateStatus = {
  status: 'none' | 'downloading' | 'ready' | 'failed' | 'installed';
  versionCode: number;
  bytesDownloaded?: number;
  totalBytes?: number;
  failureReason?: number;
  installationRequested?: boolean;
};

type ApkInstaller = {
  startUpdateWatcher?: () => Promise<boolean>;
  getInstalledVersionCode(): Promise<number>;
  queueBackgroundUpdate?: (url: string, sha256: string, versionCode: number) => Promise<boolean>;
  getBackgroundUpdateStatus?: () => Promise<BackgroundUpdateStatus>;
  acknowledgeInstalledUpdate?: () => Promise<boolean>;
  installBackgroundUpdate?: () => Promise<boolean>;
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

export function MobileUpdateNotice() {
  const { colors } = useAppearance();
  const { locale } = useI18n();
  const en = locale === 'en';
  const [backgroundStatus, setBackgroundStatus] = useState<BackgroundUpdateStatus | null>(null);
  const [release, setRelease] = useState<AndroidReleaseNotice | null>(null);
  const [installing, setInstalling] = useState(false);
  const [readyVersion, setReadyVersion] = useState(0);
  const [progress, setProgress] = useState(0);
  const downloaded = useRef<{ uri: string; versionCode: number } | null>(null);
  const dismissedVersion = useRef(0);
  const dismissedReadyVersion = useRef(0);
  const autoAcknowledgedInstalledVersion = useRef(0);
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

    // Android has already verified the newly installed version. Never show
    // a blocking success modal: acknowledge and clean up in the background.
    // Guard duplicate foreground/poll events while remaining independent of
    // storage or native cleanup failures.
    const hideAndAcknowledgeInstalled = (status: BackgroundUpdateStatus) => {
      if (status.status !== 'installed') return false;
      if (shouldAutoAcknowledgeInstalledUpdate(
        status.versionCode, autoAcknowledgedInstalledVersion.current
      )) {
        autoAcknowledgedInstalledVersion.current = status.versionCode;
        void AsyncStorage.setItem(installedUpdateNoticeStorageKey(status.versionCode), '1')
          .catch(() => undefined);
        if (installer.acknowledgeInstalledUpdate) {
          void installer.acknowledgeInstalledUpdate().catch(() => undefined);
        }
      }
      return true;
    };

    const refreshBackground = async () => {
      try {
        const status = await installer.getBackgroundUpdateStatus?.();
        if (!active || !status) return;
        const hidden = hideAndAcknowledgeInstalled(status);
        if (!active) return;
        setBackgroundStatus(status.status === 'none' || hidden ? null : status);
        if (status.status === 'ready' &&
            status.versionCode !== dismissedReadyVersion.current) {
          setReadyVersion(status.versionCode);
          setRelease(null);
        } else if (status.status === 'installed' || status.status === 'failed') {
          setReadyVersion(0);
          setRelease(null);
        }
      } catch {
        // The native transfer continues independently if the UI cannot poll.
      }
    };

    const check = async (manual = false, immediate = false): Promise<MobileUpdateCheckResult> => {
      if (requestInProgress.current) return 'unavailable';
      if (!manual && !immediate && Date.now() - lastCheckAt.current < 60_000) {
        return 'current';
      }
      if (manual) { dismissedVersion.current = 0; dismissedReadyVersion.current = 0; }
      lastCheckAt.current = Date.now();
      requestInProgress.current = true;
      try {
        // The public self-hosted API is available before authentication.
        // An already downloaded update must remain installable even if the
        // update API is temporarily offline after the Android transfer.
        const [installedVersion, background] = await Promise.all([
          installer.getInstalledVersionCode(),
          installer.getBackgroundUpdateStatus?.().catch(() => null) ?? Promise.resolve(null)
        ]);
        if (!active) return 'unavailable';
        const hidden = background ? hideAndAcknowledgeInstalled(background) : false;
        if (!active) return 'unavailable';
        if (background && background.status !== 'none') {
          setBackgroundStatus(hidden ? null : background);
        }
        if (background?.status === 'installed') {
          setReadyVersion(0);
          setRelease(null);
          return 'current';
        }
        if (background?.versionCode && background.versionCode > installedVersion) {
          if (background.status === 'failed') {
            setReadyVersion(0);
            setRelease(null);
            return 'unavailable';
          }
          if (background.status === 'ready') {
            setReadyVersion(background.versionCode === dismissedReadyVersion.current
              ? 0 : background.versionCode);
            setRelease(null);
            return 'available';
          }
          if (background.status === 'downloading') {
            setReadyVersion(0);
            setRelease(null);
            return 'available';
          }
        }
        setReadyVersion(0);
        const feed = await apiFetch<AndroidReleaseFeed>('/mobile-updates/android');
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
    void refreshBackground();
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
        void check(false, true);
        void refreshBackground();
      }
    });
    // While the app is open, check occasionally even without a session
    // (guests have no authenticated Socket.IO connection).
    const interval = setInterval(() => { connectSignals(); void check(); }, 2 * 60_000);
    // Android DownloadManager owns the transfer even if the modal is dismissed.
    // Poll its persisted byte counts while visible; do not invent percentages.
    const progressPoll = setInterval(() => {
      if (AppState.currentState === 'active') void refreshBackground();
    }, 2_000);
    return () => {
      active = false;
      checkFromSettings = null;
      subscribedSocket?.off('update:available', onUpdateAvailable);
      foreground.remove();
      clearInterval(interval);
      clearInterval(progressPoll);
    };
  }, []);

  // An installed APK is already verified by Android. Never put any modal
  // (including a stale "APK ready" dialog) over the newly opened application.
  if (Platform.OS !== 'android' || !installer ||
      backgroundStatus?.status === 'installed' ||
      (!release && !readyVersion && !backgroundStatus)) return null;

  const dismiss = () => {
    if (readyVersion) {
      dismissedReadyVersion.current = readyVersion;
      setReadyVersion(0);
      return;
    }
    if (!release || (release.required && !installing)) return;
    // Closing the dialog must not cancel an already approved transfer.
    dismissedVersion.current = release.versionCode;
    setRelease(null);
  };

  const installReady = async () => {
    if (installing || !installer.installBackgroundUpdate) return;
    setInstalling(true);
    try {
      const launched = await installer.installBackgroundUpdate();
      if (!launched) throw new Error('INSTALL_NOT_STARTED');
      setBackgroundStatus((current) => current
        ? { ...current, installationRequested: true } : current);
    } catch (failure) {
      const code = failure instanceof Error
        ? (failure as Error & { code?: string }).code : undefined;
      Alert.alert('Mise à jour KnowMe', code === 'INSTALL_PERMISSION_REQUIRED'
        ? 'Autorise les installations KnowMe dans les paramètres Android, puis réessaie.'
        : code === 'DIGEST_MISMATCH' || code === 'INCOMPATIBLE_APK'
          ? 'APK refusée : contrôle de sécurité ou version non conforme.'
          : 'Impossible de préparer l’installation. Réessaie depuis KnowMe.');
    } finally {
      setInstalling(false);
    }
  };

  const install = async () => {
    if (installing) return;
    const current = release;
    if (!current) return;
    setInstalling(true);
    try {
      if (installer.queueBackgroundUpdate) {
        const queued = await installer.queueBackgroundUpdate(
          current.url, current.sha256, current.versionCode);
        if (!queued) throw new Error('DOWNLOAD_START_FAILED');
        setBackgroundStatus({ status: 'downloading', versionCode: current.versionCode });
        dismissedVersion.current = current.versionCode;
        setRelease(null);
        return;
      }
      // Older APK: the JS download continues after modal close while RN runs,
      // but Android can suspend it if the app process is stopped.
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

  const retryBackground = async () => {
    if (installing || !installer.queueBackgroundUpdate) return;
    setInstalling(true);
    try {
      const [feed, installedVersion] = await Promise.all([
        apiFetch<AndroidReleaseFeed>('/mobile-updates/android'),
        installer.getInstalledVersionCode()
      ]);
      const next = feed.release;
      if (!trustedKnowMeApk(next) || !next || next.versionCode <= installedVersion) {
        throw new Error('NO_TRUSTED_UPDATE');
      }
      const queued = await installer.queueBackgroundUpdate(
        next.url, next.sha256, next.versionCode);
      if (!queued) throw new Error('DOWNLOAD_START_FAILED');
      setBackgroundStatus({ status: 'downloading', versionCode: next.versionCode });
      setRelease(null);
    } catch {
      Alert.alert(en ? 'KnowMe update' : 'Mise à jour KnowMe',
        en ? 'Download could not restart. Check your connection and try again.'
          : 'Le téléchargement n’a pas pu reprendre. Vérifie ta connexion et réessaie.');
    } finally {
      setInstalling(false);
    }
  };

  if (backgroundStatus &&
      shouldDisplayBackgroundUpdateStatus(backgroundStatus.status, readyVersion)) {
    const status = backgroundStatus;
    const downloading = status.status === 'downloading';
    const ready = status.status === 'ready';
    const failed = status.status === 'failed';
    const total = status.totalBytes ?? -1;
    const transferred = Math.max(0, status.bytesDownloaded ?? 0);
    const knownProgress = downloading && Number.isFinite(total) && total > 0;
    const percent = knownProgress
      ? Math.min(99, Math.floor(transferred / total * 100)) : null;
    const title = ready
      ? (status.installationRequested
        ? (en ? 'Finish installation in Android' : 'Confirme l’installation dans Android')
        : (en ? 'Download complete' : 'Téléchargement terminé'))
      : failed
        ? (en ? 'Update download failed' : 'Échec du téléchargement')
        : (en ? 'Downloading KnowMe update' : 'Téléchargement de KnowMe');
    const subtitle = ready
      ? (en ? 'Your APK is ready. Android must authorize its installation.'
        : 'L’APK est prête. Android doit autoriser son installation.')
      : failed
        ? (en ? 'Your current version remains usable. Retry when ready.'
          : 'Ta version actuelle reste utilisable. Tu peux réessayer.')
        : percent !== null
          ? `${percent} % · ${(transferred / (1024 * 1024)).toFixed(1)} / ${(total / (1024 * 1024)).toFixed(1)} Mo`
          : (en ? 'Download running in the background (size unavailable).'
            : 'Téléchargement en arrière-plan (taille inconnue).');
    return (
      <View pointerEvents="box-none" style={styles.statusOverlay}>
        <View accessibilityLiveRegion="polite"
          style={[styles.statusTray, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statusTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.statusSubtitle, { color: colors.muted }]}>{subtitle}</Text>
          {knownProgress && (
            <View accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: percent ?? 0 }}
              style={[styles.progressTrack, { backgroundColor: colors.backgroundAccent }]}>
              <View style={[styles.progressFill, {
                backgroundColor: colors.accent, width: `${percent ?? 0}%` as `${number}%`
              }]} />
            </View>
          )}
          {(ready || failed) && (
            <Pressable accessibilityRole="button" disabled={installing}
              onPress={ready ? () => void installReady() : () => void retryBackground()}
              style={[styles.statusAction, { backgroundColor: colors.accent }]}>
              <Text style={[styles.statusActionText, { color: colors.accentText }]}>
                {installing ? (en ? 'Please wait…' : 'Patiente…')
                  : ready ? (en ? 'Install / resume' : 'Installer / reprendre')
                    : (en ? 'Retry download' : 'Réessayer')}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  if (readyVersion) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={dismiss}
        statusBarTranslucent>
        <View style={styles.scrim}>
          <View style={[styles.sheet, { backgroundColor: colors.surface,
            borderColor: colors.border }]}>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>
              KNOWME · MISE À JOUR
            </Text>
            <Text style={[styles.title, { color: colors.text }]}>
              Mise à jour téléchargée
            </Text>
            <Text style={[styles.details, { color: colors.muted }]}>
              L’APK est prête. Appuie sur Installer pour vérifier son intégrité,
              puis confirme l’installation dans Android.
            </Text>
            <Pressable accessibilityRole="button" disabled={installing}
              onPress={() => void installReady()}
              style={[styles.primary, { backgroundColor: colors.accent }]}>
              <Text style={[styles.primaryText, { color: colors.accentText }]}>
                {installing ? 'Préparation…' : 'Installer'}
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={dismiss}
              style={styles.secondary}>
              <Text style={[styles.secondaryText, { color: colors.text }]}>
                Plus tard
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  if (!release) return null;

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
            Après confirmation, le téléchargement continue en arrière-plan.
            Tu peux fermer cette fenêtre et utiliser KnowMe normalement.
            Android t'avertira lorsque l’APK pourra être vérifiée et installée.
            L'installation exigera ton autorisation.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={installing}
            onPress={() => void install()}
            style={[styles.primary, { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.primaryText, { color: colors.accentText }]}>
              {installing ? (installer.queueBackgroundUpdate ? 'Lancement…' : `Téléchargement… ${Math.round(progress * 100)} %`) : 'Mettre à jour'}
            </Text>
          </Pressable>
          {(!release.required || installing) ? (
            <Pressable
              accessibilityRole="button"
              onPress={dismiss}
              style={styles.secondary}
            >
              <Text style={[styles.secondaryText, { color: colors.text }]}>
                {installing ? 'Fermer' : 'Plus tard'}
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
  secondaryText: { fontSize: 13, fontWeight: '700' },
  statusOverlay: { position: 'absolute', top: 54, left: 14, right: 14 },
  statusTray: {
    padding: 14, gap: 8, borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth, elevation: 7
  },
  statusTitle: { fontSize: 15, fontWeight: '800' },
  statusSubtitle: { fontSize: 12, lineHeight: 18 },
  progressTrack: { height: 5, borderRadius: 8, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 8 },
  statusAction: {
    alignSelf: 'flex-start', borderRadius: 14, paddingHorizontal: 16,
    minHeight: 42, justifyContent: 'center', marginTop: 3
  },
  statusActionText: { fontWeight: '800', fontSize: 13 }
});
