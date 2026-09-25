'use client';

import {
  PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState
} from 'react';
import { apiFetch } from '../../../lib/api';

type VoicePreset = 'ORIGINAL' | 'DEEP' | 'BRIGHT' | 'ROBOT';

type MediaAsset = {
  id: string;
  status: string;
  detectedMime: string;
};

type UploadSession = {
  id: string;
  uploadToken: string;
};

type VoiceDraft = {
  originalBlob: Blob;
  originalUrl: string;
  originalDuration: number;
  activeBlob: Blob;
  activeUrl: string;
  duration: number;
  preset: VoicePreset;
};

type VideoDraft = {
  blob: Blob;
  url: string;
  duration: number;
};

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const VIDEO_NOTE_MAX_SECONDS = 60;

function baseMime(value: string) {
  return value.toLowerCase().split(';')[0] ?? value.toLowerCase();
}

function preferredRecorder(stream: MediaStream, candidates: string[]) {
  const mimeType = candidates.find((candidate) =>
    typeof MediaRecorder.isTypeSupported !== 'function'
      ? false
      : MediaRecorder.isTypeSupported(candidate)
  );
  return mimeType
    ? new MediaRecorder(stream, { mimeType })
    : new MediaRecorder(stream);
}

function extensionForMime(mime: string) {
  if (mime === 'audio/wav') return 'wav';
  if (mime === 'audio/mp4') return 'm4a';
  if (mime === 'video/mp4') return 'mp4';
  return 'webm';
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function audioBufferToWav(buffer: AudioBuffer) {
  const channels = Math.min(buffer.numberOfChannels, 2);
  const frameCount = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataBytes = frameCount * blockAlign;
  const output = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(output);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  const channelData = Array.from(
    { length: channels },
    (_, channel) => buffer.getChannelData(channel)
  );
  let offset = 44;
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel]?.[frame] ?? 0));
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true
      );
      offset += 2;
    }
  }

  return new Blob([output], { type: 'audio/wav' });
}

async function transformVoice(
  blob: Blob,
  preset: Exclude<VoicePreset, 'ORIGINAL'>
) {
  const AudioContextClass =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('La transformation vocale n’est pas disponible sur ce navigateur.');
  }

  const decoder = new AudioContextClass();
  try {
    const sourceBuffer = await decoder.decodeAudioData(await blob.arrayBuffer());
    const rate = preset === 'DEEP' ? 0.82 : preset === 'BRIGHT' ? 1.18 : 1;
    const outputLength = Math.max(1, Math.ceil(sourceBuffer.length / rate));
    const offline = new OfflineAudioContext(
      Math.min(sourceBuffer.numberOfChannels, 2),
      outputLength,
      sourceBuffer.sampleRate
    );
    const source = offline.createBufferSource();
    source.buffer = sourceBuffer;
    source.playbackRate.value = rate;

    if (preset === 'ROBOT') {
      const band = offline.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 1050;
      band.Q.value = 1.25;
      const shaper = offline.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let index = 0; index < curve.length; index += 1) {
        const x = (index * 2) / (curve.length - 1) - 1;
        curve[index] = Math.tanh(4.2 * x);
      }
      shaper.curve = curve;
      shaper.oversample = '2x';
      source.connect(band);
      band.connect(shaper);
      shaper.connect(offline.destination);
    } else {
      const tone = offline.createBiquadFilter();
      if (preset === 'DEEP') {
        tone.type = 'lowpass';
        tone.frequency.value = 2200;
      } else {
        tone.type = 'highshelf';
        tone.frequency.value = 2100;
        tone.gain.value = 5;
      }
      source.connect(tone);
      tone.connect(offline.destination);
    }

    source.start();
    const rendered = await offline.startRendering();
    return {
      blob: audioBufferToWav(rendered),
      duration: rendered.duration
    };
  } finally {
    await decoder.close().catch(() => undefined);
  }
}

