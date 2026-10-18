'use client';

import { useEffect, useRef, useState } from 'react';

function showTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h
    ? [h,String(m).padStart(2,'0'),String(s).padStart(2,'0')].join(':')
    : [m,String(s).padStart(2,'0')].join(':');
}

/**
 * A single mounted Reel at a time. An inactive clip has no video element,
 * so neighboring clips cannot play audio or download their full bodies.
 */
export function ReelPlayback({ src, onDoubleTap, en }: {
  src: string; onDoubleTap: () => void; en: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef(0);
  const [playing,setPlaying] = useState(false);
  const [muted,setMuted] = useState(true);
  const [position,setPosition] = useState(0);
  const [duration,setDuration] = useState(0);
  const [speed,setSpeed] = useState(1);
  const [error,setError] = useState('');
  const [heart,setHeart] = useState(false);
  const heartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const video=videoRef.current;
    if (!video) return;
    video.muted = true;
    video.play().catch(() => setPlaying(false));
    return () => {
      video.pause();
      if (clickTimer.current) clearTimeout(clickTimer.current);
      if (heartTimer.current) clearTimeout(heartTimer.current);
    };
  }, [src]);

  async function toggle() {
    const video = videoRef.current;
    if (!video) return;
    setError('');
    if (!video.paused) {
      video.pause();
      return;
    }
    try { await video.play(); }
    catch { setError(en ? 'Playback unavailable.' : 'Lecture indisponible.'); }
  }

  function onTap() {
    const now=Date.now();
    if (now-lastTap.current<330) {
      if (clickTimer.current) clearTimeout(clickTimer.current);
      clickTimer.current=null;
      lastTap.current=0;
      onDoubleTap();
      setHeart(true);
      if (heartTimer.current) clearTimeout(heartTimer.current);
      heartTimer.current=setTimeout(()=>setHeart(false),600);
    } else {
      lastTap.current=now;
      if (clickTimer.current) clearTimeout(clickTimer.current);
      clickTimer.current=setTimeout(()=>{void toggle(); clickTimer.current=null;},330);
    }
  }

  function seek(value: number) {
    const video=videoRef.current;
    if (!video||!Number.isFinite(value)||duration<=0) return;
    const clamped=Math.max(0,Math.min(duration,value));
    video.currentTime=clamped;
    setPosition(clamped);
  }
  function skip(delta:number){seek(position+delta);}

  function switchMute(){
    const video=videoRef.current;
    if(!video) return;
    video.muted=!video.muted;
    setMuted(video.muted);
  }

  function switchSpeed() {
    const rates=[1,1.25,1.5,2];
    const next=rates[(rates.indexOf(speed)+1)%rates.length]!;
    if(videoRef.current)videoRef.current.playbackRate=next;
    setSpeed(next);
  }

  return (
    <div className="km-reel-playback">
      <video ref={videoRef} className="km-reel-video" src={src} preload="metadata"
        playsInline muted loop
        onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)}
        onTimeUpdate={event=>setPosition(event.currentTarget.currentTime||0)}
        onLoadedMetadata={event=>{
          const next=event.currentTarget.duration;
          setDuration(Number.isFinite(next)?next:0);
        }}
        onDurationChange={event=>{
          const next=event.currentTarget.duration;
          setDuration(Number.isFinite(next)?next:0);
        }}
        onError={()=>setError(en?'Video unavailable.':'Vidéo indisponible.')}
        aria-label={en?'KnowMe reel':'Reel KnowMe'}/>
      <button className="km-reel-tap-zone" type="button" onClick={onTap}
        aria-label={playing?(en?'Pause reel':'Mettre le Reel en pause')
          :(en?'Play reel':'Lire le Reel')}>
        {!playing&&<span className="km-reel-pause-symbol" aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 4.5v15l11-7.5z"/>
          </svg>
        </span>}
        {heart&&<span className="km-reel-heart" aria-hidden="true">
          <svg width="88" height="88" viewBox="0 0 24 24" fill="#fff" stroke="#fff"
            strokeWidth="1.3"><path d="M20.8 4.6a5.4 5.4 0 0 0-7.7 0L12 5.7l-1.1-1.1a5.4 5.4 0 0 0-7.7 7.7L12 21l8.8-8.7a5.4 5.4 0 0 0 0-7.7Z"/></svg>
        </span>}
      </button>
      <div className="km-reel-player-controls">
        <div className="km-reel-player-progress">
          <input type="range" min={0} max={duration||1} step={0.1}
            value={Math.min(position,duration||1)} disabled={!duration}
            onChange={event=>seek(Number(event.target.value))}
            aria-label={en?'Video progress':'Position dans la vidéo'}/>
          <span>{showTime(position)} / {showTime(duration)}</span>
        </div>
        <div className="km-reel-player-buttons">
          <button type="button" onClick={()=>void toggle()}
            aria-label={playing?(en?'Pause':'Pause'):(en?'Play':'Lecture')}>
            {playing?'Ⅱ':'▶'}
          </button>
          <button type="button" onClick={()=>skip(-10)}
            aria-label={en?'Back 10 seconds':'Reculer de 10 secondes'}>↶10</button>
          <button type="button" onClick={()=>skip(10)}
            aria-label={en?'Forward 10 seconds':'Avancer de 10 secondes'}>10↷</button>
          <button type="button" onClick={switchMute}
            aria-label={muted?(en?'Enable sound':'Activer le son'):(en?'Mute':'Couper le son')}>
            {muted
              ? <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 3 0 5-4v14l-5-4H3zM16 9l5 6m0-6-5 6"/></svg>
              : <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 3 0 5-4v14l-5-4H3zM15 9c2 2 2 4 0 6m3-9c4 4 4 8 0 12"/></svg>}
          </button>
          <button type="button" onClick={switchSpeed}
            aria-label={en?'Playback speed':'Vitesse de lecture'}>{speed}×</button>
        </div>
        {error&&<span role="alert" className="km-reel-player-error">{error}</span>}
      </div>
    </div>
  );
}
