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

type GlyphName = 'story' | 'view' | 'photo' | 'cover' | 'design';

function ActionIcon({name}:{name:GlyphName}) {
  const base = {viewBox:'0 0 24 24',width:21,height:21,fill:'none',stroke:'currentColor',
    strokeWidth:1.8,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,'aria-hidden':true as const};
  if(name==='story') return <svg {...base}><circle cx="12" cy="12" r="9" strokeDasharray="4 2"/><path d="M12 8v8m-4-4h8"/></svg>;
  if(name==='view') return <svg {...base}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>;
  if(name==='photo') return <svg {...base}><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="9" r="1.3"/><path d="m4 17 5-5 3 3 3-3 5 5"/></svg>;
  if(name==='cover') return <svg {...base}><rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="m3 16 6-6 4 4 3-3 5 5"/></svg>;
  return <svg {...base}><path d="M12 3l1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9L12 3Z"/><path d="m19 17 1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/></svg>;
}

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
