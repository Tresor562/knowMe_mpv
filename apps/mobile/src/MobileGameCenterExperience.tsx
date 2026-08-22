import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';
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

export function MobileGameCenterExperience() {
  const { colors } = useAppearance();
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
    <View
      style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityLabel="Game Center KnowMe"
    >
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>PLAY · GAME CENTER</Text>
        <Text style={[styles.title, { color: colors.text }]}>Joue à ta façon</Text>
        <Text style={[styles.description, { color: colors.muted }]}> 
          Retrouve tes jeux, tes favoris, les parties à reprendre et tes invitations sans pression sociale.
        </Text>
      </View>

      {status ? <Text accessibilityRole="alert" style={[styles.status, { color: colors.danger }]}>{status}</Text> : null}

      {library.continuePlaying.length ? (
        <View style={[styles.panel, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>Continuer</Text>
          {library.continuePlaying.map((item) => (
            <View key={item.sessionId} style={styles.libraryRow}>
              <Text style={[styles.gameName, { color: colors.text }]}>{item.game.name}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>{item.yourTurn ? 'À toi de jouer' : item.status}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {library.invitations.length ? (
        <View style={[styles.panel, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>Invitations</Text>
          {library.invitations.map((item) => (
            <View key={item.sessionId} style={styles.libraryRow}>
              <Text style={[styles.gameName, { color: colors.text }]}>{item.game.name}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>Invitation en attente</Text>
            </View>
          ))}
        </View>
      ) : null}

      <TextInput
        accessibilityLabel="Rechercher un jeu"
        placeholder="Rechercher un jeu"
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
      />

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
          <View key={`${game.key}:${game.version}`} style={[styles.gameCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <View style={styles.gameHeader}>
              <Text style={[styles.gameName, { color: colors.text }]}>{game.name}</Text>
              <Text style={[styles.meta, { color: colors.muted }]}>{game.estimatedMinutes} min · {game.modes.join(' / ')}</Text>
            </View>
            <Text style={[styles.description, { color: colors.muted }]}>{game.description}</Text>
            <Text style={[styles.tags, { color: colors.muted }]}>{game.categories.map((item) => `#${item}`).join('  ')}</Text>
            <Pressable
              accessibilityRole="button"
              disabled={busyKey === game.key}
              onPress={() => void toggleFavorite(game)}
              style={({ pressed }) => [
                styles.favoriteButton,
                { borderColor: colors.accent },
                (pressed || busyKey === game.key) && styles.muted
              ]}
            >
              <Text style={[styles.favoriteText, { color: colors.accent }]}>
                {favoriteKeys.has(game.key) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              </Text>
            </Pressable>
          </View>
        ))}
        {!visibleGames.length ? <Text style={[styles.description, { color: colors.muted }]}>Aucun jeu ne correspond à ces filtres.</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12, borderWidth: 1, borderRadius: 24, padding: 18 },
  header: { gap: 5 },
  eyebrow: { fontSize: 12, fontWeight: '800' },
  title: { fontSize: 24, fontWeight: '800' },
  description: { lineHeight: 20 },
  status: { fontWeight: '700' },
  panel: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  panelTitle: { fontSize: 18, fontWeight: '800' },
  libraryRow: { gap: 2, paddingVertical: 4 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  chipText: { fontWeight: '700' },
  catalog: { gap: 10 },
  gameCard: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  gameHeader: { gap: 2 },
  gameName: { fontSize: 17, fontWeight: '800' },
  meta: { fontSize: 12 },
  tags: { fontSize: 12 },
  favoriteButton: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 },
  favoriteText: { fontWeight: '700' },
  muted: { opacity: 0.5 }
});
