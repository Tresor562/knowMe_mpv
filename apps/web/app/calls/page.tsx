'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { apiFetch, type ApiError } from '../../lib/api';
import {
  buildCallPreferenceUpdate,
  buildMediaConstraints,
  classifyMediaPreparationFailure,
  isCallMediaPrepared,
  mediaPreparationFailureMessage,
  type BrowserMediaPermission,
  type CallMedia,
  type CallPreferenceFields,
  type CallPreferenceView,
  type MediaPreparationState,
} from '../../lib/call-preparation';
import { CallPreferencesPanel } from '../../components/call-preferences-panel';
import { CallPreparationPanel } from '../../components/call-preparation-panel';
import { getRealtimeSocket } from '../../lib/realtime';
import { useSession } from '../../lib/use-session';

type Friend = {
  user: { id: string; displayName: string; username: string };
};

type IncomingCall = {
  callId: string;
  callerUserId: string;
  callerUsername?: string;
  offer: RTCSessionDescriptionInit;
  media: 'audio' | 'video';
};

type CallView = {
  id: string;
  direction: 'OUTGOING' | 'INCOMING';
  media: 'audio' | 'video';
  status: string;
  peer: { id: string; displayName: string; username: string } | null;
  answeredAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  createdAt: string;
  policy: {
    serverIssuedCallId: true;
    sessionDescriptionsPersisted: false;
    iceCandidatesPersisted: false;
  };
};

type IceConfiguration = {
  callId: string;
  iceServers: RTCIceServer[];
  expiresAt: string;
  policy: {
    ephemeralCredentials: boolean;
    secretExposed: false;
    persistedCredential: false;
  };
};

type PresenceEvent = { userId: string; online: boolean };
type PresenceSnapshot = { onlineUserIds: string[] };

