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
import { KnowMeIcon, PressScale, SoftSurface } from './ui/KnowMeUI';

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
  kinds: SearchKind[];
  items: SearchItem[];
  nextCursor: string | null;
};

const SEARCH_KINDS: SearchKind[] = ['MESSAGE', 'POST', 'CHALLENGE', 'CONVERSATION'];
const labels: Record<SearchKind, string> = {
  MESSAGE: 'Messages',
  POST: 'Publications',
  CHALLENGE: 'Défis',
  CONVERSATION: 'Conversations'
};

export function UniversalSearchExperience({
  onOpenResult
}: {
  onOpenResult?: (item: SearchItem) => void;
}) {
  const { colors, visual } = useAppearance();
  const [query, setQuery] = useState('');
  const [activeKinds, setActiveKinds] = useState<SearchKind[]>(SEARCH_KINDS);
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [submittedKinds, setSubmittedKinds] = useState<SearchKind[]>(SEARCH_KINDS);
  const [items, setItems] = useState<SearchItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function toggleKind(kind: SearchKind) {
    setActiveKinds((current) => {
      const selected = current.includes(kind);
      if (selected && current.length === 1) return current;
      const next = selected
        ? current.filter((value) => value !== kind)
        : SEARCH_KINDS.filter((value) => current.includes(value) || value === kind);
      setSubmittedQuery('');
      setItems([]);
      setNextCursor(null);
      setError('');
      return next;
    });
  }

  async function search() {
    const normalized = query.trim();
    if (normalized.length < 2 || busy) return;

    setBusy(true);
    setError('');
    try {
      const kinds = activeKinds.join(',');
      const response = await apiFetch<SearchResponse>(
        `/search?q=${encodeURIComponent(normalized)}&limit=20&kinds=${encodeURIComponent(kinds)}`
      );
      setSubmittedQuery(response.query);
      setSubmittedKinds(response.kinds);
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
      const kinds = submittedKinds.join(',');
      const response = await apiFetch<SearchResponse>(
        `/search?q=${encodeURIComponent(submittedQuery)}&limit=20&kinds=${encodeURIComponent(kinds)}&cursor=${encodeURIComponent(nextCursor)}`
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
      <View style={styles.header}>
        <Text style={[styles.heading, { color: colors.text }]}>Recherche</Text>
        <Text style={[styles.muted, { color: colors.muted }]}>
          Messages, conversations, publications et défis accessibles.
        </Text>
      </View>

      <SoftSurface style={styles.searchSurface}>
        <View
          style={[
            styles.searchField,
            {
              backgroundColor: colors.backgroundAccent,
              borderColor: colors.border,
              borderRadius: visual.inputRadius
            }
          ]}
        >
          <KnowMeIcon name="search" size={20} color={colors.muted} />
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
          style={[styles.input, { color: colors.text }]}
        />
        </View>
        <View style={styles.filterRow}>
          {SEARCH_KINDS.map((kind) => {
            const selected = activeKinds.includes(kind);
            return (
              <PressScale
                key={kind}
                accessibilityRole="button"
                accessibilityLabel={labels[kind]}
                onPress={() => toggleKind(kind)}
                style={[
                  styles.filterButton,
                  {
                    borderColor: selected ? colors.accent : colors.border,
                    backgroundColor: selected ? colors.surfaceRaised : 'transparent'
                  }
                ]}
              >
                <Text style={[styles.filterText, { color: selected ? colors.accent : colors.muted }]}>
                  {labels[kind]}
                </Text>
              </PressScale>
            );
          })}
        </View>
        <Text style={[styles.filterHelp, { color: colors.muted }]}>Changer un filtre réinitialise la pagination.</Text>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Rechercher"
          disabled={busy || query.trim().length < 2}
          onPress={() => void search()}
          style={[
            styles.primaryButton,
            { backgroundColor: colors.accent, borderRadius: visual.controlRadius },
            (busy || query.trim().length < 2) && styles.disabled
          ]}
        >
          <Text style={[styles.primaryText, { color: colors.accentText }]}>Rechercher</Text>
        </PressScale>
      </SoftSurface>

      {error ? <Text accessibilityLiveRegion="polite" style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      {busy && items.length === 0 ? <ActivityIndicator color={colors.accent} /> : null}

      {submittedQuery ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Résultats pour « {submittedQuery} »</Text>
          <Text style={[styles.muted, { color: colors.muted }]}>
            {submittedKinds.map((kind) => labels[kind]).join(' · ')}
          </Text>
        </>
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
            { borderBottomColor: colors.border },
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
          style={[styles.secondaryButton, { borderColor: colors.border, borderRadius: visual.controlRadius }, busy && styles.disabled]}
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
  content: { padding: 16, paddingBottom: 36, gap: 12 },
  header: { gap: 3, paddingHorizontal: 2 },
  heading: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  muted: { fontSize: 13.5, lineHeight: 19 },
  searchSurface: { padding: 10, gap: 9 },
  searchField: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  input: { flex: 1, minHeight: 46, paddingVertical: 10, fontSize: 15 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  filterButton: {
    minHeight: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 11,
    alignItems: 'center',
    justifyContent: 'center'
  },
  filterText: { fontSize: 12.5, fontWeight: '600' },
  filterHelp: { fontSize: 11, lineHeight: 16 },
  primaryButton: { minHeight: 48, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 14.5, fontWeight: '700' },
  disabled: { opacity: 0.45 },
  error: { fontSize: 13, lineHeight: 19 },
  sectionTitle: { fontSize: 17, fontWeight: '700', marginTop: 6 },
  result: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 2,
    paddingVertical: 12,
    gap: 5
  },
  pressed: { opacity: 0.72 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' },
  resultTitle: { flex: 1, fontSize: 15.5, fontWeight: '700' },
  kind: { fontSize: 10.5, fontWeight: '700' },
  snippet: { fontSize: 14, lineHeight: 19 },
  date: { fontSize: 11 },
  secondaryButton: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4
  },
  secondaryText: { fontSize: 13.5, fontWeight: '600' }
});
