'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactElement } from 'react';
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
  const previewClose = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const en = locale === 'en';
  const placeMenu = () => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(270, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const menuHeight = menuRef.current?.offsetHeight ?? 290;
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const top = spaceBelow >= menuHeight || rect.top < menuHeight + 16
      ? Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - menuHeight - 12))
      : Math.max(12, rect.top - menuHeight - 8);
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
    // WAI-ARIA menu: keyboard opening moves focus inside, never traps Tab.
    const id = window.requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
    });
    window.addEventListener('pointerdown', closeOutside);
    window.addEventListener('keydown', closeEscape);
    window.addEventListener('resize', placeMenu);
    window.addEventListener('scroll', placeMenu, true);
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener('pointerdown', closeOutside);
      window.removeEventListener('keydown', closeEscape);
      window.removeEventListener('resize', placeMenu);
      window.removeEventListener('scroll', placeMenu, true);
    };
  }, [open]);

  useEffect(() => {
    if (!preview) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    previewClose.current?.focus();
    const onDialogKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setPreview(false);
      }
      // The close button is the only focusable control inside the viewer.
      if (event.key === 'Tab') {
        event.preventDefault();
        previewClose.current?.focus();
      }
    };
    window.addEventListener('keydown', onDialogKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onDialogKey);
      trigger.current?.focus();
    };
  }, [preview]);

  function menuKeyboard(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>(
      '[role="menuitem"]:not([disabled]):not([aria-disabled="true"])'
    ) ?? [])];
    if (!items.length) return;
    event.preventDefault();
    const current = items.indexOf(document.activeElement as HTMLElement);
    const index = event.key === 'Home' ? 0
      : event.key === 'End' ? items.length - 1
      : event.key === 'ArrowDown' ? (current + 1 + items.length) % items.length
      : (current - 1 + items.length) % items.length;
    items[index]?.focus();
  }

  const act = (operation: () => void) => { setOpen(false); operation(); };
  return (
    <div className="km-avatar-actions" ref={wrap}>
      <button ref={trigger} className="km-avatar-plus" type="button" aria-haspopup="menu"
        aria-expanded={open} aria-label={en ? 'Profile photo actions' : 'Actions de la photo de profil'}
        onClick={() => { placeMenu(); setOpen(value => !value); }} disabled={busy}>
        <KnowMeAnimatedIcon name="create" size={19} state={open ? "open" : "closed"} />
      </button>
      {open && (createPortal(<div ref={menuRef} onKeyDown={menuKeyboard}
        onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
        }}
        style={{ top: menuPosition.top, left: menuPosition.left }}
        className="km-avatar-menu" role="menu"
        aria-label={en ? 'Profile options' : 'Options du profil'}>
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
      </div>, document.body) as unknown as ReactElement)}
      {preview && avatarUrl && (createPortal(<div className="km-avatar-lightbox" role="dialog" aria-modal="true"
        aria-label={en ? 'Profile picture' : 'Photo de profil'} onClick={() => setPreview(false)}>
        <button ref={previewClose} type="button" className="km-avatar-lightbox-close"
          onClick={() => setPreview(false)} aria-label={en ? 'Close' : 'Fermer'}>
          <KnowMeAnimatedIcon name="close" size={20}/></button>
        <img src={avatarUrl} alt={displayName} onClick={event => event.stopPropagation()} />
        <p>@{username}</p>
      </div>, document.body) as unknown as ReactElement)}
    </div>
  );
}
