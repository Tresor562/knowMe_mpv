'use client';

import { useMemo, useState } from 'react';
import { useI18n } from './i18n-provider';
import { KnowMeAnimatedIcon, type KnowMeIconState } from './knowme-animated-icon';
import { KNOWME_GLYPH_MOTION_ROLE, type KnowMeMotionRole } from './knowme-glyph-motion-roles';
import { type KnowMeGlyphName } from './knowme-glyph';
import { KnowMeGiftArtwork, type KnowMeGiftState, type KnowMeGiftVariant } from './knowme-gift-artwork';
import './knowme-icon-laboratory.css';

const GLYPHS = Object.keys(KNOWME_GLYPH_MOTION_ROLE) as KnowMeGlyphName[];
const CATEGORIES: KnowMeMotionRole[] = [
  'navigation', 'communication', 'media', 'social',
  'transfer', 'security', 'reward', 'utility'
];
const STATES: KnowMeIconState[] = [
  'idle', 'selected', 'unselected', 'open', 'closed',
  'loading', 'progress', 'success', 'error', 'sending',
  'playing', 'paused', 'recording', 'typing', 'syncing', 'live'
];
const VARIANTS: KnowMeGiftVariant[] = ['aurora', 'cosmos', 'blossom'];
const GIFT_STATES: KnowMeGiftState[] = ['idle', 'opening', 'opened', 'claimed'];
const TRANSLATIONS: Record<KnowMeGiftState, [string, string]> = {
  idle: ['Au repos', 'Idle'], opening: ['Ouverture', 'Opening'],
  opened: ['Ouvert', 'Opened'], claimed: ['Acquis', 'Claimed']
};
const CATEGORY_LABELS: Record<KnowMeMotionRole, [string, string]> = {
  navigation: ['Navigation', 'Navigation'],
  communication: ['Communication', 'Communication'],
  media: ['Multimédia', 'Media'],
  social: ['Social', 'Social'],
  transfer: ['Transferts', 'Transfers'],
  security: ['Sécurité', 'Security'],
  reward: ['Récompenses', 'Rewards'],
  utility: ['Outils', 'Utilities']
};

