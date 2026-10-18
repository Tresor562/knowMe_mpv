'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { KnowMeGlyph } from './knowme-glyph';
import { KnowMeAnimatedIcon } from './knowme-animated-icon';

type AvatarQuickActionsProps = {
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  locale: 'fr' | 'en';
  onSelectPhoto: () => void;
  onSelectCover: () => void;
  busy?: boolean;
};

type GlyphName = 'story' | 'view' | 'photo' | 'cover' | 'design';

function ActionIcon({name}:{name:GlyphName}) {
  const icon = { story: 'story', view: 'eye', photo: 'image', cover: 'cover', design: 'sparkles' } as const;
  return <KnowMeGlyph name={icon[name]} size={21}/>;
}

/** Native-style anchored actions for the current account, not a fake context menu. */
export function AvatarQuickActions({
  username, displayName, avatarUrl, locale, onSelectPhoto, onSelectCover, busy
}: AvatarQuickActionsProps) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const en = locale === 'en';
  const placeMenu = () => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(270, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const menuHeight = 290;
    const top = Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - menuHeight - 12));
    setMenuPosition({ top, left });
  };
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
    };
    placeMenu();
    window.addEventListener('pointerdown', closeOutside);
    window.addEventListener('keydown', closeEscape);
    window.addEventListener('resize', placeMenu);
    window.addEventListener('scroll', placeMenu, true);
    return () => {
      window.removeEventListener('pointerdown', closeOutside);
      window.removeEventListener('keydown', closeEscape);
      window.removeEventListener('resize', placeMenu);
      window.removeEventListener('scroll', placeMenu, true);
    };
  }, [open]);

  useEffect(() => {
    if (!preview) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setPreview(false); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [preview]);

  const act = (operation: () => void) => { setOpen(false); operation(); };
  return (
    <div className="km-avatar-actions" ref={wrap}>
      <button ref={trigger} className="km-avatar-plus" type="button" aria-haspopup="menu"
        aria-expanded={open} aria-label={en ? 'Profile photo actions' : 'Actions de la photo de profil'}
        onClick={() => { placeMenu(); setOpen(value => !value); }} disabled={busy}>
        <KnowMeAnimatedIcon name="create" size={19} state={open ? "open" : "closed"} />
      </button>
      {open && <div ref={menuRef} style={{ top: menuPosition.top, left: menuPosition.left }} className="km-avatar-menu" role="menu" aria-label={en ? 'Profile options' : 'Options du profil'}>
        <Link href="/stories/new" role="menuitem" onClick={() => setOpen(false)}>
          <ActionIcon name="story" />{en ? 'Add a story' : 'Ajouter une story'}
        </Link>
        <button type="button" role="menuitem" onClick={() => act(() => setPreview(true))} disabled={!avatarUrl}>
          <ActionIcon name="view" />{en ? 'View profile picture' : 'Voir la photo de profil'}
        </button>
        <button type="button" role="menuitem" onClick={() => act(onSelectPhoto)}>
          <ActionIcon name="photo" />{en ? 'Change picture' : 'Changer la photo'}
        </button>
        <button type="button" role="menuitem" onClick={() => act(onSelectCover)}>
          <ActionIcon name="cover" />{en ? 'Change cover' : 'Changer la couverture'}
        </button>
        <Link role="menuitem" href="/profile-studio" onClick={() => setOpen(false)}>
          <ActionIcon name="design" />{en ? 'Edit profile design' : 'Personnaliser le profil'}
        </Link>
      </div>}
      {preview && avatarUrl && <div className="km-avatar-lightbox" role="dialog" aria-modal="true"
        aria-label={en ? 'Profile picture' : 'Photo de profil'} onClick={() => setPreview(false)}>
        <button type="button" className="km-avatar-lightbox-close" onClick={() => setPreview(false)} aria-label={en ? 'Close' : 'Fermer'}>×</button>
        <img src={avatarUrl} alt={displayName} onClick={event => event.stopPropagation()} />
        <p>@{username}</p>
      </div>}
    </div>
  );
}
