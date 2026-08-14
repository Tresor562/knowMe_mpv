import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type CameraType
} from 'expo-camera';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppearance } from './AppearanceProvider';
import {
  isMobilePreparationReady,
  permissionLabel,
  type CallMedia
} from './call-preparation';

type PreparationState =
  'idle' | 'requesting' | 'starting-camera' | 'ready' | 'denied' | 'error';

function PermissionCard({ label, value }: { label: string; value: string }) {
  const { colors } = useAppearance();
  return (
    <View
      style={[
        styles.permissionCard,
        { backgroundColor: colors.surfaceRaised, borderColor: colors.border }
      ]}
    >
      <Text style={[styles.permissionLabel, { color: colors.muted }]}>
        {label}
      </Text>
      <Text style={[styles.permissionValue, { color: colors.text }]}>
        {value}
      </Text>
    </View>
  );
}

function preparationLabel(state: PreparationState) {
  switch (state) {
    case 'requesting':
      return 'Demande en cours';
    case 'starting-camera':
      return 'Ouverture de la caméra';
    case 'ready':
      return 'Prêt';
    case 'denied':
      return 'Permission refusée';
    case 'error':
      return 'Préparation échouée';
    default:
      return 'Test non lancé';
  }
}

export function CallDevicePreparation() {
  const { colors } = useAppearance();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] =
    useMicrophonePermissions();
  const [media, setMedia] = useState<CallMedia>('video');
  const [cameraFacing, setCameraFacing] = useState<CameraType>('front');
  const [previewActive, setPreviewActive] = useState(false);
  const [cameraPreviewReady, setCameraPreviewReady] = useState(false);
  const [state, setState] = useState<PreparationState>('idle');
  const [message, setMessage] = useState(
    'Aucun accès au microphone ou à la caméra ne sera demandé avant ton action.'
  );

  function resetPreparation(nextMessage: string) {
    setPreviewActive(false);
    setCameraPreviewReady(false);
    setState('idle');
    setMessage(nextMessage);
  }

  function changeMedia(next: CallMedia) {
    setMedia(next);
    resetPreparation('Le mode a changé. Relance le test quand tu es prêt.');
  }

  async function prepareDevices() {
    if (state === 'requesting' || state === 'starting-camera') return;
    setPreviewActive(false);
    setCameraPreviewReady(false);
    setState('requesting');
    setMessage('Vérification des autorisations locales…');

    try {
      const microphone = microphonePermission?.granted
        ? microphonePermission
        : await requestMicrophonePermission();
      if (!microphone.granted) {
        setState('denied');
        setMessage(
          microphone.canAskAgain
            ? 'Le microphone est nécessaire. Tu peux relancer le test pour répondre à la demande.'
            : 'Autorise le microphone dans les réglages du téléphone, puis relance le test.'
        );
        return;
      }

      if (media === 'audio') {
        setState('ready');
        setMessage(
          'Microphone autorisé. Le téléphone gère localement le micro et la sortie audio utilisés.'
        );
        return;
      }

      const camera = cameraPermission?.granted
        ? cameraPermission
        : await requestCameraPermission();
      if (!camera.granted) {
        setState('denied');
        setMessage(
          camera.canAskAgain
            ? 'La caméra est nécessaire pour le test vidéo. Tu peux relancer le test.'
            : 'Autorise la caméra dans les réglages du téléphone, puis relance le test.'
        );
        return;
      }

      setState('starting-camera');
      setMessage('Ouverture de l’aperçu local…');
      setPreviewActive(true);
    } catch {
      setState('error');
      setMessage(
        'La préparation locale a échoué. Vérifie que les appareils ne sont pas utilisés ailleurs.'
      );
    }
  }

  function handleCameraReady() {
    setCameraPreviewReady(true);
    setState('ready');
    setMessage(
      'Microphone autorisé et aperçu caméra prêt. Aucune image ni aucun identifiant matériel n’est envoyé.'
    );
  }

  function handleCameraMountError() {
    setPreviewActive(false);
    setCameraPreviewReady(false);
    setState('error');
    setMessage(
      'La caméra est autorisée mais indisponible. Ferme les autres applications qui l’utilisent, puis réessaie.'
    );
  }

  const ready = isMobilePreparationReady(
    media,
    microphonePermission,
    cameraPermission,
    cameraPreviewReady
  );
  const busy = state === 'requesting' || state === 'starting-camera';

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border }
      ]}
    >
      <Text style={[styles.cardTitle, { color: colors.text }]}>
        Préparer ce téléphone
      </Text>
      <Text style={[styles.cardText, { color: colors.muted }]}>
        Les permissions, l’aperçu et le choix avant/arrière restent locaux. Sur
        mobile, le système choisit le micro et la sortie audio actifs.
      </Text>
      <View style={styles.permissionGrid}>
        <PermissionCard
          label="Microphone"
          value={permissionLabel(microphonePermission)}
        />
        <PermissionCard
          label="Caméra"
          value={permissionLabel(cameraPermission)}
        />
        <PermissionCard label="Préparation" value={preparationLabel(state)} />
      </View>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>
        Mode à préparer
      </Text>
      <View style={styles.segmented}>
        {(['audio', 'video'] as const).map((value) => {
          const selected = media === value;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              disabled={busy}
              key={value}
              onPress={() => changeMedia(value)}
              style={[
                styles.segment,
                {
                  backgroundColor: selected
                    ? colors.accent
                    : colors.surfaceRaised,
                  borderColor: selected ? colors.accent : colors.border
                }
              ]}
            >
              <Text
                style={{
                  color: selected ? colors.accentText : colors.text,
                  fontWeight: '800'
                }}
              >
                {value === 'audio' ? 'Audio' : 'Audio et vidéo'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {previewActive && cameraPermission?.granted ? (
        <View style={[styles.cameraFrame, { borderColor: colors.border }]}>
          <CameraView
            facing={cameraFacing}
            mirror={cameraFacing === 'front'}
            onCameraReady={handleCameraReady}
            onMountError={handleCameraMountError}
            style={styles.camera}
          />
        </View>
      ) : null}

      {media === 'video' ? (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => {
            setCameraFacing((current) =>
              current === 'front' ? 'back' : 'front'
            );
            if (previewActive) {
              setCameraPreviewReady(false);
              setState('starting-camera');
              setMessage('Changement de caméra locale…');
            }
          }}
          style={[styles.secondaryButton, { borderColor: colors.accent }]}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.accent }]}>
            Utiliser la caméra {cameraFacing === 'front' ? 'arrière' : 'avant'}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void prepareDevices()}
          style={({ pressed }) => [
            styles.primaryButton,
            styles.actionButton,
            { backgroundColor: colors.accent },
            (pressed || busy) && styles.disabled
          ]}
        >
          <Text
            style={[styles.primaryButtonText, { color: colors.accentText }]}
          >
            {busy ? 'Vérification…' : 'Tester mes appareils'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={!previewActive}
          onPress={() => resetPreparation('Aperçu local arrêté.')}
          style={[
            styles.secondaryButton,
            styles.actionButton,
            { borderColor: colors.accent },
            !previewActive && styles.disabled
          ]}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.accent }]}>
            Arrêter l’aperçu
          </Text>
        </Pressable>
      </View>
      <Text
        accessibilityLiveRegion="polite"
        style={[styles.status, { color: ready ? colors.accent : colors.muted }]}
      >
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 24, padding: 18, gap: 13 },
  cardTitle: { fontSize: 20, fontWeight: '900' },
  cardText: { fontSize: 15, lineHeight: 22 },
  permissionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  permissionCard: {
    width: '48%',
    minHeight: 76,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 5
  },
  permissionLabel: { fontSize: 12, fontWeight: '700' },
  permissionValue: { fontWeight: '900' },
  fieldLabel: { fontWeight: '800' },
  segmented: { flexDirection: 'row', gap: 8 },
  segment: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10
  },
  cameraFrame: {
    aspectRatio: 3 / 4,
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden'
  },
  camera: { flex: 1 },
  primaryButton: {
    borderRadius: 16,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryButtonText: { fontWeight: '900' },
  secondaryButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryButtonText: { fontWeight: '900' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  actionButton: { flexGrow: 1, flexBasis: 150 },
  status: { lineHeight: 21 },
  disabled: { opacity: 0.45 }
});
