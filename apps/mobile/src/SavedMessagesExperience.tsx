import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';

type SavedMessage = {
  messageId: string;
  savedAt: string;
  message: {
    id: string;
    conversationId: string;
    content: string;
    createdAt: string;
    editedAt?: string | null;
    sender: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl?: string | null;
    };
  };
};

type SavedMessagesResponse = { items: SavedMessage[] };

export function SavedMessagesExperience({
  onOpenMessage
}: {
  onOpenMessage?: (conversationId: string, messageId: string) => void;
}) {
  const { colors } = useAppearance();
  const [items, setItems] = useState<SavedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setItems([]);
    try {
      const response = await apiFetch<SavedMessagesResponse>('/saved-messages?limit=100');
      setItems(response.items);
    } catch (cause) {
      setItems([]);
      setError(cause instanceof Error ? cause.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(messageId: string) {
    setBusyId(messageId);
    setError('');
    try {
      await apiFetch(`/saved-messages/${encodeURIComponent(messageId)}`, {
        method: 'DELETE'
      });
      setItems((current) => current.filter((item) => item.messageId !== messageId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Suppression impossible.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>MESSAGERIE · PRIVÉ</Text>
          <Text style={[styles.heading, { color: colors.text }]}>Messages enregistrés</Text>
          <Text style={[styles.muted, { color: colors.muted }]}>
            {loading
              ? 'Chargement du lot récent…'
              : `${items.length} référence${items.length > 1 ? 's' : ''} visible${items.length > 1 ? 's' : ''} dans le lot récent chargé.`}
          </Text>
        </View>
        <Pressable
          onPress={() => void load()}
          disabled={loading}
          style={[styles.refreshButton, { borderColor: colors.border }, loading && styles.disabled]}
        >
          <Text style={{ color: colors.text, fontWeight: '800' }}>Actualiser</Text>
        </Pressable>
      </View>

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.accent} /> : null}

      {!loading && !error && !items.length ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Aucune référence visible dans le lot récent</Text>
          <Text style={[styles.muted, { color: colors.muted }]}>
            Ce résultat borné ne prouve pas qu’aucun autre message enregistré existe. Un message devenu inaccessible n'est jamais reconstruit localement.
          </Text>
        </View>
      ) : null}

      {items.map((item) => (
        <View
          key={item.messageId}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.authorRow}>
            <View style={styles.authorCopy}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{item.message.sender.displayName}</Text>
              <Text style={[styles.handle, { color: colors.muted }]}>@{item.message.sender.username}</Text>
            </View>
            <Text style={[styles.date, { color: colors.muted }]}>
              {new Date(item.savedAt).toLocaleString()}
            </Text>
          </View>

          <Text style={[styles.message, { color: colors.text }]}>{item.message.content}</Text>
          <Text style={[styles.date, { color: colors.muted }]}>
            Message du {new Date(item.message.createdAt).toLocaleString()}
            {item.message.editedAt ? ' · modifié' : ''}
          </Text>

          <View style={styles.actions}>
            <Pressable
              disabled={!onOpenMessage}
              onPress={() => onOpenMessage?.(item.message.conversationId, item.message.id)}
              style={[
                styles.primaryButton,
                { backgroundColor: colors.accent },
                !onOpenMessage && styles.disabled
              ]}
            >
              <Text style={{ color: colors.accentText, fontWeight: '900' }}>Ouvrir</Text>
            </Pressable>
            <Pressable
              disabled={busyId === item.messageId}
              onPress={() => void remove(item.messageId)}
              style={[styles.secondaryButton, { borderColor: colors.border }, busyId === item.messageId && styles.disabled]}
            >
              <Text style={{ color: colors.text, fontWeight: '800' }}>
                {busyId === item.messageId ? 'Suppression…' : 'Retirer'}
              </Text>
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 44, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headerCopy: { flex: 1, gap: 4 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  heading: { fontSize: 29, fontWeight: '900' },
  muted: { fontSize: 14, lineHeight: 20 },
  refreshButton: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  disabled: { opacity: 0.45 },
  error: { lineHeight: 20 },
  card: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: '900' },
  authorRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  authorCopy: { flex: 1 },
  handle: { marginTop: 2, fontSize: 12 },
  date: { fontSize: 11, lineHeight: 16 },
  message: { fontSize: 15, lineHeight: 21 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  primaryButton: { borderRadius: 13, paddingHorizontal: 14, paddingVertical: 11 },
  secondaryButton: { borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 11 }
});