export function KnowMeIconLaboratory() {
  const { locale } = useI18n();
  const en = locale === 'en';
  const t = (fr: string, english: string) => en ? english : fr;
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<KnowMeMotionRole | 'all'>('all');
  const [active, setActive] = useState<KnowMeGlyphName>('heart');
  const [state, setState] = useState<KnowMeIconState>('idle');
  const [event, setEvent] = useState(0);
  const [giftStates, setGiftStates] = useState<Record<KnowMeGiftVariant, KnowMeGiftState>>({
    aurora: 'idle', cosmos: 'idle', blossom: 'idle'
  });
  const [giftEvents, setGiftEvents] = useState<Record<KnowMeGiftVariant, number>>({
    aurora: 0, cosmos: 0, blossom: 0
  });
  const visible = useMemo(() => GLYPHS.filter(name =>
    (filter === 'all' || KNOWME_GLYPH_MOTION_ROLE[name] === filter) &&
    name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  ), [filter, search]);

  function selectGlyph(name: KnowMeGlyphName) {
    setActive(name);
    setEvent(current => current + 1);
  }
  function selectState(value: KnowMeIconState) {
    setState(value);
    setEvent(current => current + 1);
  }
  function selectGift(variant: KnowMeGiftVariant, value: KnowMeGiftState) {
    setGiftStates(previous => ({ ...previous, [variant]: value }));
    setGiftEvents(previous => ({ ...previous, [variant]: previous[variant] + 1 }));
  }

  return (
    <main className="km-icon-lab" id="knowme-iconography-lab">
      <header className="km-icon-lab-hero">
        <div className="km-icon-lab-heading">
          <p className="km-icon-lab-kicker">KNOWME / VECTOR QA</p>
          <h1>{t('Laboratoire des pictogrammes', 'Iconography laboratory')}</h1>
          <p>{t('79 tracés SVG originaux et cadeaux animés. Examine les états, le rendu tactile et le mouvement sur ton écran.',
            '79 original SVG glyphs and animated gifts. Inspect states, touch geometry and motion on your device.')}</p>
        </div>
        <div className="km-icon-lab-count" aria-label={t('79 pictogrammes dans le catalogue', '79 glyphs in the library')}>
          <strong>{GLYPHS.length}</strong><span>SVG</span>
        </div>
      </header>
      <p className="km-icon-lab-disclaimer" role="note">
        {t('Banc d’essai visuel uniquement : les états sont simulés localement. Aucun achat, message ou événement serveur n’est déclenché.',
          'Visual QA only: states are simulated locally. No purchase, message or server event is triggered.')}
      </p>

      <section className="km-icon-lab-panel" aria-labelledby="km-icon-lab-control-heading">
        <div className="km-icon-lab-panel-title">
          <h2 id="km-icon-lab-control-heading">{t('Contrôler les animations', 'Control animations')}</h2>
          <span>{t('Sélectionne un pictogramme et un état', 'Choose a glyph and a state')}</span>
        </div>
        <div className="km-icon-lab-preview">
          <div className="km-icon-lab-preview-symbol" data-testid="icon-lab-preview">
            <KnowMeAnimatedIcon name={active} size={54} state={state}
              progress={state === 'progress' ? .64 : null} eventToken={event}/>
          </div>
          <div className="km-icon-lab-preview-copy">
            <strong>{active}</strong>
            <span>{t('État de prévisualisation', 'Preview state')}: {state}</span>
            <button className="km-icon-lab-replay" type="button"
              onClick={() => setEvent(previous => previous + 1)}>
              {t('Rejouer le mouvement', 'Replay motion')}
            </button>
          </div>
        </div>
        <div className="km-icon-lab-state-list" role="group"
          aria-label={t('État de l’icône prévisualisée', 'Preview icon state')}>
          {STATES.map(value => <button key={value} type="button"
            className="km-icon-lab-chip" aria-pressed={state === value}
            onClick={() => selectState(value)}>{value}</button>)}
        </div>
      </section>

      <section className="km-icon-lab-panel" aria-labelledby="km-icon-lab-catalog-heading">
        <div className="km-icon-lab-panel-title">
          <h2 id="km-icon-lab-catalog-heading">{t('Catalogue complet', 'Complete catalog')}</h2>
          <span>{visible.length} / {GLYPHS.length}</span>
        </div>
        <label className="km-icon-lab-search">
          <span>{t('Rechercher une icône', 'Search for an icon')}</span>
          <input type="search" value={search} onChange={event => setSearch(event.target.value)}
            placeholder={t('Nom du pictogramme…', 'Glyph name…')}/>
        </label>
        <div className="km-icon-lab-filter" role="group" aria-label={t('Catégorie', 'Category')}>
          <button className="km-icon-lab-chip" type="button" aria-pressed={filter === 'all'}
            onClick={() => setFilter('all')}>{t('Toutes', 'All')}</button>
          {CATEGORIES.map(role => <button className="km-icon-lab-chip" type="button" key={role}
            aria-pressed={filter === role} onClick={() => setFilter(role)}>
            {CATEGORY_LABELS[role][en ? 1 : 0]}</button>)}
        </div>
        <div className="km-icon-lab-grid">
          {visible.map(name => <button key={name} type="button"
            className="km-icon-lab-glyph" data-glyph={name}
            aria-pressed={active === name} aria-label={name}
            onClick={() => selectGlyph(name)}>
            <KnowMeAnimatedIcon name={name} size={24} state="idle"/>
            <span>{name}</span>
          </button>)}
        </div>
        {!visible.length && <p role="status">{t('Aucun pictogramme correspondant.', 'No matching glyph.')}</p>}
      </section>

      <section className="km-icon-lab-panel" aria-labelledby="km-icon-lab-gifts-heading">
        <div className="km-icon-lab-panel-title">
          <h2 id="km-icon-lab-gifts-heading">{t('Cadeaux vectoriels', 'Vector collectibles')}</h2>
          <span>{t('Trois illustrations, quatre états', 'Three artworks, four states')}</span>
        </div>
        <div className="km-icon-lab-gift-grid">
          {VARIANTS.map(variant => <article key={variant} className="km-icon-lab-gift">
            <h3>{variant}</h3>
            <div className="km-icon-lab-artwork">
              <KnowMeGiftArtwork variant={variant} size={136}
                state={giftStates[variant]} eventToken={giftEvents[variant]}/>
            </div>
            <div className="km-icon-lab-gift-controls" role="group"
              aria-label={t('État du cadeau ', 'Gift state ') + variant}>
              {GIFT_STATES.map(value => <button key={value} type="button"
                aria-pressed={giftStates[variant] === value}
                className="km-icon-lab-chip"
                onClick={() => selectGift(variant, value)}>
                {TRANSLATIONS[value][en ? 1 : 0]}</button>)}
            </div>
          </article>)}
        </div>
      </section>
      <footer className="km-icon-lab-footer">
        {t('Accessibilité : respecte automatiquement le paramètre système « réduire les animations » et les préférences KnowMe.',
          'Accessibility: follows the system Reduce Motion setting and KnowMe motion preferences.')}
      </footer>
    </main>
  );
}
