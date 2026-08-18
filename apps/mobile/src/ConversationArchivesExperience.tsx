import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';

type Archive = {
  userId: string;
  conversationId: string;
  archivedAt: string;
};

type ArchiveList = { items: Archive[] };

type Conversation = {
  id: string;
  title?: string | null;
  members: Array<{
    userId: string;
    user: { id: string; displayName: string; username: string };
  }>;
};

export function ConversationArchivesExperience({
  currentUserId,
  onOpenConversation
}: {
  currentUserId: string;
  onOpenConversation?: (conversationId: string) => void;
}) {
  const { colors } = useAppearance();
  const [archives, setArchives] = useState<Archive[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    setArchives([]);
    setConversations([]);
    try {
      const [archiveData, conversationData] = await Promise.all([
        apiFetch<ArchiveList>('/conversation-archives'),
        apiFetch<Conversation[]>('/conversations')
      ]);
      setArchives(archiveData.items);
      setConversations(conversationData);
    } catch (cause) {
      setArchives([]);
      setConversations([]);
      setError(cause instanceof Error ? cause.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const names = useMemo(() => {
    return new Map(
      conversations.map((conversation) => {
        const peers = conversation.members.filter((member) => member.userId !== currentUserId);
        const label = conversation.title || peers.map((member) => member.user.displayName).join(', ') || 'Conversation';
        return [conversation.id, label] as const;
      })
    );
  }, [conversations, currentUserId]);

  const archivedIds = useMemo(
    () => new Set(archives.map((archive) => archive.conversationId)),
    [archives]
  );

  async function archive(conversationId: string) {
    setBusyId(conversationId);
    setError('');
    try {
      await apiFetch(`/conversation-archives/${encodeURIComponent(conversationId)}`, {
        method: 'PUT'
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Archivage impossible.');
    } finally {
      setBusyId(null);
    }
  }

  async function restore(conversationId: string) {
    setBusyId(conversationId);
    setError('');
    try {
      await apiFetch(`/conversation-archives/${encodeURIComponent(conversationId)}`, {
        method: 'DELETE'
      });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Restauration impossible.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.eyebrow, { color: colors.accent }]}>MESSAGERIE · ORGANISATION PRIVÉE</Text>
      <Text style={[styles.heading, { color: colors.text }]}>Conversations archivées</Text>
      <Text style={[styles.muted, { color: colors.muted }]}>
        Archiver ne quitte pas la conversation et ne coupe pas les notifications.
      </Text>

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      {loading ? <Text style={[styles.muted, { color: colors.muted }]}>Chargement…</Text> : null}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Archivées</Text>
      {archives.map((archiveItem) => (
        <View
          key={archiveItem.conversationId}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.cardCopy}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              {names.get(archiveItem.conversationId) ?? 'Conversation'}
            </Text>
            <Text style={[styles.small, { color: colors.muted }]}>Archivée le {new Date(archiveItem.archivedAt).toLocaleString()}</Text>
          </View>
          <View style={styles.actions}>
            {onOpenConversation ? (
              <Pressable
                onPress={() => onOpenConversation(archiveItem.conversationId)}
                style={[styles.secondary, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.text, fontWeight: '800' }}>Ouvrir</Text>
              </Pressable>
            ) : null}
            <Pressable
              disabled={busyId === archiveItem.conversationId}
              onPress={() => void restore(archiveItem.conversationId)}
              style={[
                styles.primary,
                { backgroundColor: colors.accent },
                busyId === archiveItem.conversationId && styles.disabled
              ]}
            >
              <Text style={{ color: colors.accentText, fontWeight: '900' }}>
                {busyId === archiveItem.conversationId ? 'Restauration…' : 'Restaurer'}
              </Text>
            </Pressable>
          </View>
        </View>
      ))}
      {!loading && !error && !archives.length ? <Text style={[styles.muted, { color: colors.muted }]}>Aucune conversation archivée.</Text> : null}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Conversations actives</Text>
      {conversations.filter((conversation) => !archivedIds.has(conversation.id)).map((conversation) => (
        <View
          key={conversation.id}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Pressable
            disabled={!onOpenConversation}
            onPress={() => onOpenConversation?.(conversation.id)}
            style={styles.cardCopy}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>{names.get(conversation.id)}</Text>
          </Pressable>
          <Pressable
            disabled={busyId === conversation.id}
            onPress={() => void archive(conversation.id)}
            style={[
              styles.secondary,
              { borderColor: colors.border },
              busyId === conversation.id && styles.disabled
            ]}
          >
            <Text style={{ color: colors.text, fontWeight: '800' }}>
              {busyId === conversation.id ? 'Archivage…' : 'Archiver'}
            </Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 44, gap: 12 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  heading: { fontSize: 29, fontWeight: '900' },
  muted: { fontSize: 14, lineHeight: 20 },
  error: { fontSize: 13, lineHeight: 19 },
  sectionTitle: { fontSize: 19, fontWeight: '900', marginTop: 8 },
  card: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  cardCopy: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 16, fontWeight: '900' },
  small: { fontSize: 11, lineHeight: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primary: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  secondary: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  disabled: { opacity: 0.45 }
});
