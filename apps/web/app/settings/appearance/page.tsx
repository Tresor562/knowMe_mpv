'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import {
  APPEARANCE_EVENT,
  AppearanceResponse,
  AppearanceTheme,
  saveLocalAppearance
} from '../../../lib/appearance';
import { useSession } from '../../../lib/use-session';

type UpdateInput = Partial<{
  themeKey: string;
  secondaryThemeKey: string;
  themeBlendMode: 'OFF' | 'ACCENT' | 'EFFECTS' | 'BALANCED';
  iconPackKey: string;
  appIconKey: string;
  contrast: 'STANDARD' | 'HIGH';
  reduceTransparency: boolean;
  animationsEnabled: boolean;
  animatedIconsEnabled: boolean;
  uiSoundsEnabled: boolean;
  weatherEffectsEnabled: boolean;
  effectIntensity: 'LOW' | 'BALANCED' | 'HIGH';
  automaticRotationMode: 'OFF' | 'TIME' | 'SEASON';
}>;

const CATEGORY_LABELS: Record<string, string> = {
  ALL: 'Toutes les catégories',
  ESSENTIAL: 'Essentiels',
  NATURE: 'Nature',
  WEATHER: 'Météo',
  SEASON: 'Saisons',
  UNIVERSE: 'Univers',
  FUTURISTIC: 'Futuristes',
  ANIME: 'Anime & Manga',
  GAMING: 'Gaming',
  FANTASY: 'Fantasy',
  ARTISTIC: 'Artistiques'
};

function previewColor(value: string, fallback: string) {
  return value === 'adaptive' ? fallback : value;
}

function ThemeCard({
  theme,
  selected,
  busy,
  onSelect
}: {
  theme: AppearanceTheme;
  selected: boolean;
  busy: boolean;
  onSelect: () => void;
}) {
  return (
    <article
      className="card theme-card"
      aria-current={selected ? 'true' : undefined}
      data-theme-tier={theme.tier.toLowerCase()}
    >
      <div
        className="theme-preview"
        aria-hidden="true"
        style={{
          background: `radial-gradient(circle at top right, ${previewColor(theme.palette.backgroundAccent, '#d9f5e9')}, ${previewColor(theme.palette.background, '#071410')})`,
          color: previewColor(theme.palette.text, '#f4fff9'),
          borderColor: theme.palette.accent
        }}
      >
        <span style={{ background: theme.palette.accent }} />
        <span style={{ background: previewColor(theme.palette.surface, 'rgba(255,255,255,.72)') }} />
        <span style={{ background: theme.palette.secondary }} />
      </div>
      <div className="theme-card-copy">
        <small>
          #{theme.order} · {theme.tier} · {CATEGORY_LABELS[theme.category] ?? theme.category}
        </small>
        <h2>{theme.name}</h2>
        <p>{theme.description}</p>
        <div className="theme-tags">
          <span>{theme.iconPackKey}</span>
          <span>{theme.chatBubbleStyle}</span>
          {theme.effects.slice(0, 2).map((effect) => <span key={effect}>{effect}</span>)}
          {theme.effects.length > 2 && <span>+{theme.effects.length - 2}</span>}
        </div>
      </div>
      <button
        className={selected ? 'btn' : 'btn btn-primary'}
        disabled={busy || theme.locked || selected}
        onClick={onSelect}
      >
        {theme.locked ? 'Premium ou possession requise' : selected ? 'Sélectionné' : 'Appliquer'}
      </button>
    </article>
  );
}

