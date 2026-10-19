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
const THEMES = ['system', 'light', 'dark', 'amoled'] as const;
type LabTheme = typeof THEMES[number];
const THEME_LABELS: Record<LabTheme, [string, string]> = {
  system: ['Système', 'System'], light: ['Clair', 'Light'],
  dark: ['Sombre', 'Dark'], amoled: ['AMOLED', 'AMOLED']
};
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
  const [theme, setTheme] = useState<LabTheme>('system');
  const [previewSize, setPreviewSize] = useState(54);
  const [logoReveal, setLogoReveal] = useState(50);
  const [motionPreview, setMotionPreview] = useState(true);
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
    <main className="km-icon-lab" id="knowme-iconography-lab"
      data-lab-theme={theme} data-lab-motion={motionPreview ? "on" : "off"}>
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

      <section className="km-icon-lab-panel" aria-labelledby="km-icon-lab-theme-heading">
        <div className="km-icon-lab-panel-title">
          <h2 id="km-icon-lab-theme-heading">{t('Comparer les thèmes et la lisibilité', 'Compare themes and legibility')}</h2>
          <span>{t('Prévisualisation locale uniquement', 'Local preview only')}</span>
        </div>
        <div className="km-icon-lab-theme-options" role="group" aria-label={t('Thème du laboratoire', 'Laboratory theme')}>
          {THEMES.map(value => <button key={value} type="button" className="km-icon-lab-chip"
            aria-pressed={theme === value} onClick={() => setTheme(value)}>
            {THEME_LABELS[value][en ? 1 : 0]}
          </button>)}
        </div>
        <div className="km-icon-lab-preview-options">
          <label className="km-icon-lab-size">
            <span>{t('Taille du dessin prévisualisé', 'Preview glyph size')}: {previewSize}px</span>
            <input type="range" min={18} max={72} step={2}
              value={previewSize} onChange={event => setPreviewSize(Number(event.target.value))}
              aria-label={t('Taille du pictogramme', 'Glyph size')}/>
          </label>
          <label className="km-icon-lab-motion-choice">
            <input type="checkbox" checked={motionPreview}
              onChange={event => setMotionPreview(event.target.checked)} />
            <span>{t('Animer les démonstrations', 'Animate previews')}</span>
          </label>
        </div>
      </section>

      <section className="km-icon-lab-panel" aria-labelledby="km-icon-lab-brand-heading">
        <div className="km-icon-lab-panel-title">
          <h2 id="km-icon-lab-brand-heading">
            {t('Comparaison du logo — fidélité visuelle', 'Logo comparison — visual fidelity')}
          </h2>
          <span>{t('Identité inchangée en production', 'Production identity unchanged')}</span>
        </div>
        <div className="km-icon-lab-brand-comparison">
          <figure>
            <img src="/brand/knowme-logo.svg" width={120} height={120}
              alt={t('Logo actuel de KnowMe, image intégrée au fichier SVG', 'Current KnowMe logo, bitmap embedded inside SVG')}/>
            <figcaption>{t('Logo actuel (PNG encapsulé dans SVG)', 'Current logo (PNG inside SVG)')}</figcaption>
          </figure>
          <figure>
            <img src="/brand/knowme-logo-vector-prototype.svg" width={120} height={120}
              alt={t('Prototype vectoriel du logo KnowMe redessiné avec formes et dégradés', 'True-vector logo draft made from shapes and gradients')}/>
            <figcaption>{t('Prototype 100 % tracés vectoriels', '100% vector-path prototype')}</figcaption>
          </figure>
        </div>
        <div className="km-icon-lab-brand-overlay">
          <div className="km-icon-lab-brand-overlay-head">
            <strong>{t('Comparer les contours au même emplacement', 'Compare outlines in the same position')}</strong>
            <output htmlFor="km-brand-logo-compare">{logoReveal}%</output>
          </div>
          <div className="km-icon-lab-brand-overlay-stage" data-testid="logo-comparison"
            aria-hidden="true">
            <img src="/brand/knowme-logo.svg" width={192} height={192} draggable={false} alt=""/>
            <div className="km-icon-lab-brand-overlay-vector"
              data-testid="logo-vector-reveal" style={{ clipPath: `inset(0 ${100 - logoReveal}% 0 0)` }}>
              <img src="/brand/knowme-logo-vector-prototype.svg" width={192} height={192}
                draggable={false} alt=""/>
            </div>
            <div className="km-icon-lab-brand-overlay-line"
              style={{ left: `${logoReveal}%` }} aria-hidden="true"/>
          </div>
          <label htmlFor="km-brand-logo-compare">
            {t('Révéler le prototype vectoriel', 'Reveal the vector prototype')}
          </label>
          <input id="km-brand-logo-compare" type="range" min="0" max="100" step="1"
            value={logoReveal}
            aria-label={t('Pourcentage de comparaison du logo', 'Logo comparison percentage')}
            aria-valuetext={t(`${logoReveal}% du prototype vectoriel visible`,
              `${logoReveal}% of the vector prototype revealed`)}
            onChange={event => setLogoReveal(Number(event.target.value))}/>
          <p className="km-icon-lab-brand-note">
            {t('0 % : logo original. 100 % : prototype vectoriel. Glisse pour inspecter les contours, le relief et les couleurs à la même échelle.',
              '0%: original logo. 100%: vector draft. Drag to inspect outlines, depth and colors at the exact same scale.')}
          </p>
        </div>
        <p className="km-icon-lab-brand-note">
          {t('Le prototype ne remplace pas le logo officiel. Comparer les proportions, couleurs, bords et dégradés sur mobile avant toute adoption.',
            'The prototype does not replace the official logo. Review proportions, colors, edges and gradients on a phone before adoption.')}
        </p>
      </section>

      <section className="km-icon-lab-panel" aria-labelledby="km-icon-lab-control-heading">
        <div className="km-icon-lab-panel-title">
          <h2 id="km-icon-lab-control-heading">{t('Contrôler les animations', 'Control animations')}</h2>
          <span>{t('Sélectionne un pictogramme et un état', 'Choose a glyph and a state')}</span>
        </div>
        <div className="km-icon-lab-preview">
          <div className="km-icon-lab-preview-symbol" data-testid="icon-lab-preview">
            <KnowMeAnimatedIcon name={active} size={previewSize} state={state}
              progress={state === 'progress' ? .64 : null} eventToken={event}
              motionEnabled={motionPreview}/>
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
            <KnowMeAnimatedIcon name={name} size={24} state="idle" motionEnabled={motionPreview}/>
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
                state={giftStates[variant]} eventToken={giftEvents[variant]}
                motionEnabled={motionPreview}/>
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