function operationKey(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}:${crypto.randomUUID()}`;
  }
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function mediaTrackAllowed(track: MediaStreamTrack, media: CallMedia) {
  return track.kind === 'audio' || media === 'video';
}

async function readMediaPermission(
  name: 'microphone' | 'camera',
): Promise<BrowserMediaPermission> {
  if (!navigator.permissions?.query) return 'unknown';
  try {
    return (await navigator.permissions.query({ name: name as PermissionName }))
      .state;
  } catch {
    return 'unknown';
  }
}

export default function CallsPage() {
  const { loading: sessionLoading } = useSession({ required: true });
  const socket = useMemo(() => getRealtimeSocket(), []);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteUserIdRef = useRef('');
  const activeCallIdRef = useRef<string | null>(null);
  const incomingRef = useRef<IncomingCall | null>(null);

  const [friends, setFriends] = useState<Friend[]>([]);
  const [history, setHistory] = useState<CallView[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [targetUserId, setTargetUserId] = useState('');
  const [status, setStatus] = useState('Prêt');
  const [activeCallId, setActiveCallIdState] = useState<string | null>(null);
  const [incoming, setIncomingState] = useState<IncomingCall | null>(null);
  const [starting, setStarting] = useState(false);
  const [preferences, setPreferences] = useState<CallPreferenceView | null>(
    null,
  );
  const [preferenceMessage, setPreferenceMessage] = useState('');
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [preparationMedia, setPreparationMedia] = useState<CallMedia>('video');
  const [preparationState, setPreparationState] =
    useState<MediaPreparationState>('idle');
  const [preparationMessage, setPreparationMessage] = useState(
    'Le navigateur ne demandera aucun accès avant ton action.',
  );
  const [preparedMedia, setPreparedMedia] = useState<CallMedia | null>(null);
  const [microphonePermission, setMicrophonePermission] =
    useState<BrowserMediaPermission>('unknown');
  const [cameraPermission, setCameraPermission] =
    useState<BrowserMediaPermission>('unknown');
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState('');
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [requiredDevicePreview, setRequiredDevicePreview] = useState(true);
  const [preparing, setPreparing] = useState(false);

  function setActiveCallId(value: string | null) {
    activeCallIdRef.current = value;
    setActiveCallIdState(value);
  }

  function setIncoming(value: IncomingCall | null) {
    incomingRef.current = value;
    setIncomingState(value);
  }

  const refreshPermissionStates = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicrophonePermission('unsupported');
      setCameraPermission('unsupported');
      return;
    }
    const [microphone, camera] = await Promise.all([
      readMediaPermission('microphone'),
      readMediaPermission('camera'),
    ]);
    setMicrophonePermission(microphone);
    setCameraPermission(camera);
  }, []);

  const refreshDevices = useCallback(async (stream?: MediaStream) => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const nextMicrophones = devices.filter(
      (device) => device.kind === 'audioinput',
    );
    const nextCameras = devices.filter(
      (device) => device.kind === 'videoinput',
    );
    const activeMicrophoneId = stream
      ?.getAudioTracks()[0]
      ?.getSettings().deviceId;
    const activeCameraId = stream?.getVideoTracks()[0]?.getSettings().deviceId;

    setMicrophones(nextMicrophones);
    setCameras(nextCameras);
    setSelectedMicrophoneId((current) =>
      nextMicrophones.some((device) => device.deviceId === current)
        ? current
        : (activeMicrophoneId ?? nextMicrophones[0]?.deviceId ?? ''),
    );
    setSelectedCameraId((current) =>
      nextCameras.some((device) => device.deviceId === current)
        ? current
        : (activeCameraId ?? nextCameras[0]?.deviceId ?? ''),
    );
  }, []);

  function patchPreference(patch: Partial<CallPreferenceFields>) {
    setPreferences((current) => (current ? { ...current, ...patch } : current));
  }

  async function loadPreferences() {
    const next = await apiFetch<CallPreferenceView>('/calls/preferences');
    setPreferences(next);
    setMicrophoneEnabled(next.microphoneEnabledByDefault);
    setCameraEnabled(next.cameraEnabledByDefault);
    setRequiredDevicePreview(next.devicePreviewRequired);
    setPreferenceMessage('');
    return next;
  }

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preferences || savingPreferences) return;
    setSavingPreferences(true);
    setPreferenceMessage('');

    try {
      const saved = await apiFetch<CallPreferenceView>('/calls/preferences', {
        method: 'PUT',
        body: JSON.stringify(
          buildCallPreferenceUpdate(preferences, preferences.version),
        ),
      });
      setPreferences(saved);
      setMicrophoneEnabled(saved.microphoneEnabledByDefault);
      setCameraEnabled(saved.cameraEnabledByDefault);
      setRequiredDevicePreview(saved.devicePreviewRequired);
      setPreferenceMessage('Préférences d’appel enregistrées.');
    } catch (cause) {
      if ((cause as ApiError).code === 'CALL_PREFERENCE_VERSION_CONFLICT') {
        try {
          await loadPreferences();
          setPreferenceMessage(
            'Les préférences avaient changé ailleurs. La version récente a été rechargée.',
          );
        } catch {
          setPreferenceMessage(
            'Les préférences ont changé ailleurs, mais leur version récente n’a pas pu être rechargée.',
          );
        }
      } else {
        setPreferenceMessage(
          cause instanceof Error
            ? cause.message
            : 'Impossible d’enregistrer les préférences.',
        );
      }
    } finally {
      setSavingPreferences(false);
    }
  }

  const releaseLocalMedia = useCallback((resetPreparation = true) => {
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    setPreparedMedia(null);
    if (resetPreparation) {
      setPreparationState('idle');
      setPreparationMessage('Aperçu local arrêté.');
    }
  }, []);

  function applyLocalTrackDefaults(stream: MediaStream) {
    stream
      .getAudioTracks()
      .forEach((track) => (track.enabled = microphoneEnabled));
    stream.getVideoTracks().forEach((track) => (track.enabled = cameraEnabled));
  }

  async function prepareDevices(media: CallMedia = preparationMedia) {
    if (preparing || activeCallIdRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setPreparationState('unsupported');
      setPreparationMessage(
        'Ce navigateur ne fournit pas l’accès sécurisé aux appareils média.',
      );
      return;
    }

    setPreparing(true);
    setPreparationMedia(media);
    setPreparationState('requesting');
    setPreparationMessage(
      `Autorise ${media === 'video' ? 'le microphone et la caméra' : 'le microphone'} pour lancer uniquement l’aperçu local.`,
    );
    releaseLocalMedia(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        buildMediaConstraints(media, selectedMicrophoneId, selectedCameraId),
      );
      applyLocalTrackDefaults(stream);
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      await refreshDevices(stream);
      await refreshPermissionStates();
      setPreparedMedia(media);
      setPreparationState('ready');
      setPreparationMessage(
        `Aperçu ${media === 'video' ? 'audio et vidéo' : 'audio'} prêt. Aucun identifiant d’appareil ni flux n’a été envoyé à l’API.`,
      );
    } catch (cause) {
      const failure = classifyMediaPreparationFailure(cause);
      setPreparationState(failure === 'unknown' ? 'error' : failure);
      setPreparationMessage(mediaPreparationFailureMessage(failure));
      await refreshPermissionStates();
    } finally {
      setPreparing(false);
    }
  }

  function changeLocalDevice(kind: 'microphone' | 'camera', deviceId: string) {
    kind === 'microphone'
      ? setSelectedMicrophoneId(deviceId)
      : setSelectedCameraId(deviceId);
    releaseLocalMedia(false);
    setPreparationState('idle');
    setPreparationMessage(
      'Sélection modifiée localement. Relance le test avant un appel.',
    );
  }

  function toggleMicrophone(enabled: boolean) {
    setMicrophoneEnabled(enabled);
    localStreamRef.current
      ?.getAudioTracks()
      .forEach((track) => (track.enabled = enabled));
  }

  function toggleCamera(enabled: boolean) {
    setCameraEnabled(enabled);
    localStreamRef.current
      ?.getVideoTracks()
      .forEach((track) => (track.enabled = enabled));
  }

  async function refreshHistory() {
    setHistory(await apiFetch<CallView[]>('/calls/history?take=30'));
  }

  async function loadIceConfiguration(callId: string) {
    const configuration = await apiFetch<IceConfiguration>(
      `/calls/${callId}/ice-configuration`,
    );
    if (configuration.callId !== callId || !configuration.iceServers.length) {
      throw new Error('La configuration réseau de cet appel est invalide.');
    }
    return configuration;
  }

  useEffect(() => {
    if (sessionLoading) return;
    void Promise.all([
      apiFetch<Friend[]>('/social/friends').then(setFriends),
      refreshHistory(),
      loadPreferences().catch((cause) => {
        setPreferenceMessage(
          cause instanceof Error
            ? cause.message
            : 'Préférences d’appel indisponibles.',
        );
        throw cause;
      }),
    ]).catch((cause) => {
      setStatus(
        cause instanceof Error ? cause.message : 'Appels indisponibles.',
      );
    });
  }, [sessionLoading]);

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPreparationState('unsupported');
      setMicrophonePermission('unsupported');
      setCameraPermission('unsupported');
      setPreparationMessage(
        'Ce navigateur ne fournit pas l’accès sécurisé aux appareils média.',
      );
      return;
    }

    void refreshPermissionStates();
    void refreshDevices();
    const handleDeviceChange = () => {
      void refreshDevices(localStreamRef.current ?? undefined);
    };
    navigator.mediaDevices.addEventListener?.(
      'devicechange',
      handleDeviceChange,
    );
    return () => {
      navigator.mediaDevices.removeEventListener?.(
        'devicechange',
        handleDeviceChange,
      );
    };
  }, [refreshDevices, refreshPermissionStates]);

  useEffect(() => {
    const stopInactivePreviewWhenHidden = () => {
      if (
        document.visibilityState !== 'hidden' ||
        activeCallIdRef.current ||
        !localStreamRef.current
      ) {
        return;
      }
      releaseLocalMedia();
      setPreparationMessage(
        'Aperçu local arrêté lorsque KnowMe est passé en arrière-plan.',
      );
    };

    document.addEventListener(
      'visibilitychange',
      stopInactivePreviewWhenHidden,
    );
    return () => {
      document.removeEventListener(
        'visibilitychange',
        stopInactivePreviewWhenHidden,
      );
    };
  }, [releaseLocalMedia]);

  useEffect(() => {
    if (!socket.connected || !friends.length) return;
    socket.emit('presence:query', {
      userIds: friends.map(({ user }) => user.id),
    });
  }, [friends, socket]);

  useEffect(() => {
    const onConnect = () => setStatus('Prêt · temps réel connecté');
    const onIncoming = (event: IncomingCall) => {
      if (activeCallIdRef.current || incomingRef.current) {
        socket.emit('call:end', {
          targetUserId: event.callerUserId,
          callId: event.callId,
          reason: 'rejected',
        });
        return;
      }
      setIncoming(event);
      setPreparationMedia(event.media);
      setStatus(
        `Appel ${event.media === 'video' ? 'vidéo' : 'audio'} entrant de ${event.callerUsername ?? 'un contact'}.`,
      );
    };
    const onAnswered = async (event: {
      callId: string;
      responderUserId: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      if (event.callId !== activeCallIdRef.current) return;
      await peerRef.current?.setRemoteDescription(event.answer);
      setStatus('Appel connecté');
      void refreshHistory();
    };
    const onIceCandidate = async (event: {
      callId: string;
      candidate?: RTCIceCandidateInit;
    }) => {
      if (event.callId !== activeCallIdRef.current || !event.candidate) return;
      await peerRef.current?.addIceCandidate(event.candidate);
    };
    const onEnded = (event: { callId: string; reason?: string }) => {
      if (
        event.callId !== activeCallIdRef.current &&
        event.callId !== incomingRef.current?.callId
      ) {
        return;
      }
      cleanup();
      setIncoming(null);
      setStatus(event.reason === 'rejected' ? 'Appel refusé' : 'Appel terminé');
      void refreshHistory();
    };
    const onCallError = (event: { callId?: string; message: string }) => {
      if (event.callId && event.callId !== activeCallIdRef.current) return;
      cleanup();
      setStatus(event.message);
      void refreshHistory();
    };
    const onPresence = (event: PresenceEvent) => {
      setOnlineUserIds((current) => {
        const next = new Set(current);
        event.online ? next.add(event.userId) : next.delete(event.userId);
        return next;
      });
    };
    const onSnapshot = (event: PresenceSnapshot) => {
      setOnlineUserIds(new Set(event.onlineUserIds));
    };

    socket.on('connect', onConnect);
    socket.on('call:incoming', onIncoming);
    socket.on('call:answered', onAnswered);
    socket.on('call:ice-candidate', onIceCandidate);
    socket.on('call:ended', onEnded);
    socket.on('call:error', onCallError);
    socket.on('presence:update', onPresence);
    socket.on('presence:snapshot', onSnapshot);

    if (socket.connected) onConnect();
    else socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('call:incoming', onIncoming);
      socket.off('call:answered', onAnswered);
      socket.off('call:ice-candidate', onIceCandidate);
      socket.off('call:ended', onEnded);
      socket.off('call:error', onCallError);
      socket.off('presence:update', onPresence);
      socket.off('presence:snapshot', onSnapshot);
      cleanup();
    };
  }, [socket]);

  function createPeer(
    remoteUserId: string,
    callId: string,
    configuration: IceConfiguration,
  ) {
    const peer = new RTCPeerConnection({
      iceServers: configuration.iceServers,
    });
    remoteUserIdRef.current = remoteUserId;

    peer.onicecandidate = (event) => {
      if (!event.candidate) return;
      socket.emit('call:ice-candidate', {
        targetUserId: remoteUserId,
        callId,
        candidate: event.candidate.toJSON(),
      });
    };
    peer.ontrack = (event) => {
      if (remoteVideoRef.current)
        remoteVideoRef.current.srcObject = event.streams[0];
    };
    peer.onconnectionstatechange = () => {
      if (
        peer.connectionState === 'failed' ||
        peer.connectionState === 'closed'
      ) {
        cleanup();
      }
      setStatus(`État : ${peer.connectionState}`);
    };

    peerRef.current = peer;
    return peer;
  }

  async function getLocalStream(media: CallMedia) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        'Ce navigateur ne fournit pas l’accès sécurisé aux appareils média.',
      );
    }

    const current = localStreamRef.current;
    const hasLiveAudio = current
      ?.getAudioTracks()
      .some((track) => track.readyState === 'live');
    const hasLiveVideo = current
      ?.getVideoTracks()
      .some((track) => track.readyState === 'live');
    if (current && hasLiveAudio && (media === 'audio' || hasLiveVideo)) {
      if (media === 'audio') {
        current.getVideoTracks().forEach((track) => {
          track.stop();
          current.removeTrack(track);
        });
      }
      applyLocalTrackDefaults(current);
      setPreparedMedia(null);
      setPreparationState('idle');
      setPreparationMessage('Les appareils locaux sont utilisés par l’appel.');
      return current;
    }

    releaseLocalMedia(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        buildMediaConstraints(media, selectedMicrophoneId, selectedCameraId),
      );
      applyLocalTrackDefaults(stream);
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      setPreparationState('idle');
      setPreparationMessage('Les appareils locaux sont utilisés par l’appel.');
      return stream;
    } catch (cause) {
      const failure = classifyMediaPreparationFailure(cause);
      const message = mediaPreparationFailureMessage(failure);
      setPreparationState(failure === 'unknown' ? 'error' : failure);
      setPreparationMessage(message);
      await refreshPermissionStates();
      throw new Error(message);
    }
  }

  async function acceptIncoming() {
    if (!incomingRef.current || starting) return;
    const call = incomingRef.current;
    if (
      !isCallMediaPrepared(preparedMedia, call.media, requiredDevicePreview)
    ) {
      setStatus('Teste tes appareils avant d’accepter cet appel.');
      return;
    }
    setStarting(true);

    try {
      setTargetUserId(call.callerUserId);
      setActiveCallId(call.callId);
      const configuration = await loadIceConfiguration(call.callId);
      const peer = createPeer(call.callerUserId, call.callId, configuration);
      await peer.setRemoteDescription(call.offer);
      const stream = await getLocalStream(call.media);
      stream
        .getTracks()
        .filter((track) => mediaTrackAllowed(track, call.media))
        .forEach((track) => peer.addTrack(track, stream));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('call:answer', {
        targetUserId: call.callerUserId,
        callId: call.callId,
        answer,
      });
      setIncoming(null);
      setStatus('Appel connecté via une configuration ICE éphémère');
    } catch (cause) {
      setStatus(
        cause instanceof Error
          ? cause.message
          : 'Impossible d’accepter l’appel.',
      );
      declineIncoming();
    } finally {
      setStarting(false);
    }
  }

  function declineIncoming() {
    const call = incomingRef.current;
    if (!call) return;
    socket.emit('call:end', {
      targetUserId: call.callerUserId,
      callId: call.callId,
      reason: 'rejected',
    });
    setIncoming(null);
    cleanup();
    setStatus('Appel refusé');
    void refreshHistory();
  }

  async function startCall(media: CallMedia) {
    if (!targetUserId || starting || activeCallIdRef.current) return;
    if (!isCallMediaPrepared(preparedMedia, media, requiredDevicePreview)) {
      setStatus('Teste tes appareils avant de lancer cet appel.');
      return;
    }
    setStarting(true);
    let serverCallId: string | null = null;

    try {
      const created = await apiFetch<CallView>('/calls', {
        method: 'POST',
        body: JSON.stringify({
          calleeUserId: targetUserId,
          media,
          idempotencyKey: operationKey('web-call-create'),
        }),
      });
      serverCallId = created.id;
      setActiveCallId(created.id);
      const configuration = await loadIceConfiguration(created.id);
      const peer = createPeer(targetUserId, created.id, configuration);
      const stream = await getLocalStream(media);
      stream
        .getTracks()
        .filter((track) => mediaTrackAllowed(track, media))
        .forEach((track) => peer.addTrack(track, stream));
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit('call:offer', {
        targetUserId,
        callId: created.id,
        offer,
        media,
      });
      setStatus('Appel en cours · relais éphémère prêt');
      void refreshHistory();
    } catch (cause) {
      if (serverCallId) {
        void apiFetch(`/calls/${serverCallId}/end`, {
          method: 'POST',
          body: JSON.stringify({ reason: 'cancelled' }),
        }).catch(() => undefined);
      }
      cleanup();
      setStatus(cause instanceof Error ? cause.message : 'Appel impossible.');
      void refreshHistory();
    } finally {
      setStarting(false);
    }
  }

  function endCall() {
    const callId = activeCallIdRef.current;
    if (callId && remoteUserIdRef.current) {
      socket.emit('call:end', {
        targetUserId: remoteUserIdRef.current,
        callId,
        reason: 'ended',
      });
    }
    cleanup();
    setStatus('Appel terminé');
    void refreshHistory();
  }

  function cleanup() {
    const peer = peerRef.current;
    peerRef.current = null;
    if (peer && peer.connectionState !== 'closed') peer.close();
    releaseLocalMedia();
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    remoteUserIdRef.current = '';
    setActiveCallId(null);
  }

  const selectedFriend = friends.find(
    ({ user }) => user.id === targetUserId,
  )?.user;
  const selectedOnline = targetUserId ? onlineUserIds.has(targetUserId) : false;
  const previewRequired = requiredDevicePreview;
  const audioPrepared = isCallMediaPrepared(
    preparedMedia,
    'audio',
    previewRequired,
  );
  const videoPrepared = isCallMediaPrepared(
    preparedMedia,
    'video',
    previewRequired,
  );
  const localMediaActive = Boolean(localStreamRef.current);

  if (sessionLoading) return <main className="shell">Chargement…</main>;

  return (
    <main className="shell" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <header>
        <small style={{ color: 'var(--orange)' }}>
          KMD-059 · DISPONIBILITÉ ET PRÉPARATION
        </small>
        <h1>Appels KnowMe</h1>
        <p role="status" aria-live="polite" style={{ color: 'var(--muted)' }}>
          {status}
        </p>
        <p style={{ color: 'var(--muted)' }}>
          L’API livre une configuration ICE limitée à cet appel. Le secret TURN,
          les offres SDP et les candidats ICE ne sont jamais persistés ni
          exposés.
        </p>
      </header>

      <CallPreferencesPanel
        preferences={preferences}
        message={preferenceMessage}
        saving={savingPreferences}
        onSubmit={savePreferences}
        onPatch={patchPreference}
        onMicrophoneDefaultChange={(enabled) => {
          patchPreference({ microphoneEnabledByDefault: enabled });
          toggleMicrophone(enabled);
        }}
        onCameraDefaultChange={(enabled) => {
          patchPreference({ cameraEnabledByDefault: enabled });
          toggleCamera(enabled);
        }}
      />

      <CallPreparationPanel
        media={preparationMedia}
        state={preparationState}
        message={preparationMessage}
        microphonePermission={microphonePermission}
        cameraPermission={cameraPermission}
        microphones={microphones}
        cameras={cameras}
        selectedMicrophoneId={selectedMicrophoneId}
        selectedCameraId={selectedCameraId}
        microphoneEnabled={microphoneEnabled}
        cameraEnabled={cameraEnabled}
        preparing={preparing}
        callActive={Boolean(activeCallId)}
        localMediaActive={localMediaActive}
        onMediaChange={(media) => {
          setPreparationMedia(media);
          releaseLocalMedia(false);
          setPreparationState('idle');
          setPreparationMessage('Mode modifié. Lance le test local.');
        }}
        onDeviceChange={changeLocalDevice}
        onMicrophoneToggle={toggleMicrophone}
        onCameraToggle={toggleCamera}
        onPrepare={() => void prepareDevices()}
        onStop={() => releaseLocalMedia()}
      />

      {incoming ? (
        <section
          className="card"
          style={{ padding: 22, marginBottom: 18, borderColor: 'var(--mint)' }}
        >
          <h2>Appel entrant</h2>
          <p>
            {incoming.callerUsername ?? incoming.callerUserId} souhaite lancer
            un appel {incoming.media === 'video' ? 'vidéo' : 'audio'}.
          </p>
          <p style={{ color: 'var(--muted)' }}>
            La caméra et le microphone ne seront demandés qu’après ton accord.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {!isCallMediaPrepared(
              preparedMedia,
              incoming.media,
              previewRequired,
            ) ? (
              <button
                type="button"
                className="btn btn-accent"
                disabled={preparing || starting}
                onClick={() => void prepareDevices(incoming.media)}
              >
                Préparer{' '}
                {incoming.media === 'video' ? 'audio et vidéo' : 'l’audio'}
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-primary"
              disabled={
                starting ||
                !(incoming.media === 'video' ? videoPrepared : audioPrepared)
              }
              onClick={() => void acceptIncoming()}
            >
              {starting ? 'Connexion…' : 'Accepter'}
            </button>
            <button type="button" className="btn" onClick={declineIncoming}>
              Refuser
            </button>
          </div>
        </section>
      ) : null}

      <section className="card grid" style={{ padding: 22 }}>
        <label>
          <span style={{ display: 'block', marginBottom: 8 }}>
            Choisir un contact
          </span>
          <select
            className="input"
            value={targetUserId}
            disabled={Boolean(activeCallId)}
            onChange={(event) => setTargetUserId(event.target.value)}
          >
            <option value="">Sélectionne un ami</option>
            {friends.map(({ user }) => (
              <option key={user.id} value={user.id}>
                {onlineUserIds.has(user.id) ? '●' : '○'} {user.displayName} (@
                {user.username})
              </option>
            ))}
          </select>
        </label>

        {selectedFriend ? (
          <p style={{ color: selectedOnline ? 'var(--mint)' : 'var(--muted)' }}>
            {selectedOnline ? '● En ligne' : '○ Hors ligne'} ·{' '}
            {selectedFriend.displayName}
          </p>
        ) : null}

        {previewRequired && (!audioPrepared || !videoPrepared) ? (
          <p style={{ color: 'var(--muted)', margin: 0 }}>
            Le test local est obligatoire pour le mode choisi avant de lancer
            l’appel.
          </p>
        ) : null}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={
              !targetUserId ||
              starting ||
              Boolean(activeCallId) ||
              !audioPrepared
            }
            onClick={() => void startCall('audio')}
          >
            Appel audio
          </button>
          <button
            type="button"
            className="btn btn-accent"
            disabled={
              !targetUserId ||
              starting ||
              Boolean(activeCallId) ||
              !videoPrepared
            }
            onClick={() => void startCall('video')}
          >
            Appel vidéo
          </button>
          <button
            type="button"
            className="btn"
            disabled={!activeCallId}
            onClick={endCall}
          >
            Terminer
          </button>
        </div>
      </section>

      <section
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
          marginTop: 20,
        }}
      >
        <article className="card" style={{ padding: 16 }}>
          <h2>Aperçu local</h2>
          <video
            ref={localVideoRef}
            aria-label="Aperçu vidéo local"
            autoPlay
            muted
            playsInline
            style={{
              width: '100%',
              borderRadius: 18,
              background: '#000',
              minHeight: 200,
            }}
          />
        </article>
        <article className="card" style={{ padding: 16 }}>
          <h2>Correspondant</h2>
          <video
            ref={remoteVideoRef}
            aria-label="Vidéo du correspondant"
            autoPlay
            playsInline
            style={{
              width: '100%',
              borderRadius: 18,
              background: '#000',
              minHeight: 200,
            }}
          />
        </article>
      </section>

      <section className="card" style={{ padding: 22, marginTop: 20 }}>
        <h2>Historique autoritaire</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {history.map((call) => (
            <article
              key={call.id}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 12,
              }}
            >
              <strong>
                {call.direction === 'OUTGOING' ? 'Sortant' : 'Entrant'} ·{' '}
                {call.media === 'video' ? 'Vidéo' : 'Audio'}
              </strong>
              <p style={{ margin: '6px 0' }}>
                {call.peer?.displayName ?? 'Compte supprimé'} · {call.status}
              </p>
              <small style={{ color: 'var(--muted)' }}>
                {new Date(call.createdAt).toLocaleString()}
              </small>
            </article>
          ))}
          {!history.length ? (
            <p style={{ color: 'var(--muted)' }}>Aucun appel enregistré.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
