import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';

type Archive = { conversationId: string; archivedAt: string };
type Conversation = {
  id: string;
  title?: string | null;
  members: Array<{ userId: string; user: { displayName: string } }>;
};
type GroupKey = 'recent' | 'week' | 'older';

const GROUP_COPY: Record<GroupKey, string> = {
  recent: 'Dernières 24 heures',
  week: '7 derniers jours',
  older: 'Plus ancien'
};

export function ConversationArchiveTimelineExperience({
  currentUserId,
  onOpenConversation
}: {
  currentUserId: string;
  onOpenConversation?: (conversationId: string) => void;
}) {
  const { colors } = useAppearance();
  const [archives, setArchives] = useState<Archive[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch<{ items: Archive[] }>('/conversation-archives'),
      apiFetch<Conversation[]>('/conversations')
    ])
      .then(([archiveData, conversationData]) => {
        if (!active) return;
        setArchives(archiveData.items);
        setConversations(conversationData);
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

  const names = useMemo(
    () =>
      new Map(
        conversations.map((conversation) => {
          const peers = conversation.members.filter((member) => member.userId !== currentUserId);
          const name =
            conversation.title ||
            peers.map((member) => member.user.displayName).join(', ') ||
            'Conversation';
          return [conversation.id, name] as const;
        })
      ),
    [conversations, currentUserId]
  );

  const groups = useMemo(() => {
    const now = Date.now();
    const result: Record<GroupKey, Archive[]> = { recent: [], week: [], older: [] };
    for (const archive of archives) {
      const age = now - new Date(archive.archivedAt).getTime();
      if (age <= 24 * 60 * 60 * 1000) result.recent.push(archive);
      else if (age <= 7 * 24 * 60 * 60 * 1000) result.week.push(archive);
      else result.older.push(archive);
    }
    return result;
  }, [archives]);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.eyebrow, { color: colors.accent }]}>ARCHIVES · TIMELINE PRIVÉE</Text>
      <Text style={[styles.heading, { color: colors.text }]}>Chronologie des archives</Text>
      <Text style={[styles.muted, { color: colors.muted }]}>Les périodes sont calculées localement et ne modifient aucune archive.</Text>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      {loading ? <Text style={[styles.muted, { color: colors.muted }]}>Chargement…</Text> : null}

      {(['recent', 'week', 'older'] as GroupKey[]).map((key) => (
        <View key={key} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{GROUP_COPY[key]} ({groups[key].length})</Text>
          {groups[key].map((archive) => (
            <Pressable
              key={archive.conversationId}
              disabled={!onOpenConversation}
              onPress={() => onOpenConversation?.(archive.conversationId)}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.pressed
              ]}
            >
              <Text style={[styles.title, { color: colors.text }]}>{names.get(archive.conversationId) ?? 'Conversation'}</Text>
              <Text style={[styles.small, { color: colors.muted }]}>Archivée le {new Date(archive.archivedAt).toLocaleString()}</Text>
            </Pressable>
          ))}
          {!groups[key].length ? <Text style={[styles.muted, { color: colors.muted }]}>Aucune archive dans cette période.</Text> : null}
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
  section: { gap: 8, marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  card: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 4 },
  pressed: { opacity: 0.75 },
  title: { fontSize: 15, fontWeight: '900' },
  small: { fontSize: 11, lineHeight: 16 }
});
