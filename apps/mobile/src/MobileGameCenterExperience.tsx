import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiFetch } from './api';
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
    <View style={styles.section} accessibilityLabel="Game Center KnowMe">
      <View style={styles.header}>
        <Text style={styles.eyebrow}>PLAY · GAME CENTER</Text>
        <Text style={styles.title}>Joue à ta façon</Text>
        <Text style={styles.description}>
          Retrouve tes jeux, tes favoris, les parties à reprendre et tes invitations sans pression sociale.
        </Text>
      </View>

      {status ? <Text accessibilityRole="alert" style={styles.status}>{status}</Text> : null}

      {library.continuePlaying.length ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Continuer</Text>
          {library.continuePlaying.map((item) => (
            <View key={item.sessionId} style={styles.libraryRow}>
              <Text style={styles.gameName}>{item.game.name}</Text>
              <Text style={styles.meta}>{item.yourTurn ? 'À toi de jouer' : item.status}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {library.invitations.length ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Invitations</Text>
          {library.invitations.map((item) => (
            <View key={item.sessionId} style={styles.libraryRow}>
              <Text style={styles.gameName}>{item.game.name}</Text>
              <Text style={styles.meta}>Invitation en attente</Text>
            </View>
          ))}
        </View>
      ) : null}

      <TextInput
        accessibilityLabel="Rechercher un jeu"
        placeholder="Rechercher un jeu"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        style={styles.input}
      />

      <View style={styles.categories} accessibilityLabel="Catégories de jeux">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: category === '' }}
          onPress={() => setCategory('')}
          style={[styles.chip, category === '' && styles.chipSelected]}
        >
          <Text style={styles.chipText}>Tous</Text>
        </Pressable>
        {categories.map((item) => (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityState={{ selected: category === item }}
            onPress={() => setCategory(item)}
            style={[styles.chip, category === item && styles.chipSelected]}
          >
            <Text style={styles.chipText}>{item}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.catalog} accessibilityLabel="Catalogue de jeux">
        {visibleGames.map((game) => (
          <View key={`${game.key}:${game.version}`} style={styles.gameCard}>
            <View style={styles.gameHeader}>
              <Text style={styles.gameName}>{game.name}</Text>
              <Text style={styles.meta}>{game.estimatedMinutes} min · {game.modes.join(' / ')}</Text>
            </View>
            <Text style={styles.description}>{game.description}</Text>
            <Text style={styles.tags}>{game.categories.map((item) => `#${item}`).join('  ')}</Text>
            <Pressable
              accessibilityRole="button"
              disabled={busyKey === game.key}
              onPress={() => void toggleFavorite(game)}
              style={({ pressed }) => [styles.favoriteButton, (pressed || busyKey === game.key) && styles.muted]}
            >
              <Text style={styles.favoriteText}>
                {favoriteKeys.has(game.key) ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              </Text>
            </Pressable>
          </View>
        ))}
        {!visibleGames.length ? <Text style={styles.description}>Aucun jeu ne correspond à ces filtres.</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  header: { gap: 5 },
  eyebrow: { fontSize: 12, fontWeight: '800' },
  title: { fontSize: 24, fontWeight: '800' },
  description: { opacity: 0.72, lineHeight: 20 },
  status: { fontWeight: '700' },
  panel: { borderWidth: 1, borderColor: '#d5d9e0', borderRadius: 14, padding: 12, gap: 8 },
  panelTitle: { fontSize: 18, fontWeight: '800' },
  libraryRow: { gap: 2, paddingVertical: 4 },
  input: { borderWidth: 1, borderColor: '#cbd0d8', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#cbd0d8', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  chipSelected: { borderWidth: 2 },
  chipText: { fontWeight: '700' },
  catalog: { gap: 10 },
  gameCard: { borderWidth: 1, borderColor: '#d5d9e0', borderRadius: 14, padding: 12, gap: 8 },
  gameHeader: { gap: 2 },
  gameName: { fontSize: 17, fontWeight: '800' },
  meta: { opacity: 0.64, fontSize: 12 },
  tags: { opacity: 0.74, fontSize: 12 },
  favoriteButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#aeb5c0', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 },
  favoriteText: { fontWeight: '700' },
  muted: { opacity: 0.5 }
});
