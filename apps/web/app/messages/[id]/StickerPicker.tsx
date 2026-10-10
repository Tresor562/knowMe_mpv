'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useI18n } from '../../../components/i18n-provider';

type Sticker = {
  key: string;
  version: number;
  label: string;
  glyph: string;
  accessibilityLabel: string;
};
type Pack = {
  key: string;
  version: number;
  name: string;
  description: string;
  stickers: Sticker[];
};
type Catalog = {
  schemaVersion: 1;
  packs: Pack[];
  visualOnly: true;
  externalAssetAllowed: false;
  arbitraryHtmlAllowed: false;
  clientAssetAccepted: false;
};

const EMOJI_GROUPS = [
  { key: 'recent', fr: 'Expressions', en: 'Expressions', values: ['😀','😃','😂','🥹','😍','😘','😎','🤔','🥰','😭','🥺','😴','😡','😱','🤯','😇','🙃','🫶','❤️','💙','💜','🔥','✨','🎉','👍','👎','👏','🙏','💯','👀'] },
  { key: 'people', fr: 'Personnes et gestes', en: 'People and gestures', values: ['🙋','🙌','🤝','💪','🤙','✌️','👋','👌','💅','🧑‍💻','👩‍💻','👨‍💻','👑','🧠','👨‍🎨','🧑‍🚀'] },
  { key: 'nature', fr: 'Nature et objets', en: 'Nature and objects', values: ['🐱','🐶','🦋','🌹','🌸','🌻','🌙','⭐','☀️','🌈','🍀','🌍','🎮','🎧','📱','💻','📸','🎁','🚀','⚡'] }
] as const;

