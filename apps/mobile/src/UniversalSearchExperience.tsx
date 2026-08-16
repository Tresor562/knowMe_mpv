import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';

type SearchKind = 'MESSAGE' | 'POST' | 'CHALLENGE' | 'CONVERSATION';

type SearchItem = {
  kind: SearchKind;
  id: string;
  title: string | null;
  snippet: string;
  route: string;
  updatedAt: string;
};

type SearchResponse = {
  query: string;
  items: SearchItem[];
  nextCursor: string | null;
};

const labels: Record<SearchKind, string> = {
  MESSAGE: 'Message',
  POST: 'Publication',
  CHALLENGE: 'Défi',
  CONVERSATION: 'Conversation'
};

export function UniversalSearchExperience({
  onOpenResult
}: {
  onOpenResult?: (item: SearchItem) => void;
}) {
  const { colors } = useAppearance();
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [items, setItems] = useState<SearchItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function search() {
    const normalized = query.trim();
    if (normalized.length < 2 || busy) return;

    setBusy(true);
    setError('');
    try {
      const response = await apiFetch<SearchResponse>(
        `/search?q=${encodeURIComponent(normalized)}&limit=20`
      );
      setSubmittedQuery(response.query);
      setItems(response.items);
      setNextCursor(response.nextCursor);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Recherche impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function loadMore() {
    if (!nextCursor || !submittedQuery || busy) return;

    setBusy(true);
    setError('');
    try {
      const response = await apiFetch<SearchResponse>(
        `/search?q=${encodeURIComponent(submittedQuery)}&limit=20&cursor=${encodeURIComponent(nextCursor)}`
      );
      setItems((current) => {
        const seen = new Set(current.map((item) => `${item.kind}:${item.id}`));
        return [
          ...current,
          ...response.items.filter((item) => !seen.has(`${item.kind}:${item.id}`))
        ];
      });
      setNextCursor(response.nextCursor);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chargement impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.eyebrow, { color: colors.accent }]}>RECHERCHE UNIVERSELLE</Text>
      <Text style={[styles.heading, { color: colors.text }]}>Retrouve ton contenu</Text>
      <Text style={[styles.muted, { color: colors.muted }]}> 
        Seuls les résultats déjà autorisés par le serveur KnowMe sont affichés.
      </Text>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => void search()}
          placeholder="Message, conversation, publication ou défi…"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={120}
          returnKeyType="search"
          style={[
            styles.input,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              color: colors.text
            }
          ]}
        />
        <Pressable
          disabled={busy || query.trim().length < 2}
          onPress={() => void search()}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.accent },
            (pressed || busy || query.trim().length < 2) && styles.disabled
          ]}
        >
          <Text style={[styles.primaryText, { color: colors.accentText }]}>Rechercher</Text>
        </Pressable>
      </View>

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      {busy && items.length === 0 ? <ActivityIndicator color={colors.accent} /> : null}

      {submittedQuery ? (
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Résultats pour « {submittedQuery} »</Text>
      ) : null}

      {submittedQuery && !busy && items.length === 0 && !error ? (
        <Text style={[styles.muted, { color: colors.muted }]}>Aucun résultat accessible.</Text>
      ) : null}

      {items.map((item) => (
        <Pressable
          key={`${item.kind}:${item.id}`}
          disabled={!onOpenResult}
          onPress={() => onOpenResult?.(item)}
          style={({ pressed }) => [
            styles.result,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed
          ]}
        >
          <View style={styles.resultHeader}>
            <Text style={[styles.resultTitle, { color: colors.text }]}>
              {item.title || labels[item.kind]}
            </Text>
            <Text style={[styles.kind, { color: colors.accent }]}>{labels[item.kind]}</Text>
          </View>
          <Text style={[styles.snippet, { color: colors.muted }]}>{item.snippet}</Text>
          <Text style={[styles.date, { color: colors.muted }]}>
            {new Date(item.updatedAt).toLocaleString()}
          </Text>
        </Pressable>
      ))}

      {nextCursor ? (
        <Pressable
          disabled={busy}
          onPress={() => void loadMore()}
          style={[styles.secondaryButton, { borderColor: colors.border }, busy && styles.disabled]}
        >
          <Text style={[styles.secondaryText, { color: colors.text }]}>
            {busy ? 'Chargement…' : 'Charger plus'}
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

export type UniversalSearchResult = SearchItem;

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 44, gap: 12 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  heading: { fontSize: 30, fontWeight: '900' },
  muted: { fontSize: 14, lineHeight: 20 },
  card: { borderWidth: 1, borderRadius: 22, padding: 16, gap: 10 },
  input: { borderWidth: 1, borderRadius: 15, minHeight: 48, paddingHorizontal: 14, paddingVertical: 12 },
  primaryButton: { borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  primaryText: { fontWeight: '900' },
  disabled: { opacity: 0.45 },
  error: { lineHeight: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '900', marginTop: 8 },
  result: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 8 },
  pressed: { opacity: 0.78 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' },
  resultTitle: { flex: 1, fontSize: 16, fontWeight: '800' },
  kind: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  snippet: { lineHeight: 20 },
  date: { fontSize: 11 },
  secondaryButton: { borderWidth: 1, borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  secondaryText: { fontWeight: '800' }
});