export default function AppearanceSettingsPage() {
  const { user, loading: sessionLoading } = useSession({ required: true });
  const [appearance, setAppearance] = useState<AppearanceResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState<'ALL' | 'FREE' | 'PREMIUM'>('ALL');
  const [category, setCategory] = useState('ALL');

  const load = useCallback(async () => {
    try {
      const response = await apiFetch<AppearanceResponse>('/appearance');
      setAppearance(response);
      saveLocalAppearance(response);
      if (response.preference.fallbackReason) {
        setMessage('Le choix reste enregistré, mais le thème Classique KnowMe est appliqué car le droit actif manque.');
      }
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Préférences d’apparence indisponibles.');
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading) void load();
  }, [load, sessionLoading]);

  async function update(input: UpdateInput) {
    if (!appearance) return;
    setBusy(true);
    try {
      const response = await apiFetch<AppearanceResponse>('/appearance', {
        method: 'PATCH',
        body: JSON.stringify({ ...input, expectedVersion: appearance.preference.version })
      });
      setAppearance(response);
      saveLocalAppearance(response);
      window.dispatchEvent(new CustomEvent(APPEARANCE_EVENT, { detail: response }));
      setMessage('Personnalisation synchronisée sur ton compte.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Mise à jour impossible.');
      await load();
    } finally {
      setBusy(false);
    }
  }

  const visibleThemes = useMemo(() => {
    if (!appearance) return [];
    const query = search.trim().toLocaleLowerCase('fr');
    return appearance.themes.filter((theme) => {
      if (tier !== 'ALL' && theme.tier !== tier) return false;
      if (category !== 'ALL' && theme.category !== category) return false;
      if (!query) return true;
      return [theme.name, theme.description, theme.category, theme.iconPackKey, ...theme.effects]
        .join(' ')
        .toLocaleLowerCase('fr')
        .includes(query);
    });
  }, [appearance, category, search, tier]);

  if (sessionLoading || !user || !appearance) {
    return <main className="shell"><p>{message || 'Chargement de la personnalisation…'}</p></main>;
  }

  const preference = appearance.preference;
  const selectedTheme = appearance.themes.find((theme) => theme.key === preference.selectedThemeKey);

  return (
    <main className="shell appearance-studio">
      <header className="appearance-hero">
        <small>KMD-031 · IDENTITÉ VISUELLE KNOWME</small>
        <h1>Ton KnowMe, ton univers</h1>
        <p>
          Les thèmes changent la palette, les icônes, les bulles, les cartes, les transitions,
          les effets, les sons optionnels et l’icône de l’application, tout en gardant la même navigation.
        </p>
        <div className="theme-tags">
          <span>100 thèmes</span><span>40 gratuits</span><span>60 Premium</span>
          <span>25 packs d’icônes</span><span>10 saisons</span>
        </div>
        <a className="btn" href="/profile">Retour au profil</a>
      </header>

      {message && <p role="status" className="card appearance-status">{message}</p>}

      <section className="card appearance-controls" aria-label="Recherche et filtres">
        <label>
          Rechercher
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Galaxy, Sakura, gaming, pluie, cristal…"
          />
        </label>
        <label>
          Accès
          <select value={tier} onChange={(event) => setTier(event.target.value as typeof tier)}>
            <option value="ALL">Gratuits et Premium</option>
            <option value="FREE">Gratuits</option>
            <option value="PREMIUM">Premium</option>
          </select>
        </label>
        <label>
          Catégorie
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <p><strong>{visibleThemes.length}</strong> thème(s) affiché(s)</p>
      </section>

      <section className="theme-grid" aria-label="Catalogue des thèmes">
        {visibleThemes.map((theme) => (
          <ThemeCard
            key={theme.key}
            theme={theme}
            selected={preference.selectedThemeKey === theme.key}
            busy={busy}
            onSelect={() => void update({ themeKey: theme.key })}
          />
        ))}
      </section>

      <section className="appearance-settings-grid">
        <article className="card appearance-panel">
          <h2>Icônes et identité</h2>
          <label>
            Pack d’icônes
            <select
              value={preference.selectedIconPackKey ?? 'theme-default'}
              disabled={busy}
              onChange={(event) => void update({ iconPackKey: event.target.value })}
            >
              <option value="theme-default">Pack automatique du thème</option>
              {appearance.iconPacks.map((pack) => (
                <option key={pack.key} value={pack.key} disabled={pack.locked}>
                  {pack.name} · {pack.tier}{pack.locked ? ' · verrouillé' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Icône de l’application
            <select
              value={preference.selectedAppIconKey ?? 'theme-default'}
              disabled={busy}
              onChange={(event) => void update({ appIconKey: event.target.value })}
            >
              <option value="theme-default">Icône prévue par le thème</option>
              {appearance.appIcons.map((icon) => (
                <option key={icon.key} value={icon.key} disabled={icon.locked}>
                  {icon.name} · {icon.tier}{icon.seasonal ? ' · événement' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={preference.animatedIconsEnabled}
              disabled={busy || !preference.animationsEnabled}
              onChange={(event) => void update({ animatedIconsEnabled: event.target.checked })}
            />
            Animer discrètement les icônes compatibles
          </label>
          <p className="muted-copy">
            Pack effectif : <strong>{preference.effectiveIconPackKey}</strong> · Icône effective :{' '}
            <strong>{preference.effectiveAppIconKey ?? 'plateforme par défaut'}</strong>
          </p>
        </article>

        <article className="card appearance-panel">
          <h2>Animations, sons et batterie</h2>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={preference.animationsEnabled}
              disabled={busy}
              onChange={(event) => void update({ animationsEnabled: event.target.checked })}
            />
            Activer les animations du thème
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={preference.uiSoundsEnabled}
              disabled={busy}
              onChange={(event) => void update({ uiSoundsEnabled: event.target.checked })}
            />
            Sons d’interface optionnels
          </label>
          <label>
            Intensité des effets
            <select
              value={preference.effectIntensity}
              disabled={busy || !preference.animationsEnabled}
              onChange={(event) => void update({
                effectIntensity: event.target.value as 'LOW' | 'BALANCED' | 'HIGH'
              })}
            >
              <option value="LOW">Faible · économie de batterie</option>
              <option value="BALANCED">Équilibrée</option>
              <option value="HIGH">Riche</option>
            </select>
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={preference.weatherEffectsEnabled}
              disabled={busy}
              onChange={(event) => void update({ weatherEffectsEnabled: event.target.checked })}
            />
            Effets météo locaux Premium, après autorisation
          </label>
        </article>

        <article className="card appearance-panel">
          <h2>Accessibilité</h2>
          <label>
            Contraste
            <select
              value={preference.contrast}
              disabled={busy}
              onChange={(event) => void update({
                contrast: event.target.value as 'STANDARD' | 'HIGH'
              })}
            >
              <option value="STANDARD">Standard</option>
              <option value="HIGH">Élevé</option>
            </select>
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={preference.reduceTransparency}
              disabled={busy}
              onChange={(event) => void update({ reduceTransparency: event.target.checked })}
            />
            Réduire transparences et flous
          </label>
          <p className="muted-copy">
            Le réglage système « réduire les animations » reste prioritaire sur tous les thèmes.
          </p>
        </article>

        <article className="card appearance-panel">
          <h2>Combinaison Premium</h2>
          <label>
            Thème secondaire
            <select
              value={preference.secondaryThemeKey ?? 'none'}
              disabled={busy}
              onChange={(event) => void update({ secondaryThemeKey: event.target.value })}
            >
              <option value="none">Aucun</option>
              {appearance.themes.map((theme) => (
                <option
                  key={theme.key}
                  value={theme.key}
                  disabled={theme.locked || theme.key === preference.selectedThemeKey}
                >
                  {theme.name}{theme.locked ? ' · verrouillé' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mode de fusion
            <select
              value={preference.themeBlendMode}
              disabled={busy}
              onChange={(event) => void update({
                themeBlendMode: event.target.value as 'OFF' | 'ACCENT' | 'EFFECTS' | 'BALANCED'
              })}
            >
              <option value="OFF">Désactivée</option>
              <option value="ACCENT">Couleurs d’accent</option>
              <option value="EFFECTS">Effets et animations</option>
              <option value="BALANCED">Fusion équilibrée</option>
            </select>
          </label>
          <p className="muted-copy">
            Fusion effective : <strong>{preference.effectiveThemeBlendMode}</strong>
          </p>
        </article>

        <article className="card appearance-panel">
          <h2>Rotation Premium</h2>
          <label>
            Changement automatique
            <select
              value={preference.automaticRotationMode}
              disabled={busy}
              onChange={(event) => void update({
                automaticRotationMode: event.target.value as 'OFF' | 'TIME' | 'SEASON'
              })}
            >
              <option value="OFF">Désactivé</option>
              <option value="TIME">Selon l’heure</option>
              <option value="SEASON">Selon la saison</option>
            </select>
          </label>
          <p className="muted-copy">
            Les fenêtres saisonnières sont décidées par le serveur et peuvent varier selon le pays.
          </p>
        </article>

        <article className="card appearance-panel">
          <h2>État synchronisé</h2>
          <p>Thème choisi : <strong>{selectedTheme?.name ?? preference.selectedThemeKey}</strong></p>
          <p>Thème effectif : <strong>{preference.effectiveThemeKey}</strong></p>
          <p>Version serveur : <strong>{preference.version}</strong></p>
          <p>Fallback sûr : <strong>{String(appearance.rules.safeFallbackThemeKey)}</strong></p>
        </article>
      </section>

      <section className="card appearance-panel seasonal-panel">
        <h2>Thèmes saisonniers</h2>
        <p className="muted-copy">
          Ils reviennent selon les calendriers serveur avec de nouveaux objets et peuvent être obtenus
          via Premium, KnowCoins ou défis.
        </p>
        <div className="seasonal-grid">
          {appearance.seasonalThemes.map((theme) => (
            <article key={theme.key}>
              <strong>{theme.name}</strong>
              <span>{theme.available ? 'Disponible maintenant' : 'Hors saison'}</span>
              <small>{theme.effects.join(' · ')}</small>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
