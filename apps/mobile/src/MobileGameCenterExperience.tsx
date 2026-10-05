import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';
import { GlassSurface, KnowMeIcon, PressScale } from './ui/KnowMeUI';
import {
  EMPTY_GAME_LIBRARY,
  filterGameCenterCatalog,
  gameCenterCategories,
  gameFavoriteKeys,
  type GameCenterCard,
  type GameCenterLibrary
} from './game-center-model';

function message(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function gameStatusLabel(value: string) {
  const labels: Record<string, string> = {
    ACTIVE: 'Partie en cours',
    WAITING: 'En attente',
    COMPLETED: 'Terminée',
    ABANDONED: 'Abandonnée'
  };
  return labels[value] ?? value.replaceAll('_', ' ').toLocaleLowerCase();
}

export function MobileGameCenterExperience() {
  const { colors, visual } = useAppearance();
  const [catalog, setCatalog] = useState<GameCenterCard[]>([]);
  const [library, setLibrary] = useState<GameCenterLibrary>(EMPTY_GAME_LIBRARY);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function load() {
    setStatus('');
    const [nextCatalog, nextLibrary] = await Promise.all([
      apiFetch<GameCenterCard[]>('/games/center'),
      apiFetch<GameCenterLibrary>('/games/library')
    ]);
    setCatalog(nextCatalog);
    setLibrary(nextLibrary);
  }

  useEffect(() => {
    void load().catch((cause) => {
      setStatus(message(cause, 'Le Game Center est momentanément indisponible.'));
    });
  }, []);

  const categories = useMemo(() => gameCenterCategories(catalog), [catalog]);
  const visibleGames = useMemo(
    () => filterGameCenterCatalog(catalog, query, category),
    [catalog, query, category]
  );
  const favoriteKeys = useMemo(() => gameFavoriteKeys(library), [library]);

  async function toggleFavorite(game: GameCenterCard) {
    if (busyKey) return;
    setBusyKey(game.key);
    setStatus('');
    try {
      await apiFetch(`/games/${game.key}/favorite`, {
        method: favoriteKeys.has(game.key) ? 'DELETE' : 'POST'
      });
      setLibrary(await apiFetch<GameCenterLibrary>('/games/library'));
    } catch (cause) {
      setStatus(message(cause, 'Impossible de modifier ce favori.'));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <GlassSurface
      strength="soft"
      borderRadius={visual.cardRadius}
      style={styles.section}
      accessibilityLabel="Game Center KnowMe"
    >
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: colors.backgroundAccent }]}>
          <KnowMeIcon name="challenge" size={21} color={colors.accent} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.text }]}>PLAY</Text>
          <Text style={[styles.description, { color: colors.muted }]}>
            Retrouve tes jeux, tes favoris et les parties à reprendre.
          </Text>
        </View>
      </View>

      {status ? <Text accessibilityRole="alert" style={[styles.status, { color: colors.danger }]}>{status}</Text> : null}

      {library.continuePlaying.length ? (
        <GlassSurface strength="soft" borderRadius={visual.controlRadius} style={styles.panel}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>Continuer</Text>
          {library.continuePlaying.map((item) => (
            <View key={item.sessionId} style={styles.libraryRow}>
              <Text style={[styles.gameName, { color: colors.text }]}>{item.game.name}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>{item.yourTurn ? 'À toi de jouer' : gameStatusLabel(item.status)}</Text>
            </View>
          ))}
        </GlassSurface>
      ) : null}

      {library.invitations.length ? (
        <GlassSurface strength="soft" borderRadius={visual.controlRadius} style={styles.panel}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>Invitations</Text>
          {library.invitations.map((item) => (
            <View key={item.sessionId} style={styles.libraryRow}>
              <Text style={[styles.gameName, { color: colors.text }]}>{item.game.name}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>Invitation en attente</Text>
            </View>
          ))}
        </GlassSurface>
      ) : null}

      <View style={styles.searchWrap}>
        <KnowMeIcon name="search" size={18} color={colors.muted} />
        <TextInput
        accessibilityLabel="Rechercher un jeu"
        placeholder="Rechercher un jeu"
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        style={[styles.input, { color: colors.text }]}
      />
      </View>

      <View style={styles.categories} accessibilityLabel="Catégories de jeux">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: category === '' }}
          onPress={() => setCategory('')}
          style={[
            styles.chip,
            { borderColor: colors.border },
            category === '' && { backgroundColor: colors.surfaceRaised, borderColor: colors.accent }
          ]}
        >
          <Text style={[styles.chipText, { color: category === '' ? colors.accent : colors.text }]}>Tous</Text>
        </Pressable>
        {categories.map((item) => (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityState={{ selected: category === item }}
            onPress={() => setCategory(item)}
            style={[
              styles.chip,
              { borderColor: colors.border },
              category === item && { backgroundColor: colors.surfaceRaised, borderColor: colors.accent }
            ]}
          >
            <Text style={[styles.chipText, { color: category === item ? colors.accent : colors.text }]}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.catalog} accessibilityLabel="Catalogue de jeux">
        {visibleGames.map((game) => (
          <View key={`${game.key}:${game.version}`} style={[styles.gameCard, { backgroundColor: colors.surfaceGlass, borderColor: colors.border, borderRadius: visual.controlRadius }]}>
            <View style={styles.gameHeader}>
              <Text style={[styles.gameName, { color: colors.text }]}>{game.name}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>{game.estimatedMinutes} min · {game.modes.join(' / ')}</Text>
            </View>
            <Text style={[styles.description, { color: colors.muted }]}>{game.description}</Text>
            <Text style={[styles.tags, { color: colors.muted }]}>{game.categories.join(' · ')}</Text>
            <PressScale
              accessibilityRole="button"
              disabled={busyKey === game.key}
              onPress={() => void toggleFavorite(game)}
              style={[
                styles.favoriteButton,
                {
                  backgroundColor: colors.backgroundAccent,
                  borderColor: favoriteKeys.has(game.key) ? colors.accent : colors.border
                },
                busyKey === game.key && styles.muted
              ]}
            >
              <KnowMeIcon
                name="heart"
                size={17}
                color={favoriteKeys.has(game.key) ? colors.accent : colors.muted}
              />
              <Text style={[styles.favoriteText, { color: favoriteKeys.has(game.key) ? colors.accent : colors.muted }]}>
                {favoriteKeys.has(game.key) ? 'Favori' : 'Ajouter'}
              </Text>
            </PressScale>
          </View>
        ))}
        {!visibleGames.length ? <Text style={[styles.description, { color: colors.muted }]}>Aucun jeu ne correspond à ces filtres.</Text> : null}
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  section: { gap: 11, padding: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  headerIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800' },
  description: { fontSize: 12.5, lineHeight: 18 },
  status: { fontSize: 11.5, lineHeight: 17, fontWeight: '700' },
  panel: { padding: 11, gap: 7 },
  panelTitle: { fontSize: 14.5, fontWeight: '800' },
  libraryRow: { gap: 2, paddingVertical: 4 },
  searchWrap: {
    minHeight: 46,
    borderRadius: 22,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  input: { flex: 1, minHeight: 44, paddingVertical: 9 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  chipText: { fontSize: 11, fontWeight: '700' },
  catalog: { gap: 9 },
  gameCard: { borderWidth: StyleSheet.hairlineWidth, padding: 11, gap: 7 },
  gameHeader: { gap: 2 },
  gameName: { fontSize: 14.5, fontWeight: '800' },
  meta: { fontSize: 10.5 },
  tags: { fontSize: 10.5 },
  favoriteButton: {
    alignSelf: 'flex-start',
    minHeight: 34,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 17,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  favoriteText: { fontSize: 10.5, fontWeight: '700' },
  muted: { opacity: 0.5 }
});
