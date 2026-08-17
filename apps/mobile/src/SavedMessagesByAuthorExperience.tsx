import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';

type SavedMessage = {
  messageId: string;
  savedAt: string;
  message: {
    id: string;
    conversationId: string;
    content: string;
    sender: { id: string; username: string; displayName: string };
  };
};

type AuthorGroup = {
  id: string;
  username: string;
  displayName: string;
  items: SavedMessage[];
};

export function SavedMessagesByAuthorExperience({
  onOpenMessage
}: {
  onOpenMessage?: (conversationId: string, messageId: string) => void;
}) {
  const { colors } = useAppearance();
  const [items, setItems] = useState<SavedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiFetch<{ items: SavedMessage[] }>('/saved-messages?limit=100')
      .then((response) => {
        if (active) setItems(response.items);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Chargement impossible.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const groups = useMemo<AuthorGroup[]>(() => {
    const map = new Map<string, AuthorGroup>();
    for (const item of items) {
      const author = item.message.sender;
      const group = map.get(author.id) ?? {
        id: author.id,
        username: author.username,
        displayName: author.displayName,
        items: []
      };
      group.items.push(item);
      map.set(author.id, group);
    }
    return [...map.values()].sort(
      (a, b) => b.items.length - a.items.length || a.displayName.localeCompare(b.displayName)
    );
  }, [items]);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.eyebrow, { color: colors.accent }]}>MESSAGES ENREGISTRÉS · AUTEURS</Text>
      <Text style={[styles.heading, { color: colors.text }]}>Par auteur</Text>
      <Text style={[styles.muted, { color: colors.muted }]}>Regroupement local des messages déjà autorisés, sans profil public.</Text>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      {loading ? <Text style={[styles.muted, { color: colors.muted }]}>Chargement…</Text> : null}

      {groups.map((group) => (
        <View key={group.id} style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>{group.displayName}</Text>
              <Text style={[styles.small, { color: colors.muted }]}>@{group.username}</Text>
            </View>
            <Text style={[styles.count, { color: colors.accent }]}>{group.items.length}</Text>
          </View>
          {group.items.map((item) => (
            <Pressable
              key={item.messageId}
              disabled={!onOpenMessage}
              onPress={() => onOpenMessage?.(item.message.conversationId, item.message.id)}
              style={({ pressed }) => [styles.item, { borderColor: colors.border }, pressed && styles.pressed]}
            >
              <Text style={[styles.message, { color: colors.text }]}>{item.message.content}</Text>
              <Text style={[styles.small, { color: colors.muted }]}>Enregistré le {new Date(item.savedAt).toLocaleString()}</Text>
            </Pressable>
          ))}
        </View>
      ))}
      {!loading && !groups.length ? <Text style={[styles.muted, { color: colors.muted }]}>Aucun message enregistré.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 44, gap: 12 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  heading: { fontSize: 29, fontWeight: '900' },
  muted: { fontSize: 14, lineHeight: 20 },
  error: { fontSize: 13, lineHeight: 19 },
  group: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 9 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontSize: 16, fontWeight: '900' },
  small: { fontSize: 11, lineHeight: 16 },
  count: { fontSize: 24, fontWeight: '900' },
  item: { borderTopWidth: 1, paddingTop: 9, gap: 4 },
  pressed: { opacity: 0.72 },
  message: { fontSize: 14, lineHeight: 20 }
});
