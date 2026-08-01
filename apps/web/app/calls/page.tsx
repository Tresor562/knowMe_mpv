'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getRealtimeSocket } from '../../lib/realtime';

const rtcConfiguration: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
};

export default function CallsPage() {
  const socket = useMemo(() => getRealtimeSocket(), []);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [targetUserId, setTargetUserId] = useState('');
  const [status, setStatus] = useState('Prêt');
  const [activeCallId, setActiveCallId] = useState<string | null>(null);

  useEffect(() => {
    socket.on('call:incoming', async (event) => {
      setStatus(`Appel entrant de ${event.callerUsername ?? 'un utilisateur'}`);
      setTargetUserId(event.callerUserId);
      setActiveCallId(event.callId);

      const peer = createPeer(event.callerUserId, event.callId);
      await peer.setRemoteDescription(event.offer);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: event.media === 'video'
      });

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      socket.emit('call:answer', {
        targetUserId: event.callerUserId,
        callId: event.callId,
        answer
      });

      setStatus('Appel connecté');
    });

    socket.on('call:answered', async (event) => {
      await peerRef.current?.setRemoteDescription(event.answer);
      setStatus('Appel connecté');
    });

    socket.on('call:ice-candidate', async (event) => {
      if (event.candidate) {
        await peerRef.current?.addIceCandidate(event.candidate);
      }
    });

    socket.on('call:ended', () => {
      cleanup();
      setStatus('Appel terminé');
    });

    return () => {
      socket.off('call:incoming');
      socket.off('call:answered');
      socket.off('call:ice-candidate');
      socket.off('call:ended');
      cleanup();
    };
  }, [socket]);

  function createPeer(remoteUserId: string, callId: string) {
    const peer = new RTCPeerConnection(rtcConfiguration);

    peer.onicecandidate = (event) => {
      if (!event.candidate) return;

      socket.emit('call:ice-candidate', {
        targetUserId: remoteUserId,
        callId,
        candidate: event.candidate
      });
    };

    peer.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    peer.onconnectionstatechange = () => {
      setStatus(`État : ${peer.connectionState}`);
    };

    peerRef.current = peer;
    return peer;
  }

  async function startCall(media: 'audio' | 'video') {
    if (!targetUserId.trim()) {
      setStatus('Entre l’identifiant utilisateur du destinataire.');
      return;
    }

    const callId = crypto.randomUUID();
    setActiveCallId(callId);

    const peer = createPeer(targetUserId.trim(), callId);
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: media === 'video'
    });

    localStreamRef.current = stream;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    stream.getTracks().forEach((track) => peer.addTrack(track, stream));

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    socket.emit('call:offer', {
      targetUserId: targetUserId.trim(),
      callId,
      offer,
      media
    });

    setStatus('Appel en cours...');
  }

  function endCall() {
    if (activeCallId && targetUserId) {
      socket.emit('call:end', {
        targetUserId,
        callId: activeCallId
      });
    }

    cleanup();
    setStatus('Appel terminé');
  }

  function cleanup() {
    peerRef.current?.close();
    peerRef.current = null;

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    setActiveCallId(null);
  }

  return (
    <main className="shell" style={{maxWidth:1000,margin:'0 auto'}}>
      <header>
        <small style={{color:'var(--orange)'}}>WEBRTC MVP</small>
        <h1>Appels KnowMe</h1>
        <p style={{color:'var(--muted)'}}>{status}</p>
      </header>

      <section className="card grid" style={{padding:22}}>
        <input
          className="input"
          placeholder="Identifiant utilisateur du destinataire"
          value={targetUserId}
          onChange={(event) => setTargetUserId(event.target.value)}
        />

        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
          <button className="btn btn-primary" onClick={() => startCall('audio')}>
            Appel audio
          </button>
          <button className="btn btn-accent" onClick={() => startCall('video')}>
            Appel vidéo
          </button>
          <button className="btn" onClick={endCall}>
            Terminer
          </button>
        </div>
      </section>

      <section
        className="grid"
        style={{
          gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',
          marginTop:20
        }}
      >
        <article className="card" style={{padding:16}}>
          <h2>Moi</h2>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={{width:'100%',borderRadius:18,background:'#000'}}
          />
        </article>

        <article className="card" style={{padding:16}}>
          <h2>Correspondant</h2>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{width:'100%',borderRadius:18,background:'#000'}}
          />
        </article>
      </section>
    </main>
  );
}
