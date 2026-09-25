import { useEffect, useRef, useState } from 'react';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
  type AudioSource
} from 'expo-audio';
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type CameraType
} from 'expo-camera';
import { useVideoPlayer, VideoView, type VideoSource } from 'expo-video';
import {
  Alert,
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { API_URL, apiFetch, getAccessToken } from './api';

export type MediaPresentation = {
  kind: 'VOICE_NOTE' | 'VIDEO_NOTE';
  assetId: string;
  mimeType: string;
  durationSeconds: number;
  voicePreset: 'ORIGINAL' | 'DEEP' | 'BRIGHT' | 'ROBOT' | null;
  transformedVoice: boolean;
  mediaAccess: 'AUTHENTICATED_CONVERSATION';
};

export type MessengerMediaMessage = {
  id: string;
  conversationId: string;
  content: string;
  createdAt: string;
  senderId: string;
  presentation?: MediaPresentation | { kind: 'TEXT'; text: string };
};

type VoicePreset = 'ORIGINAL' | 'DEEP' | 'BRIGHT' | 'ROBOT';
type TransformableVoicePreset = Exclude<VoicePreset, 'ORIGINAL'>;

type MediaAsset = {
  id: string;
  status: string;
  detectedMime: string;
  size?: number;
};

type UploadSession = {
  id: string;
  uploadToken: string;
};

type VoiceDraft = {
  uri: string;
  durationSeconds: number;
  originalAssetId?: string;
  transformedAssetId?: string;
  preset: VoicePreset;
  previewSource: AudioSource;
};

type VideoDraft = {
  uri: string;
  durationSeconds: number;
};

const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
const VIDEO_NOTE_MAX_SECONDS = 60;

function voiceLabel(preset: VoicePreset | null) {
  if (preset === 'DEEP') return 'Grave';
  if (preset === 'BRIGHT') return 'Claire';
  if (preset === 'ROBOT') return 'Robot';
  return 'Originale';
}

async function authenticatedMediaSource(
  assetId: string
): Promise<{ uri: string; headers: Record<string, string> }> {
  const [grant, accessToken] = await Promise.all([
    apiFetch<{ path: string }>(`/media/${assetId}/download-grant`, {
      method: 'POST'
    }),
    getAccessToken()
  ]);
  if (!accessToken) throw new Error('Session expirée.');
  return {
    uri: `${API_URL}${grant.path}`,
    headers: { Authorization: `Bearer ${accessToken}` }
  };
}

function AudioClip({
  source,
  label
}: {
  source: AudioSource;
  label: string;
}) {
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);

  return (
    <View style={styles.audioClip}>
      <Pressable
        onPress={() => {
          if (status.playing) player.pause();
          else player.play();
        }}
        style={styles.mediaPlayButton}
      >
        <Text style={styles.mediaPlayText}>
          {status.playing ? 'Pause' : 'Lire'}
        </Text>
      </Pressable>
      <View style={styles.flex}>
        <Text style={styles.mediaTitle}>{label}</Text>
        <Text style={styles.mediaMeta}>
          {status.duration > 0
            ? `${Math.round(status.currentTime)} / ${Math.round(status.duration)} s`
            : 'Audio'}
        </Text>
      </View>
    </View>
  );
}

function VideoClip({
  source,
  round = true
}: {
  source: VideoSource;
  round?: boolean;
}) {
  const player = useVideoPlayer(source);
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="cover"
      style={[styles.videoClip, round && styles.roundVideo]}
    />
  );
}

