'use client';

import { useId, useState } from 'react';
import { findKnowMeCustomEmoji, type KnowMeCustomEmojiKey } from '@knowme/animation-contract';

/**
 * First-party KnowMe Motion artwork. Paths, palettes and motion belong to
 * KnowMe; no Telegram illustrations or remotely loaded assets are used.
 */
function Artwork({ kind }: { kind: KnowMeCustomEmojiKey }) {
  const id = useId().replace(/:/g, '_');
  const gradient = `km_art_${id}`;
  const halo = `km_halo_${id}`;
  return <svg viewBox="0 0 80 80" aria-hidden="true" focusable="false"
    width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor={kind === 'pulse-heart' ? '#FF789E' :
          kind === 'neon-flame' ? '#FFCF77' :
          kind === 'galaxy-smile' ? '#FFE298' : '#9BFCE2'}/>
        <stop offset=".53" stopColor={kind === 'pulse-heart' ? '#F94494' :
          kind === 'neon-flame' ? '#FF6B73' :
          kind === 'galaxy-smile' ? '#B8A0FF' : '#4FC6F4'}/>
        <stop offset="1" stopColor="#9878EF"/>
      </linearGradient>
      <radialGradient id={halo}>
        <stop stopColor="#68EFD7" stopOpacity=".36"/>
        <stop offset="1" stopColor="#68EFD7" stopOpacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="40" cy="40" r="39" fill={`url(#${halo})`}/>
    {kind === 'pulse-heart' && <>
      <path d="M40 67C29 59 10 43 10 27c0-10 7-17 17-17 6 0 10 3 13 8 3-5 8-8 14-8 10 0 17 8 17 18 0 15-19 31-31 39Z"
        fill={`url(#${gradient})`} stroke="#FFE5F2" strokeWidth="2.2" strokeLinejoin="round"/>
      <path d="M20 24c2-5 5-7 10-7" fill="none" stroke="#FFF" strokeOpacity=".7" strokeWidth="3" strokeLinecap="round"/>
      <path d="M10 7v10M5 12h10M68 55v12M62 61h12" stroke="#B7FFE9" strokeWidth="2" strokeLinecap="round"/>
    </>}
    {kind === 'prism-star' && <>
      <path d="M40 6 49 27 71 29 54 44 60 66 40 54 20 66 26 44 9 29 31 27Z"
        fill={`url(#${gradient})`} stroke="#E8FFF9" strokeWidth="2.2" strokeLinejoin="round"/>
      <path d="M40 14 45 32 62 33 49 43 53 56 40 48 27 56 31 43 18 33 35 32Z"
        fill="#FFF" fillOpacity=".15"/>
      <path d="M9 9v10M4 14h10M69 59v10M64 64h10" stroke="#E7A9FF" strokeWidth="2.5" strokeLinecap="round"/>
    </>}
    {kind === 'orbit-spark' && <>
      <ellipse cx="40" cy="40" rx="34" ry="15" transform="rotate(-30 40 40)"
        fill="none" stroke="#84E8E5" strokeWidth="2.8" opacity=".9"/>
      <ellipse cx="40" cy="40" rx="34" ry="15" transform="rotate(55 40 40)"
        fill="none" stroke="#AE9FFF" strokeWidth="2.8" opacity=".8"/>
      <path d="M40 14 46 34 65 40 46 46 40 66 34 46 15 40 34 34Z"
        fill={`url(#${gradient})`} stroke="#DFFFF8" strokeWidth="2"/>
      <circle cx="68" cy="26" r="5" fill="#FDC7FF"/>
      <circle cx="12" cy="55" r="3" fill="#C8FF95"/>
    </>}
    {kind === 'galaxy-smile' && <>
      <circle cx="40" cy="40" r="30" fill={`url(#${gradient})`}
        stroke="#EEFFFF" strokeWidth="2.5"/>
      <ellipse cx="28.5" cy="35" rx="4" ry="5" fill="#344261"/>
      <ellipse cx="51.5" cy="35" rx="4" ry="5" fill="#344261"/>
      <path d="M24 47q16 20 32 0" fill="none" stroke="#344261" strokeWidth="4.2"
        strokeLinecap="round"/>
      <circle cx="17" cy="43" r="6" fill="#FF85B3" fillOpacity=".68"/>
      <circle cx="63" cy="43" r="6" fill="#FF85B3" fillOpacity=".68"/>
      <path d="M17 9v9M12.5 13.5h9" stroke="#FDF7C0" strokeWidth="2.4" strokeLinecap="round"/>
    </>}
    {kind === 'neon-flame' && <>
      <path d="M41 8c4 15-5 22-1 30 5-3 10-10 10-16 11 12 19 23 17 35-2 15-14 22-27 22C23 79 12 68 12 54c0-11 9-21 17-30-1 12 4 15 7 15 5-9-1-22 5-31Z"
        fill={`url(#${gradient})`} stroke="#FFE9CE" strokeWidth="2.2"/>
      <path d="M41 43c1 7-9 11-9 20 0 6 4 10 9 10 7 0 12-6 10-13-1-6-7-11-10-17Z"
        fill="#FFECCA"/>
    </>}
    {kind === 'comet-rocket' && <>
      <path d="M16 65 5 74 11 54M22 66 13 75 17 57" fill="none"
        stroke="#FF9A79" strokeWidth="4.5" strokeLinecap="round"/>
      <g transform="rotate(34 41 39)">
        <path d="M40 5c12 10 18 23 18 39H22C22 28 29 15 40 5Z"
          fill={`url(#${gradient})`} stroke="#E9FFFC" strokeWidth="2.2"/>
        <path d="M22 35 12 53l11-4M58 35l10 18-11-4"
          fill="#B18AFF" stroke="#E8DEFF" strokeWidth="2"/>
        <circle cx="40" cy="33" r="9" fill="#3B6B9C" stroke="#D7FFFF" strokeWidth="3"/>
        <circle cx="40" cy="33" r="4" fill="#9FFFF0"/>
        <path d="M30 46h20v11H30Z" fill="#DEE3FF"/>
        <path d="M35 58 40 74l5-16Z" fill="#FFC470" stroke="#FFE4AE" strokeWidth="2"/>
      </g>
    </>}
  </svg>;
}

export function KnowMeCustomEmoji({
  packKey, stickerKey, size = 64, interactive = false
}: { packKey: string; stickerKey: string; size?: number; interactive?: boolean }) {
  const item = findKnowMeCustomEmoji(packKey, stickerKey);
  const [replay, setReplay] = useState(0);
  if (!item) return null;
  const content = <span className={`km-custom-emoji km-emoji-motion-${item.motion}`}
    key={replay} style={{ width: size, height: size }} role="img" aria-label={item.label}>
    <Artwork kind={item.key}/>
  </span>;
  if (!interactive) return content;
  return <button type="button" className="km-custom-emoji-button"
    title={`Relancer : ${item.label}`} aria-label={`Animer ${item.label}`}
    onClick={() => setReplay(value => value + 1)}>{content}</button>;
}