export function MessengerMediaComposer<T>({
  conversationId,
  onSent,
  disabled = false
}: {
  conversationId: string;
  onSent: (message: T) => void;
  disabled?: boolean;
}) {
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceChunksRef = useRef<BlobPart[]>([]);
  const voiceStartedAtRef = useRef(0);
  const voiceStopModeRef = useRef<'immediate' | 'draft' | 'discard'>('immediate');
  const voiceLockedRef = useRef(false);
  const voicePointerStartRef = useRef({ x: 0, y: 0 });

  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoChunksRef = useRef<BlobPart[]>([]);
  const videoStartedAtRef = useRef(0);
  const videoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceLocked, setVoiceLocked] = useState(false);
  const [voiceCancelArmed, setVoiceCancelArmed] = useState(false);
  const [voiceDraft, setVoiceDraft] = useState<VoiceDraft | null>(null);
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);

  const [videoRecording, setVideoRecording] = useState(false);
  const [videoDraft, setVideoDraft] = useState<VideoDraft | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [videoBusy, setVideoBusy] = useState(false);

  const [status, setStatus] = useState('');

  useEffect(() => {
    const preview = videoPreviewRef.current;
    const stream = videoStreamRef.current;
    if (!preview || !stream || !videoRecording) return;
    preview.srcObject = stream;
    void preview.play().catch(() => undefined);
  }, [videoRecording]);

  useEffect(() => {
    return () => {
      voiceRecorderRef.current?.state !== 'inactive' &&
        voiceRecorderRef.current?.stop();
      videoRecorderRef.current?.state !== 'inactive' &&
        videoRecorderRef.current?.stop();
      voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
      videoStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (videoTimerRef.current) clearTimeout(videoTimerRef.current);
    };
  }, []);

  async function uploadAndSend(
    kind: 'VOICE_NOTE' | 'VIDEO_NOTE',
    blob: Blob,
    durationSeconds: number,
    voicePreset?: VoicePreset
  ) {
    if (blob.size > MAX_UPLOAD_BYTES) {
      throw new Error('Ce média dépasse la limite de 25 Mo.');
    }
    const mime = baseMime(blob.type);
    if (!mime) throw new Error('Format média inconnu.');

    const session = await apiFetch<UploadSession>('/media/uploads', {
      method: 'POST',
      body: JSON.stringify({
        purpose: 'MESSAGE',
        visibility: 'CONVERSATION',
        conversationId,
        maxBytes: Math.min(
          MAX_UPLOAD_BYTES,
          Math.max(1024, blob.size + 1024)
        ),
        allowedMime: [mime]
      })
    });

    const form = new FormData();
    form.append(
      'file',
      blob,
      `${kind === 'VOICE_NOTE' ? 'voice' : 'video-note'}-${Date.now()}.${extensionForMime(mime)}`
    );
    const asset = await apiFetch<MediaAsset>(
      `/media/uploads/${session.id}/complete`,
      {
        method: 'POST',
        headers: { 'x-upload-token': session.uploadToken },
        body: form
      }
    );

    const created = await apiFetch<T>(
      `/conversations/${conversationId}/media-messages`,
      {
        method: 'POST',
        body: JSON.stringify({
          kind,
          assetId: asset.id,
          durationSeconds: Number(durationSeconds.toFixed(3)),
          ...(kind === 'VOICE_NOTE'
            ? { voicePreset: voicePreset ?? 'ORIGINAL' }
            : {})
        })
      }
    );
    onSent(created);
  }

  function cleanupVoiceStream() {
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
    voiceStreamRef.current = null;
    voiceRecorderRef.current = null;
    setVoiceRecording(false);
    setVoiceLocked(false);
    setVoiceCancelArmed(false);
    voiceLockedRef.current = false;
  }

  async function startVoice(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (
      disabled ||
      voiceRecording ||
      voiceDraft ||
      videoRecording ||
      videoDraft ||
      voiceBusy
    ) {
      return;
    }
    setStatus('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = preferredRecorder(stream, [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4'
      ]);
      voiceStreamRef.current = stream;
      voiceRecorderRef.current = recorder;
      voiceChunksRef.current = [];
      voiceStartedAtRef.current = Date.now();
      voiceStopModeRef.current = 'immediate';
      voiceLockedRef.current = false;
      voicePointerStartRef.current = {
        x: event.clientX,
        y: event.clientY
      };

      recorder.ondataavailable = (chunk) => {
        if (chunk.data.size) voiceChunksRef.current.push(chunk.data);
      };
      recorder.onstop = () => {
        const mode = voiceStopModeRef.current;
        const duration = Math.max(
          0.1,
          (Date.now() - voiceStartedAtRef.current) / 1000
        );
        const mime = baseMime(recorder.mimeType || 'audio/webm');
        const blob = new Blob(voiceChunksRef.current, { type: mime });
        cleanupVoiceStream();

        if (mode === 'discard' || !blob.size) {
          setStatus(mode === 'discard' ? 'Vocal annulé.' : '');
          return;
        }
        if (mode === 'immediate') {
          setVoiceBusy(true);
          setStatus('Envoi du vocal…');
          void uploadAndSend('VOICE_NOTE', blob, duration, 'ORIGINAL')
            .then(() => setStatus(''))
            .catch((cause) =>
              setStatus(cause instanceof Error ? cause.message : 'Envoi impossible.')
            )
            .finally(() => setVoiceBusy(false));
          return;
        }

        const url = URL.createObjectURL(blob);
        setVoiceDraft({
          originalBlob: blob,
          originalUrl: url,
          originalDuration: duration,
          activeBlob: blob,
          activeUrl: url,
          duration,
          preset: 'ORIGINAL'
        });
      };

      recorder.start(250);
      setVoiceRecording(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch (cause) {
      cleanupVoiceStream();
      setStatus(
        cause instanceof Error
          ? cause.message
          : 'Impossible d’accéder au microphone.'
      );
    }
  }

  function moveVoice(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!voiceRecording || voiceLockedRef.current) return;
    const deltaY = voicePointerStartRef.current.y - event.clientY;
    const deltaX = voicePointerStartRef.current.x - event.clientX;
    if (deltaY >= 72) {
      voiceLockedRef.current = true;
      setVoiceLocked(true);
      setVoiceCancelArmed(false);
      return;
    }
    setVoiceCancelArmed(deltaX >= 90);
  }

  function releaseVoice() {
    const recorder = voiceRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    if (voiceLockedRef.current) return;
    voiceStopModeRef.current = voiceCancelArmed ? 'discard' : 'immediate';
    recorder.stop();
  }

  function stopLockedVoice() {
    const recorder = voiceRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    voiceStopModeRef.current = 'draft';
    recorder.stop();
  }

  function clearVoiceDraft() {
    if (!voiceDraft) return;
    URL.revokeObjectURL(voiceDraft.originalUrl);
    if (voiceDraft.activeUrl !== voiceDraft.originalUrl) {
      URL.revokeObjectURL(voiceDraft.activeUrl);
    }
    setVoiceDraft(null);
    setVoicePanelOpen(false);
  }

  async function chooseVoice(preset: VoicePreset) {
    if (!voiceDraft || voiceBusy) return;
    setVoiceBusy(true);
    setStatus('');
    try {
      if (preset === 'ORIGINAL') {
        if (voiceDraft.activeUrl !== voiceDraft.originalUrl) {
          URL.revokeObjectURL(voiceDraft.activeUrl);
        }
        setVoiceDraft({
          ...voiceDraft,
          activeBlob: voiceDraft.originalBlob,
          activeUrl: voiceDraft.originalUrl,
          duration: voiceDraft.originalDuration,
          preset
        });
        return;
      }

      const transformed = await transformVoice(voiceDraft.originalBlob, preset);
      if (voiceDraft.activeUrl !== voiceDraft.originalUrl) {
        URL.revokeObjectURL(voiceDraft.activeUrl);
      }
      setVoiceDraft({
        ...voiceDraft,
        activeBlob: transformed.blob,
        activeUrl: URL.createObjectURL(transformed.blob),
        duration: transformed.duration,
        preset
      });
    } catch (cause) {
      setStatus(
        cause instanceof Error
          ? cause.message
          : 'Transformation vocale impossible.'
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
      await uploadAndSend(
        'VOICE_NOTE',
        voiceDraft.activeBlob,
        voiceDraft.duration,
        voiceDraft.preset
      );
      clearVoiceDraft();
      setStatus('');
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : 'Envoi impossible.');
    } finally {
      setVoiceBusy(false);
    }
  }

  function cleanupVideoStream() {
    videoStreamRef.current?.getTracks().forEach((track) => track.stop());
    videoStreamRef.current = null;
    videoRecorderRef.current = null;
    setVideoRecording(false);
    if (videoTimerRef.current) {
      clearTimeout(videoTimerRef.current);
      videoTimerRef.current = null;
    }
  }

  async function startVideoNote() {
    if (
      disabled ||
      videoRecording ||
      videoDraft ||
      voiceRecording ||
      voiceDraft ||
      videoBusy
    ) {
      return;
    }
    setStatus('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode }
      });
      const recorder = preferredRecorder(stream, [
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4'
      ]);
      videoStreamRef.current = stream;
      videoRecorderRef.current = recorder;
      videoChunksRef.current = [];
      videoStartedAtRef.current = Date.now();

      recorder.ondataavailable = (chunk) => {
        if (chunk.data.size) videoChunksRef.current.push(chunk.data);
      };
      recorder.onstop = () => {
        const duration = Math.min(
          VIDEO_NOTE_MAX_SECONDS,
          Math.max(0.1, (Date.now() - videoStartedAtRef.current) / 1000)
        );
        const mime = baseMime(recorder.mimeType || 'video/webm');
        const blob = new Blob(videoChunksRef.current, { type: mime });
        cleanupVideoStream();
        if (!blob.size) return;
        setVideoDraft({
          blob,
          url: URL.createObjectURL(blob),
          duration
        });
      };

      recorder.start(250);
      setVideoRecording(true);
      videoTimerRef.current = setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop();
      }, VIDEO_NOTE_MAX_SECONDS * 1000);
    } catch (cause) {
      cleanupVideoStream();
      setStatus(
        cause instanceof Error
          ? cause.message
          : 'Impossible d’accéder à la caméra.'
      );
    }
  }

  function stopVideoNote() {
    const recorder = videoRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }

  function clearVideoDraft() {
    if (!videoDraft) return;
    URL.revokeObjectURL(videoDraft.url);
    setVideoDraft(null);
  }

  async function sendVideoDraft() {
    if (!videoDraft || videoBusy) return;
    setVideoBusy(true);
    setStatus('Envoi de la note vidéo…');
    try {
      await uploadAndSend(
        'VIDEO_NOTE',
        videoDraft.blob,
        videoDraft.duration
      );
      clearVideoDraft();
      setStatus('');
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : 'Envoi impossible.');
    } finally {
      setVideoBusy(false);
    }
  }

  if (voiceDraft) {
    return (
      <div
        style={{
          flex: '1 1 100%',
          display: 'grid',
          gap: 10,
          padding: 10,
          borderRadius: 14,
          background: 'rgba(69,230,189,.06)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={clearVoiceDraft} disabled={voiceBusy}>
            Supprimer
          </button>
          <audio
            controls
            src={voiceDraft.activeUrl}
            style={{ flex: '1 1 220px', minWidth: 180 }}
          />
          <button
            type="button"
            className="btn"
            onClick={() => setVoicePanelOpen((value) => !value)}
            disabled={voiceBusy}
          >
            Voix · {
              voiceDraft.preset === 'DEEP'
                ? 'Grave'
                : voiceDraft.preset === 'BRIGHT'
                  ? 'Claire'
                  : voiceDraft.preset === 'ROBOT'
                    ? 'Robot'
                    : 'Originale'
            }
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void sendVoiceDraft()}
            disabled={voiceBusy}
          >
            {voiceBusy ? 'Traitement…' : 'Envoyer'}
          </button>
        </div>

        {voicePanelOpen ? (
          <div
            aria-label="Choisir une voix"
            style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
          >
            {([
              ['ORIGINAL', 'Originale'],
              ['DEEP', 'Grave'],
              ['BRIGHT', 'Claire'],
              ['ROBOT', 'Robot']
            ] as Array<[VoicePreset, string]>).map(([preset, label]) => (
              <button
                key={preset}
                type="button"
                className={voiceDraft.preset === preset ? 'btn btn-primary' : 'btn'}
                onClick={() => void chooseVoice(preset)}
                disabled={voiceBusy}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
        {status ? <small style={{ color: 'var(--orange)' }}>{status}</small> : null}
      </div>
    );
  }

  if (videoRecording) {
    return (
      <div
        style={{
          flex: '1 1 100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap'
        }}
      >
        <video
          ref={videoPreviewRef}
          muted
          playsInline
          style={{
            width: 124,
            height: 124,
            objectFit: 'cover',
            borderRadius: '50%',
            background: '#050807'
          }}
        />
        <strong style={{ color: 'var(--mint)' }}>Note vidéo en cours…</strong>
        <button type="button" className="btn btn-primary" onClick={stopVideoNote}>
          Arrêter
        </button>
      </div>
    );
  }

  if (videoDraft) {
    return (
      <div
        style={{
          flex: '1 1 100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap'
        }}
      >
        <video
          src={videoDraft.url}
          controls
          playsInline
          style={{
            width: 150,
            height: 150,
            objectFit: 'cover',
            borderRadius: '50%',
            background: '#050807'
          }}
        />
        <button type="button" className="btn" onClick={clearVideoDraft} disabled={videoBusy}>
          Refaire
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void sendVideoDraft()}
          disabled={videoBusy}
        >
          {videoBusy ? 'Envoi…' : 'Envoyer la note vidéo'}
        </button>
        {status ? <small style={{ color: 'var(--orange)' }}>{status}</small> : null}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="btn"
        aria-label="Maintenir pour enregistrer un vocal"
        title="Maintiens pour parler. Glisse vers le haut pour verrouiller, vers la gauche pour annuler."
        disabled={disabled || voiceBusy || videoBusy}
        onPointerDown={(event) => void startVoice(event)}
        onPointerMove={moveVoice}
        onPointerUp={releaseVoice}
        onPointerCancel={releaseVoice}
        style={{
          touchAction: 'none',
          borderColor: voiceRecording
            ? voiceCancelArmed
              ? 'var(--orange)'
              : 'var(--mint)'
            : undefined
        }}
      >
        {voiceRecording
          ? voiceLocked
            ? 'Vocal verrouillé'
            : voiceCancelArmed
              ? 'Relâcher pour annuler'
              : 'Parle… ↑ verrouiller · ← annuler'
          : 'Micro'}
      </button>

      {voiceRecording && voiceLocked ? (
        <button type="button" className="btn btn-primary" onClick={stopLockedVoice}>
          Arrêter
        </button>
      ) : null}

      <button
        type="button"
        className="btn"
        disabled={disabled || voiceRecording || voiceBusy || videoBusy}
        onClick={() => void startVideoNote()}
      >
        Note vidéo
      </button>
      <button
        type="button"
        className="btn"
        disabled={disabled || videoRecording}
        onClick={() =>
          setFacingMode((value) => value === 'user' ? 'environment' : 'user')
        }
        title="Changer la caméra utilisée pour la prochaine note vidéo"
      >
        Caméra {facingMode === 'user' ? 'avant' : 'arrière'}
      </button>

      {status ? (
        <small
          role="status"
          style={{
            flexBasis: '100%',
            color: status.includes('impossible') || status.includes('dépasse')
              ? 'var(--orange)'
              : 'var(--muted)'
          }}
        >
          {status}
        </small>
      ) : null}
    </>
  );
}