export function MobileMessageMedia({
  presentation
}: {
  presentation: MediaPresentation;
}) {
  const [source, setSource] = useState<
    { uri: string; headers: Record<string, string> } | null
  >(null);
  const [failure, setFailure] = useState('');

  useEffect(() => {
    let mounted = true;
    setSource(null);
    setFailure('');
    void authenticatedMediaSource(presentation.assetId)
      .then((value) => {
        if (mounted) setSource(value);
      })
      .catch((cause) => {
        if (mounted) {
          setFailure(
            cause instanceof Error ? cause.message : 'Média indisponible.'
          );
        }
      });
    return () => {
      mounted = false;
    };
  }, [presentation.assetId]);

  if (failure) return <Text style={styles.mediaFailure}>{failure}</Text>;
  if (!source) return <Text style={styles.mediaMeta}>Chargement…</Text>;

  if (presentation.kind === 'VIDEO_NOTE') {
    return (
      <View style={styles.mediaStack}>
        <VideoClip source={source} />
        <Text style={styles.mediaMeta}>
          Note vidéo · {Math.max(1, Math.round(presentation.durationSeconds))} s
        </Text>
      </View>
    );
  }

  return (
    <AudioClip
      source={source}
      label={
        presentation.transformedVoice
          ? `Vocal · voix ${voiceLabel(presentation.voicePreset)}`
          : 'Vocal'
      }
    />
  );
}

async function uploadMediaUri(input: {
  conversationId: string;
  uri: string;
  mimeType: 'audio/mp4' | 'video/mp4';
  name: string;
}) {
  const session = await apiFetch<UploadSession>('/media/uploads', {
    method: 'POST',
    body: JSON.stringify({
      purpose: 'MESSAGE',
      visibility: 'CONVERSATION',
      conversationId: input.conversationId,
      maxBytes: MAX_MEDIA_BYTES,
      allowedMime: [input.mimeType]
    })
  });

  const form = new FormData();
  form.append(
    'file',
    {
      uri: input.uri,
      type: input.mimeType,
      name: input.name
    } as unknown as Blob
  );

  return apiFetch<MediaAsset>(`/media/uploads/${session.id}/complete`, {
    method: 'POST',
    headers: { 'x-upload-token': session.uploadToken },
    body: form
  });
}

