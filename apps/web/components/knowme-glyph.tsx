import type { ReactNode, SVGProps } from 'react';

/**
 * KnowMe vector family: original 24px glyphs with consistent 1.9px strokes.
 * Inspired by compact Telegram-like touch ergonomics, not copied assets.
 * Decorative only: put accessible names on the containing control.
 */
export type KnowMeGlyphName =
  | 'home' | 'discover' | 'create' | 'notifications' | 'chats' | 'profile'
  | 'back' | 'forward' | 'close' | 'menu' | 'more' | 'search' | 'refresh'
  | 'send' | 'attach' | 'camera' | 'image' | 'microphone' | 'play' | 'pause'
  | 'download' | 'check' | 'check-double' | 'heart' | 'comment' | 'share'
  | 'bookmark' | 'smile' | 'sticker' | 'keyboard' | 'settings' | 'phone'
  | 'video' | 'lock' | 'trash' | 'edit' | 'link' | 'eye' | 'eye-off'
  | 'story' | 'cover' | 'sparkles' | 'upload';

type Props = Omit<SVGProps<SVGSVGElement>, 'name'> & {
  name: KnowMeGlyphName;
  size?: number;
  active?: boolean;
};

export function KnowMeGlyph({ name, size = 22, active = false, ...props }: Props) {
  const shared = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
    'aria-hidden': true as const,
    focusable: false as const,
    'data-knowme-icon': name
  };

  const shapes: Record<KnowMeGlyphName, ReactNode> = {
    story: <><circle cx="12" cy="12" r="9" strokeDasharray="3 2"/><path d="M12 7.8v8.4M7.8 12h8.4"/></>,
    cover: <><rect x="2.5" y="5.3" width="19" height="13.4" rx="2.5"/><path d="m3.3 16 5.6-5.1 3.9 3.6 3-2.65 5 4.65"/></>,
    sparkles: <><path d="m12 2.4 2.1 6.3 6.3 2.1-6.3 2.1L12 19.2l-2.1-6.3-6.3-2.1 6.3-2.1L12 2.4ZM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8L19 17Z"/></>,
    upload: <><path d="M12 15V3.5M7.6 7.9 12 3.5l4.4 4.4M4 14.3v5.4a1.8 1.8 0 0 0 1.8 1.8h12.4a1.8 1.8 0 0 0 1.8-1.8v-5.4"/></>,
    home: <><path d="M3 10.25 12 3l9 7.25V19a2 2 0 0 1-2 2h-4.5v-7h-5v7H5a2 2 0 0 1-2-2v-8.75Z" fill={active ? 'currentColor' : 'none'}/>{active && <path d="M9.5 21v-7h5v7" stroke="var(--bg)"/>}</>,
    discover: <><circle cx="9" cy="8.6" r="3.35"/><path d="M2.6 20c.25-3.8 2.65-6 6.4-6 2.3 0 4.05.8 5.1 2.45"/><circle cx="17.85" cy="8.4" r="2.65"/><path d="M16.8 14.8c2.8-.2 4.5 1.5 4.6 4.9"/></>,
    create: <><circle cx="12" cy="12" r="9"/><path d="M12 7.5v9M7.5 12h9"/></>,
    notifications: <><path d="M18.2 8.9a6.2 6.2 0 0 0-12.4 0c0 5.2-2.1 6.1-2.1 8.2h16.6c0-2.1-2.1-3-2.1-8.2Z" fill={active?'currentColor':'none'}/><path d="M9.6 20.4a2.65 2.65 0 0 0 4.8 0"/></>,
    chats: <><path d="M20.65 11.4c0 5-3.83 8.55-8.85 8.55-1.47 0-2.83-.3-4.03-.86l-4.64 1.48 1.46-4.3a8.55 8.55 0 1 1 16.06-4.87Z" fill={active?'currentColor':'none'}/><path d="M7.6 10.7h8.8M7.6 14.1h6.2" stroke={active?'var(--bg)':'currentColor'}/></>,
    profile: <><circle cx="12" cy="8.15" r="3.8" fill={active?'currentColor':'none'}/><path d="M4.3 20.4c.48-3.84 3.15-6.1 7.7-6.1s7.22 2.26 7.7 6.1" fill={active?'currentColor':'none'}/></>,
    back: <><path d="m14.6 5.2-6.9 6.8 6.9 6.8"/></>,
    forward: <><path d="m9.4 5.2 6.9 6.8-6.9 6.8"/></>,
    close: <><path d="M5.5 5.5 18.5 18.5M18.5 5.5 5.5 18.5"/></>,
    menu: <><path d="M4.2 6.5h15.6M4.2 12h15.6M4.2 17.5h15.6"/></>,
    more: <><circle cx="12" cy="5.3" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="18.7" r="1" fill="currentColor" stroke="none"/></>,
    search: <><circle cx="10.65" cy="10.65" r="7.05"/><path d="m16 16 4.9 4.9"/></>,
    refresh: <><path d="M20 7.5V3.8h-3.7M4 16.5v3.7h3.7M5.2 9a7.3 7.3 0 0 1 12.85-2.15L20 7.5M4 16.5l1.95.65A7.3 7.3 0 0 0 18.8 15"/></>,
    send: <><path d="M21 3 3.6 10.2l7.1 2.8L13.5 20 21 3Z"/><path d="m10.7 13 10.1-9.6"/></>,
    attach: <><path d="m8 12.5 7.9-7.9a4.15 4.15 0 0 1 5.87 5.87l-10 10a6 6 0 0 1-8.5-8.5l9.25-9.25"/><path d="m8.3 16.7 8.5-8.5"/></>,
    camera: <><rect x="2.8" y="6" width="18.4" height="14" rx="2.7"/><path d="M7.3 6 8.6 4h6.8l1.3 2"/><circle cx="12" cy="13" r="3.2"/></>,
    image: <><rect x="2.8" y="3.8" width="18.4" height="16.4" rx="2.6"/><circle cx="8.5" cy="8.6" r="1.65"/><path d="m3.3 17.5 5.35-5.35 4 3.9 3-2.9 5.1 4.65"/></>,
    microphone: <><rect x="9" y="2.7" width="6" height="12.2" rx="3"/><path d="M5.9 10.7a6.1 6.1 0 0 0 12.2 0M12 16.8v4.6M8.3 21.4h7.4"/></>,
    play: <><path d="m8.5 5.3 10.7 6.7-10.7 6.7V5.3Z" fill="currentColor" stroke="none"/></>,
    pause: <><rect x="6.4" y="4.5" width="4.1" height="15" rx="1.1" fill="currentColor" stroke="none"/><rect x="13.5" y="4.5" width="4.1" height="15" rx="1.1" fill="currentColor" stroke="none"/></>,
    download: <><path d="M12 3.7v11.1m-4.4-4.4 4.4 4.4 4.4-4.4M4 16.8v3.4h16v-3.4"/></>,
    check: <><path d="m4.3 12.4 5.2 5.1L19.7 6.7"/></>,
    'check-double': <><path d="m2.8 12.2 5.2 5 9.7-10.1M11 16.8l2.4 1.9L21.2 10"/></>,
    heart: <><path d="M20.6 5.8a5.1 5.1 0 0 0-7.2 0L12 7.2l-1.4-1.4a5.1 5.1 0 1 0-7.2 7.2L12 21l8.6-8a5.1 5.1 0 0 0 0-7.2Z" fill={active?'currentColor':'none'}/></>,
    comment: <><path d="M20.5 11.8a8.5 8.5 0 0 1-8.7 8.4c-1.2 0-2.3-.2-3.35-.65L3.2 21l1.3-4.65a8.6 8.6 0 1 1 16-4.55Z"/></>,
    share: <><path d="M14 4.5 20.5 11 14 17.5V13C8.7 13 5.8 15 3.5 19.5c.2-7.5 3.65-11 10.5-11V4.5Z"/></>,
    bookmark: <><path d="M6.2 3.6h11.6a1 1 0 0 1 1 1v16.1l-6.8-4.5-6.8 4.5V4.6a1 1 0 0 1 1-1Z" fill={active?'currentColor':'none'}/></>,
    smile: <><circle cx="12" cy="12" r="9.1"/><circle cx="8.5" cy="10" r="1.05" fill="currentColor" stroke="none"/><circle cx="15.5" cy="10" r="1.05" fill="currentColor" stroke="none"/><path d="M7.7 14.2a4.9 4.9 0 0 0 8.6 0"/></>,
    sticker: <><path d="M5.8 3h8.8L21 9.4v8.3a3.3 3.3 0 0 1-3.3 3.3H6.3A3.3 3.3 0 0 1 3 17.7V5.8A2.8 2.8 0 0 1 5.8 3Z"/><path d="M14.6 3v6.4H21M7.9 13.1h.15m5.85 0h.15M8 16.2c1.3 1.35 4.6 1.35 6 0"/></>,
    keyboard: <><rect x="2.5" y="5.5" width="19" height="13.3" rx="2.3"/><path d="M6.5 9h.5m3 0h.5m3 0h.5m3 0h.5M6.5 12h.5m3 0h.5m3 0h.5m3 0h.5M8 15.3h8"/></>,
    settings: <><path d="m9.65 2.7-.55 2-1.9.9-1.85-.83-2 3.36 1.55 1.32v2.15L3.35 13l2 3.36 1.85-.83 1.9.9.55 2.07h4.7l.55-2.07 1.9-.9 1.85.83 2-3.36-1.55-1.4V9.45l1.55-1.32-2-3.36-1.85.83-1.9-.9-.55-2H9.65Z"/><circle cx="12" cy="10.6" r="2.75"/></>,
    phone: <><path d="M7.4 3.3c-.85-.6-1.95-.4-2.5.5L3.2 6.5c-.7 1.1-.15 3 1.25 5.45a21 21 0 0 0 7.6 7.6c2.4 1.4 4.3 1.95 5.4 1.25l2.75-1.7c.9-.55 1.1-1.65.5-2.5l-2-2.75a1.75 1.75 0 0 0-2.4-.5l-1.6 1.05a15 15 0 0 1-5.5-5.5l1.05-1.6a1.75 1.75 0 0 0-.5-2.4L7.4 3.3Z"/></>,
    video: <><rect x="2.7" y="5" width="13.7" height="14" rx="2.4"/><path d="m16.4 9.2 4.9-2.5v10.6l-4.9-2.5"/></>,
    lock: <><rect x="4.6" y="10.5" width="14.8" height="10.6" rx="2.5"/><path d="M7.6 10.5V7a4.4 4.4 0 0 1 8.8 0v3.5M12 15v2.1"/></>,
    trash: <><path d="M4.7 6.5h14.6M9 6.5V4h6v2.5m-9.3 0 1 14.4h10.6l1-14.4M10 10.4v6.8M14 10.4v6.8"/></>,
    edit: <><path d="M4.2 16.6 15.95 4.85a2.2 2.2 0 0 1 3.1 3.1L7.3 19.7l-4.3 1.2 1.2-4.3ZM14.5 6.3l3.1 3.1"/></>,
    link: <><path d="m10.1 13.8 3.8-3.8m-5 6.5-1.2 1.2a4 4 0 0 1-5.6-5.6l4-4a4 4 0 0 1 5.6 0m.6-1.6 1.2-1.2a4 4 0 0 1 5.6 5.6l-4 4a4 4 0 0 1-5.6 0"/></>,
    eye: <><path d="M2 12s3.8-6.3 10-6.3S22 12 22 12s-3.8 6.3-10 6.3S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
    'eye-off': <><path d="m3.3 3.3 17.4 17.4M5.3 7.7C3.3 9.4 2 12 2 12s3.8 6.3 10 6.3c1.5 0 2.8-.35 4-.9M9.6 5.9c.75-.15 1.55-.2 2.4-.2 6.2 0 10 6.3 10 6.3s-.85 1.5-2.25 3"/></>
  };
  return <svg {...shared} {...props}>{shapes[name]}</svg>;
}