export function StickerPicker<T>({
  conversationId,
  onSent,
  onInsertEmoji
}: {
  conversationId: string;
  onSent: (message: T) => void;
  onInsertEmoji?: (emoji: string) => void;
}) {
  const { locale } = useI18n();
  const en = locale === 'en';
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'emoji' | 'stickers'>('emoji');
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  const wrap = useRef<HTMLDivElement>(null);
  const searchField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(event.target as Node)) setOpen(false);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', keyboard);
    return () => {
      window.removeEventListener('pointerdown', outside);
      window.removeEventListener('keydown', keyboard);
    };
  }, [open]);

  useEffect(() => {
    if (!open || tab !== 'stickers' || catalog || loading || error) return;
    setLoading(true);
    void apiFetch<Catalog>('/stickers/catalog')
      .then(value => {
        setCatalog(value);
        setError('');
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : (en ? 'Sticker catalog unavailable.' : 'Catalogue des stickers indisponible.')))
      .finally(() => setLoading(false));
  }, [catalog, loading, open, tab, en, error]);

  const matchingPacks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!catalog) return [];
    return catalog.packs.map(pack => ({
      pack,
      stickers: query
        ? pack.stickers.filter(sticker => [pack.name, sticker.label, sticker.accessibilityLabel]
          .some(value => value.toLocaleLowerCase().includes(query)))
        : pack.stickers
    })).filter(item => item.stickers.length > 0);
  }, [catalog, search]);

  function chooseEmoji(emoji: string) {
    onInsertEmoji?.(emoji);
    setRecent(current => [emoji, ...current.filter(value => value !== emoji)].slice(0, 24));
  }

  async function send(packKey: string, sticker: Sticker) {
    const operation = `${packKey}:${sticker.key}`;
    if (sending) return;
    setSending(operation);
    try {
      const message = await apiFetch<T>(`/conversations/${conversationId}/stickers`, {
        method: 'POST',
        body: JSON.stringify({ packKey, stickerKey: sticker.key })
      });
      onSent(message);
      setError('');
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (en ? 'Could not send sticker.' : 'Envoi du sticker impossible.'));
    } finally {
      setSending(null);
    }
  }

  return <div className="km-picker-anchor" ref={wrap}>
    <button type="button" className="km-picker-trigger" aria-expanded={open}
      aria-controls="knowme-sticker-picker" aria-label={en ? 'Emoji and stickers' : 'Emojis et stickers'}
      onClick={() => {if (!open) setError(''); setOpen(value => !value);}}>
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="6"/><path d="M8 14c2.1 3 5.9 3 8 0"/><path d="M8.5 10h.01M15.5 10h.01" strokeWidth="3"/>
      </svg>
    </button>
    {open && <section id="knowme-sticker-picker" className="km-picker-sheet" role="dialog"
      aria-label={en ? 'Emoji and sticker selector' : 'Sélecteur d’emojis et stickers'}>
      <header className="km-picker-head">
        <strong>{en ? 'Emoji & stickers' : 'Emojis et stickers'}</strong>
        <button type="button" className="km-picker-close" onClick={() => setOpen(false)} aria-label={en ? 'Close' : 'Fermer'}>×</button>
      </header>
      <div className="km-picker-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'emoji'} onClick={() => {setTab('emoji');setSearch('');}}>
          {en ? 'Emoji' : 'Emojis'}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'stickers'} onClick={() => {setTab('stickers');setSearch('');setError('');}}>
          Stickers
        </button>
      </div>
      {tab === 'stickers' && <div className="km-picker-search">
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/>
        </svg>
        <input ref={searchField} type="search" value={search} onChange={event => setSearch(event.target.value)}
          placeholder={en ? 'Search stickers' : 'Rechercher des stickers'} aria-label={en ? 'Search stickers' : 'Rechercher des stickers'}/>
      </div>}
      <div className="km-picker-scroll" role="tabpanel">
        {tab === 'emoji' && <>
          {recent.length > 0 && <div className="km-picker-group">
            <strong>{en ? 'Recently used' : 'Récents'}</strong>
            <div className="km-picker-emoji-grid">{recent.map(emoji =>
              <button key={emoji} type="button" aria-label={emoji} onClick={() => chooseEmoji(emoji)}>{emoji}</button>
            )}</div>
          </div>}
          {EMOJI_GROUPS.map(group => <div key={group.key} className="km-picker-group">
            <strong>{en ? group.en : group.fr}</strong>
            <div className="km-picker-emoji-grid">{group.values.map(emoji =>
              <button key={emoji} type="button" aria-label={emoji} onClick={() => chooseEmoji(emoji)}>{emoji}</button>
            )}</div>
          </div>)}
        </>}
        {tab === 'stickers' && <>
          {loading && <p role="status" className="km-picker-status">{en ? 'Loading stickers…' : 'Chargement des stickers…'}</p>}
          {error && <div role="alert" className="km-picker-error">{error} <button type="button" onClick={() => setError('')}>{en ? 'Retry' : 'Réessayer'}</button></div>}
          {!loading && !error && matchingPacks.length === 0 && <p className="km-picker-status">
            {en ? 'No stickers found.' : 'Aucun sticker trouvé.'}
          </p>}
          {matchingPacks.map(({pack, stickers}) => <div className="km-picker-group" key={`${pack.key}:${pack.version}`}>
            <strong>{pack.name}</strong>
            <div className="km-picker-sticker-grid">{stickers.map(sticker => {
              const operation = `${pack.key}:${sticker.key}`;
              return <button key={`${sticker.key}:${sticker.version}`} type="button"
                aria-label={en ? `Send sticker: ${sticker.accessibilityLabel}` : `Envoyer le sticker : ${sticker.accessibilityLabel}`}
                title={sticker.accessibilityLabel} disabled={sending !== null}
                onClick={() => void send(pack.key, sticker)}>
                <span aria-hidden="true">{sticker.glyph}</span>
                <small>{sending === operation ? '…' : sticker.label}</small>
              </button>;
            })}</div>
          </div>)}
        </>}
      </div>
    </section>}
  </div>;
}
