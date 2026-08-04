'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../../lib/api';
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

  function setActiveCallId(value: string | null) {
    activeCallIdRef.current = value;
    setActiveCallIdState(value);
  }

  function setIncoming(value: IncomingCall | null) {
    incomingRef.current = value;
    setIncomingState(value);
  }

  async function refreshHistory() {
    setHistory(await apiFetch<CallView[]>('/calls/history?take=30'));
  }

  async function loadIceConfiguration(callId: string) {
    const configuration = await apiFetch<IceConfiguration>(
      `/calls/${callId}/ice-configuration`
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
      refreshHistory()
    ]).catch((cause) => {
      setStatus(cause instanceof Error ? cause.message : 'Appels indisponibles.');
    });
  }, [sessionLoading]);

  useEffect(() => {
    if (!socket.connected || !friends.length) return;
    socket.emit('presence:query', {
      userIds: friends.map(({ user }) => user.id)
    });
  }, [friends, socket]);

  useEffect(() => {
    const onConnect = () => setStatus('Prêt · temps réel connecté');
    const onIncoming = (event: IncomingCall) => {
      if (activeCallIdRef.current || incomingRef.current) {
        socket.emit('call:end', {
          targetUserId: event.callerUserId,
          callId: event.callId,
          reason: 'rejected'
        });
        return;
      }
      setIncoming(event);
      setStatus(
        `Appel ${event.media === 'video' ? 'vidéo' : 'audio'} entrant de ${event.callerUsername ?? 'un contact'}.`
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
    configuration: IceConfiguration
  ) {
    const peer = new RTCPeerConnection({
      iceServers: configuration.iceServers
    });
    remoteUserIdRef.current = remoteUserId;

    peer.onicecandidate = (event) => {
      if (!event.candidate) return;
      socket.emit('call:ice-candidate', {
        targetUserId: remoteUserId,
        callId,
        candidate: event.candidate.toJSON()
      });
    };
    peer.ontrack = (event) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'failed' || peer.connectionState === 'closed') {
        cleanup();
      }
      setStatus(`État : ${peer.connectionState}`);
    };

    peerRef.current = peer;
    return peer;
  }

  async function getLocalStream(media: 'audio' | 'video') {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: media === 'video'
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
  }

  async function acceptIncoming() {
    if (!incomingRef.current || starting) return;
    const call = incomingRef.current;
    setStarting(true);

    try {
      setTargetUserId(call.callerUserId);
      setActiveCallId(call.callId);
      const configuration = await loadIceConfiguration(call.callId);
      const peer = createPeer(call.callerUserId, call.callId, configuration);
      await peer.setRemoteDescription(call.offer);
      const stream = await getLocalStream(call.media);
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit('call:answer', {
        targetUserId: call.callerUserId,
        callId: call.callId,
        answer
      });
      setIncoming(null);
      setStatus('Appel connecté via une configuration ICE éphémère');
    } catch (cause) {
      setStatus(
        cause instanceof Error
          ? cause.message
          : 'Impossible d’accepter l’appel.'
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
      reason: 'rejected'
    });
    setIncoming(null);
    cleanup();
    setStatus('Appel refusé');
    void refreshHistory();
  }

  async function startCall(media: 'audio' | 'video') {
    if (!targetUserId || starting || activeCallIdRef.current) return;
    setStarting(true);
    let serverCallId: string | null = null;

    try {
      const created = await apiFetch<CallView>('/calls', {
        method: 'POST',
        body: JSON.stringify({
          calleeUserId: targetUserId,
          media,
          idempotencyKey: operationKey('web-call-create')
        })
      });
      serverCallId = created.id;
      setActiveCallId(created.id);
      const configuration = await loadIceConfiguration(created.id);
      const peer = createPeer(targetUserId, created.id, configuration);
      const stream = await getLocalStream(media);
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit('call:offer', {
        targetUserId,
        callId: created.id,
        offer,
        media
      });
      setStatus('Appel en cours · relais éphémère prêt');
      void refreshHistory();
    } catch (cause) {
      if (serverCallId) {
        void apiFetch(`/calls/${serverCallId}/end`, {
          method: 'POST',
          body: JSON.stringify({ reason: 'cancelled' })
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
        reason: 'ended'
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
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    remoteUserIdRef.current = '';
    setActiveCallId(null);
  }

  const selectedFriend = friends.find(({ user }) => user.id === targetUserId)?.user;
  const selectedOnline = targetUserId ? onlineUserIds.has(targetUserId) : false;

  if (sessionLoading) return <main className="shell">Chargement…</main>;

  return (
    <main className="shell" style={{ maxWidth: 1000, margin: '0 auto' }}>
      <header>
        <small style={{ color: 'var(--orange)' }}>KMD-058 · RELAIS ÉPHÉMÈRES</small>
        <h1>Appels KnowMe</h1>
        <p style={{ color: 'var(--muted)' }}>{status}</p>
        <p style={{ color: 'var(--muted)' }}>
          L’API livre une configuration ICE limitée à cet appel. Le secret TURN,
          les offres SDP et les candidats ICE ne sont jamais persistés ni exposés.
        </p>
      </header>

      {incoming ? (
        <section className="card" style={{ padding: 22, marginBottom: 18, borderColor: 'var(--mint)' }}>
          <h2>Appel entrant</h2>
          <p>
            {incoming.callerUsername ?? incoming.callerUserId} souhaite lancer un
            appel {incoming.media === 'video' ? 'vidéo' : 'audio'}.
          </p>
          <p style={{ color: 'var(--muted)' }}>
            La caméra et le microphone ne seront demandés qu’après ton accord.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" disabled={starting} onClick={() => void acceptIncoming()}>
              {starting ? 'Connexion…' : 'Accepter'}
            </button>
            <button className="btn" onClick={declineIncoming}>Refuser</button>
          </div>
        </section>
      ) : null}

      <section className="card grid" style={{ padding: 22 }}>
        <label>
          <span style={{ display: 'block', marginBottom: 8 }}>Choisir un contact</span>
          <select
            className="input"
            value={targetUserId}
            disabled={Boolean(activeCallId)}
            onChange={(event) => setTargetUserId(event.target.value)}
          >
            <option value="">Sélectionne un ami</option>
            {friends.map(({ user }) => (
              <option key={user.id} value={user.id}>
                {onlineUserIds.has(user.id) ? '●' : '○'} {user.displayName} (@{user.username})
              </option>
            ))}
          </select>
        </label>

        {selectedFriend ? (
          <p style={{ color: selectedOnline ? 'var(--mint)' : 'var(--muted)' }}>
            {selectedOnline ? '● En ligne' : '○ Hors ligne'} · {selectedFriend.displayName}
          </p>
        ) : null}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" disabled={!targetUserId || starting || Boolean(activeCallId)} onClick={() => void startCall('audio')}>
            Appel audio
          </button>
          <button className="btn btn-accent" disabled={!targetUserId || starting || Boolean(activeCallId)} onClick={() => void startCall('video')}>
            Appel vidéo
          </button>
          <button className="btn" disabled={!activeCallId} onClick={endCall}>Terminer</button>
        </div>
      </section>

      <section className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', marginTop: 20 }}>
        <article className="card" style={{ padding: 16 }}>
          <h2>Moi</h2>
          <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', borderRadius: 18, background: '#000', minHeight: 200 }} />
        </article>
        <article className="card" style={{ padding: 16 }}>
          <h2>Correspondant</h2>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', borderRadius: 18, background: '#000', minHeight: 200 }} />
        </article>
      </section>

      <section className="card" style={{ padding: 22, marginTop: 20 }}>
        <h2>Historique autoritaire</h2>
        <div style={{ display: 'grid', gap: 10 }}>
          {history.map((call) => (
            <article key={call.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12 }}>
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