export function MobileMessengerMediaComposer({
  conversationId,
  disabled,
  onSent
}: {
  conversationId: string;
  disabled?: boolean;
  onSent: (message: MessengerMediaMessage) => void;
}) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY!);
  const recorderState = useAudioRecorderState(recorder, 100);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraMicPermission, requestCameraMicPermission] =
    useMicrophonePermissions();

  const voicePressActiveRef = useRef(false);
  const voiceRecordingRef = useRef(false);
  const voiceLockedRef = useRef(false);
  const voiceCancelRef = useRef(false);
  const voiceStartPointRef = useRef({ x: 0, y: 0 });
  const voiceStartedAtRef = useRef(0);

  const cameraRef = useRef<CameraView | null>(null);
  const videoStartedAtRef = useRef(0);

  const [voiceLocked, setVoiceLocked] = useState(false);
  const [voiceCancelArmed, setVoiceCancelArmed] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState<VoiceDraft | null>(null);
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [status, setStatus] = useState('');

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [facing, setFacing] = useState<CameraType>('front');
  const [videoRecording, setVideoRecording] = useState(false);
  const [videoDraft, setVideoDraft] = useState<VideoDraft | null>(null);
  const [videoBusy, setVideoBusy] = useState(false);

  async function sendMediaMessage(input: {
    kind: 'VOICE_NOTE' | 'VIDEO_NOTE';
    assetId: string;
    durationSeconds: number;
    voicePreset?: VoicePreset;
  }) {
    const message = await apiFetch<MessengerMediaMessage>(
      `/conversations/${conversationId}/media-messages`,
      {
        method: 'POST',
        body: JSON.stringify(input)
      }
    );
    onSent(message);
  }

  async function ensureOriginalVoiceAsset(draft: VoiceDraft) {
    if (draft.originalAssetId) return draft.originalAssetId;
    const asset = await uploadMediaUri({
      conversationId,
      uri: draft.uri,
      mimeType: 'audio/mp4',
      name: `voice-${Date.now()}.m4a`
    });
    setVoiceDraft((current) =>
      current
        ? { ...current, originalAssetId: asset.id }
        : current
    );
    return asset.id;
  }

  async function startVoice(event: GestureResponderEvent) {
    if (
      disabled ||
      voiceBusy ||
      videoBusy ||
      voiceDraft ||
      cameraOpen ||
      videoDraft
    ) {
      return;
    }

    voicePressActiveRef.current = true;
    voiceLockedRef.current = false;
    voiceCancelRef.current = false;
    voiceStartPointRef.current = {
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY
    };
    setVoiceLocked(false);
    setVoiceCancelArmed(false);
    setStatus('');

    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        voicePressActiveRef.current = false;
        Alert.alert(
          'Microphone requis',
          'Autorise le microphone pour enregistrer un message vocal.'
        );
        return;
      }
      if (!voicePressActiveRef.current) return;

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true
      });
      await recorder.prepareToRecordAsync();
      if (!voicePressActiveRef.current) return;

      voiceStartedAtRef.current = Date.now();
      voiceRecordingRef.current = true;
      recorder.record();
    } catch (cause) {
      voiceRecordingRef.current = false;
      voicePressActiveRef.current = false;
      setStatus(
        cause instanceof Error
          ? cause.message
          : 'Impossible de démarrer le microphone.'
      );
    }
  }

  function moveVoice(event: GestureResponderEvent) {
    if (!voicePressActiveRef.current || !voiceRecordingRef.current) return;
    const up = voiceStartPointRef.current.y - event.nativeEvent.pageY;
    const left = voiceStartPointRef.current.x - event.nativeEvent.pageX;

    if (up >= 72) {
      voiceLockedRef.current = true;
      voiceCancelRef.current = false;
      setVoiceLocked(true);
      setVoiceCancelArmed(false);
      return;
    }

    const cancel = left >= 90;
    voiceCancelRef.current = cancel;
    setVoiceCancelArmed(cancel);
  }

  async function finishVoice(mode: 'send' | 'draft' | 'discard') {
    if (!voiceRecordingRef.current) return;
    voiceRecordingRef.current = false;
    setVoiceBusy(mode !== 'discard');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      const durationSeconds = Math.max(
        0.1,
        (Date.now() - voiceStartedAtRef.current) / 1000
      );

      if (!uri || mode === 'discard') {
        if (mode === 'discard') setStatus('Vocal annulé.');
        return;
      }

      if (mode === 'draft') {
        setVoiceDraft({
          uri,
          durationSeconds,
          preset: 'ORIGINAL',
          previewSource: uri
        });
        return;
      }

      setStatus('Envoi du vocal…');
      const asset = await uploadMediaUri({
        conversationId,
        uri,
        mimeType: 'audio/mp4',
        name: `voice-${Date.now()}.m4a`
      });
      await sendMediaMessage({
        kind: 'VOICE_NOTE',
        assetId: asset.id,
        durationSeconds,
        voicePreset: 'ORIGINAL'
      });
      setStatus('');
    } catch (cause) {
      setStatus(
        cause instanceof Error ? cause.message : 'Envoi du vocal impossible.'
      );
    } finally {
      setVoiceBusy(false);
      voicePressActiveRef.current = false;
      voiceLockedRef.current = false;
      voiceCancelRef.current = false;
      setVoiceLocked(false);
      setVoiceCancelArmed(false);
    }
  }

  function releaseVoice() {
    voicePressActiveRef.current = false;
    if (!voiceRecordingRef.current || voiceLockedRef.current) return;
    void finishVoice(voiceCancelRef.current ? 'discard' : 'send');
  }

  async function stopLockedVoice() {
    voicePressActiveRef.current = false;
    await finishVoice('draft');
  }

  async function chooseVoice(preset: VoicePreset) {
    if (!voiceDraft || voiceBusy) return;
    setVoiceBusy(true);
    setStatus('');
    try {
      if (preset === 'ORIGINAL') {
        setVoiceDraft({
          ...voiceDraft,
          preset,
          transformedAssetId: undefined,
          previewSource: voiceDraft.uri
        });
        return;
      }

      const originalAssetId = await ensureOriginalVoiceAsset(voiceDraft);
      const transformed = await apiFetch<MediaAsset>(
        `/conversations/${conversationId}/voice-transform`,
        {
          method: 'POST',
          body: JSON.stringify({
            assetId: originalAssetId,
            preset
          })
        }
      );
      const remoteSource = await authenticatedMediaSource(transformed.id);
      setVoiceDraft((current) =>
        current
          ? {
              ...current,
              originalAssetId,
              transformedAssetId: transformed.id,
              preset,
              previewSource: remoteSource
            }
          : current
      );
    } catch (cause) {
      setStatus(
        cause instanceof Error
          ? cause.message
          : 'Transformation de voix impossible.'
      );
    } finally {
      setVoiceBusy(false);
    }
  }

  async function sendVoiceDraft() {
    if (!voiceDraft || voiceBusy) return;
    setVoiceBusy(true);
    setStatus('Envoi du vocal…');
    try {
      const assetId =
        voiceDraft.preset === 'ORIGINAL'
          ? await ensureOriginalVoiceAsset(voiceDraft)
          : voiceDraft.transformedAssetId;
      if (!assetId) throw new Error('La voix modifiée n’est pas prête.');

      await sendMediaMessage({
        kind: 'VOICE_NOTE',
        assetId,
        durationSeconds: voiceDraft.durationSeconds,
        voicePreset: voiceDraft.preset
      });
      setVoiceDraft(null);
      setVoicePanelOpen(false);
      setStatus('');
    } catch (cause) {
      setStatus(
        cause instanceof Error ? cause.message : 'Envoi du vocal impossible.'
      );
    } finally {
      setVoiceBusy(false);
    }
  }

  async function openVideoRecorder() {
    if (
      disabled ||
      voiceRecordingRef.current ||
      voiceDraft ||
      videoBusy
    ) {
      return;
    }
    setStatus('');
    const camera =
      cameraPermission?.granted
        ? cameraPermission
        : await requestCameraPermission();
    const microphone =
      cameraMicPermission?.granted
        ? cameraMicPermission
        : await requestCameraMicPermission();
    if (!camera.granted || !microphone.granted) {
      Alert.alert(
        'Caméra et microphone requis',
        'Autorise la caméra et le microphone pour créer une note vidéo.'
      );
      return;
    }
    setCameraReady(false);
    setCameraOpen(true);
  }

  async function recordVideo() {
    if (!cameraRef.current || !cameraReady || videoRecording) return;
    setVideoRecording(true);
    setStatus('');
    videoStartedAtRef.current = Date.now();
    try {
      const result = await cameraRef.current.recordAsync({
        maxDuration: VIDEO_NOTE_MAX_SECONDS,
        maxFileSize: MAX_MEDIA_BYTES
      });
      if (!result?.uri) return;
      setVideoDraft({
        uri: result.uri,
        durationSeconds: Math.min(
          VIDEO_NOTE_MAX_SECONDS,
          Math.max(0.1, (Date.now() - videoStartedAtRef.current) / 1000)
        )
      });
      setCameraOpen(false);
    } catch (cause) {
      setStatus(
        cause instanceof Error
          ? cause.message
          : 'Enregistrement vidéo impossible.'
      );
    } finally {
      setVideoRecording(false);
    }
  }

  function stopVideo() {
    cameraRef.current?.stopRecording();
  }

  async function sendVideoDraft() {
    if (!videoDraft || videoBusy) return;
    setVideoBusy(true);
    setStatus('Envoi de la note vidéo…');
    try {
      const asset = await uploadMediaUri({
        conversationId,
        uri: videoDraft.uri,
        mimeType: 'video/mp4',
        name: `video-note-${Date.now()}.mp4`
      });
      await sendMediaMessage({
        kind: 'VIDEO_NOTE',
        assetId: asset.id,
        durationSeconds: videoDraft.durationSeconds
      });
      setVideoDraft(null);
      setStatus('');
    } catch (cause) {
      setStatus(
        cause instanceof Error
          ? cause.message
          : 'Envoi de la note vidéo impossible.'
      );
    } finally {
      setVideoBusy(false);
    }
  }

  if (cameraOpen) {
    return (
      <View style={styles.cameraPanel}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          mode="video"
          facing={facing}
          mute={false}
          onCameraReady={() => setCameraReady(true)}
          onMountError={({ message }) => setStatus(message)}
        />
        <View style={styles.cameraActions}>
          {!videoRecording ? (
            <Pressable
              style={styles.secondaryButton}
              onPress={() =>
                setFacing((current) =>
                  current === 'front' ? 'back' : 'front'
                )
              }
            >
              <Text style={styles.secondaryText}>Retourner</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={styles.primaryButton}
            disabled={!cameraReady}
            onPress={() =>
              videoRecording ? stopVideo() : void recordVideo()
            }
          >
            <Text style={styles.primaryText}>
              {videoRecording ? 'Arrêter' : 'Enregistrer'}
            </Text>
          </Pressable>
          {!videoRecording ? (
            <Pressable
              style={styles.secondaryButton}
              onPress={() => setCameraOpen(false)}
            >
              <Text style={styles.secondaryText}>Fermer</Text>
            </Pressable>
          ) : null}
        </View>
        {status ? <Text style={styles.status}>{status}</Text> : null}
      </View>
    );
  }

  if (videoDraft) {
    return (
      <View style={styles.draftPanel}>
        <VideoClip source={videoDraft.uri} />
        <View style={styles.row}>
          <Pressable
            style={styles.secondaryButton}
            disabled={videoBusy}
            onPress={() => {
              setVideoDraft(null);
              void openVideoRecorder();
            }}
          >
            <Text style={styles.secondaryText}>Refaire</Text>
          </Pressable>
          <Pressable
            style={styles.primaryButton}
            disabled={videoBusy}
            onPress={() => void sendVideoDraft()}
          >
            <Text style={styles.primaryText}>
              {videoBusy ? 'Envoi…' : 'Envoyer'}
            </Text>
          </Pressable>
        </View>
        {status ? <Text style={styles.status}>{status}</Text> : null}
      </View>
    );
  }

  if (voiceDraft) {
    return (
      <View style={styles.draftPanel}>
        <AudioClip
          source={voiceDraft.previewSource}
          label={`Vocal · voix ${voiceLabel(voiceDraft.preset)}`}
        />
        <View style={styles.row}>
          <Pressable
            style={styles.secondaryButton}
            disabled={voiceBusy}
            onPress={() => {
              setVoiceDraft(null);
              setVoicePanelOpen(false);
            }}
          >
            <Text style={styles.secondaryText}>Supprimer</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            disabled={voiceBusy}
            onPress={() => setVoicePanelOpen((current) => !current)}
          >
            <Text style={styles.secondaryText}>
              Voix · {voiceLabel(voiceDraft.preset)}
            </Text>
          </Pressable>
          <Pressable
            style={styles.primaryButton}
            disabled={voiceBusy}
            onPress={() => void sendVoiceDraft()}
          >
            <Text style={styles.primaryText}>
              {voiceBusy ? 'Traitement…' : 'Envoyer'}
            </Text>
          </Pressable>
        </View>
        {voicePanelOpen ? (
          <View style={styles.voiceChoices}>
            {([
              ['ORIGINAL', 'Originale'],
              ['DEEP', 'Grave'],
              ['BRIGHT', 'Claire'],
              ['ROBOT', 'Robot']
            ] as Array<[VoicePreset, string]>).map(([preset, label]) => (
              <Pressable
                key={preset}
                disabled={voiceBusy}
                onPress={() => void chooseVoice(preset)}
                style={[
                  styles.voiceChoice,
                  voiceDraft.preset === preset && styles.voiceChoiceActive
                ]}
              >
                <Text style={styles.voiceChoiceText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {status ? <Text style={styles.status}>{status}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.composerTools}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel="Maintenir pour enregistrer un vocal"
        onStartShouldSetResponder={() => !disabled && !voiceBusy}
        onResponderGrant={(event) => void startVoice(event)}
        onResponderMove={moveVoice}
        onResponderRelease={releaseVoice}
        onResponderTerminate={releaseVoice}
        style={[
          styles.voiceGesture,
          recorderState.isRecording && styles.voiceGestureActive,
          voiceCancelArmed && styles.voiceGestureCancel
        ]}
      >
        <Text style={styles.secondaryText}>
          {recorderState.isRecording
            ? voiceLocked
              ? 'Vocal verrouillé'
              : voiceCancelArmed
                ? 'Relâche pour annuler'
                : `Parle… ${Math.round(recorderState.durationMillis / 1000)} s`
            : 'Micro'}
        </Text>
      </View>

      {voiceLocked && recorderState.isRecording ? (
        <Pressable
          style={styles.primaryButton}
          onPress={() => void stopLockedVoice()}
        >
          <Text style={styles.primaryText}>Arrêter</Text>
        </Pressable>
      ) : null}

      <Pressable
        style={styles.secondaryButton}
        disabled={disabled || voiceBusy || videoBusy}
        onPress={() => void openVideoRecorder()}
      >
        <Text style={styles.secondaryText}>Note vidéo</Text>
      </Pressable>

      {recorderState.isRecording && !voiceLocked ? (
        <Text style={styles.gestureHint}>↑ verrouiller · ← annuler</Text>
      ) : null}
      {status ? <Text style={styles.status}>{status}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  composerTools: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8
  },
  voiceGesture: {
    borderWidth: 1,
    borderColor: '#315449',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: '#0c1c17'
  },
  voiceGestureActive: {
    borderColor: '#45e6bd',
    backgroundColor: '#123027'
  },
  voiceGestureCancel: {
    borderColor: '#ff9d66',
    backgroundColor: '#2b1710'
  },
  gestureHint: {
    color: '#91a79e',
    fontSize: 11,
    width: '100%'
  },
  draftPanel: {
    borderTopWidth: 1,
    borderTopColor: '#1c3a31',
    padding: 12,
    gap: 10,
    backgroundColor: '#0b1d17'
  },
  cameraPanel: {
    borderTopWidth: 1,
    borderTopColor: '#1c3a31',
    padding: 12,
    gap: 10,
    backgroundColor: '#071410'
  },
  camera: {
    width: '100%',
    height: 360,
    borderRadius: 24,
    overflow: 'hidden'
  },
  cameraActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap'
  },
  primaryButton: {
    backgroundColor: '#45e6bd',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: 'center'
  },
  primaryText: {
    color: '#052017',
    fontWeight: '900'
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#315449',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: 'center',
    backgroundColor: '#0c1c17'
  },
  secondaryText: {
    color: '#d9ebe4',
    fontWeight: '800'
  },
  voiceChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  voiceChoice: {
    borderWidth: 1,
    borderColor: '#315449',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  voiceChoiceActive: {
    borderColor: '#45e6bd',
    backgroundColor: '#123027'
  },
  voiceChoiceText: {
    color: '#d9ebe4',
    fontWeight: '700'
  },
  audioClip: {
    minHeight: 58,
    minWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  mediaPlayButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#45e6bd',
    alignItems: 'center',
    justifyContent: 'center'
  },
  mediaPlayText: {
    color: '#052017',
    fontSize: 11,
    fontWeight: '900'
  },
  mediaStack: {
    alignItems: 'center',
    gap: 6
  },
  mediaTitle: {
    color: '#f4fff9',
    fontWeight: '800'
  },
  mediaMeta: {
    color: '#91a79e',
    fontSize: 11
  },
  mediaFailure: {
    color: '#ff9d66',
    fontSize: 12
  },
  videoClip: {
    width: 220,
    height: 220,
    backgroundColor: '#050807'
  },
  roundVideo: {
    borderRadius: 110
  },
  status: {
    color: '#ffb287',
    fontSize: 11,
    width: '100%'
  }
});
