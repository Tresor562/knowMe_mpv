'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

type AvatarQuickActionsProps = {
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  locale: 'fr' | 'en';
  onSelectPhoto: () => void;
  onSelectCover: () => void;
  busy?: boolean;
};

/** Native-style anchored actions for the current account, not a fake context menu. */
export function AvatarQuickActions({
  username, displayName, avatarUrl, locale, onSelectPhoto, onSelectCover, busy
}: AvatarQuickActionsProps) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const en = locale === 'en';
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
    };
    window.addEventListener('pointerdown', closeOutside);
    window.addEventListener('keydown', closeEscape);
    return () => {
      window.removeEventListener('pointerdown', closeOutside);
      window.removeEventListener('keydown', closeEscape);
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
        onClick={() => setOpen(value => !value)} disabled={busy}>
        <svg viewBox="0 0 24 24" width="19" height="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
      </button>
      {open && <div className="km-avatar-menu" role="menu" aria-label={en ? 'Profile options' : 'Options du profil'}>
        <Link href="/stories/new" role="menuitem" onClick={() => setOpen(false)}>
          <span aria-hidden="true">◎</span>{en ? 'Add a story' : 'Ajouter une story'}
        </Link>
        <button type="button" role="menuitem" onClick={() => act(() => setPreview(true))} disabled={!avatarUrl}>
          <span aria-hidden="true">◉</span>{en ? 'View profile picture' : 'Voir la photo de profil'}
        </button>
        <button type="button" role="menuitem" onClick={() => act(onSelectPhoto)}>
          <span aria-hidden="true">↥</span>{en ? 'Change picture' : 'Changer la photo'}
        </button>
        <button type="button" role="menuitem" onClick={() => act(onSelectCover)}>
          <span aria-hidden="true">▧</span>{en ? 'Change cover' : 'Changer la couverture'}
        </button>
        <Link role="menuitem" href="/profile-studio" onClick={() => setOpen(false)}>
          <span aria-hidden="true">✧</span>{en ? 'Edit profile design' : 'Personnaliser le profil'}
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
