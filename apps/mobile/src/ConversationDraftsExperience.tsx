import { useCallback, useEffect, useMemo, useState } from 'react';
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

type ConversationDraft = {
  userId: string;
  conversationId: string;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

type ConversationDraftList = { items: ConversationDraft[] };

type Conversation = {
  id: string;
  title?: string | null;
  members: Array<{
    userId: string;
    user: { displayName: string; username: string };
  }>;
};

export function ConversationDraftsExperience({
  currentUserId,
  onOpenConversation
}: {
  currentUserId: string;
  onOpenConversation: (conversationId: string) => void;
}) {
  const { colors } = useAppearance();
  const [drafts, setDrafts] = useState<ConversationDraft[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [draftResponse, conversationResponse] = await Promise.all([
        apiFetch<ConversationDraftList>('/conversation-drafts'),
        apiFetch<Conversation[]>('/conversations')
      ]);
      setDrafts(draftResponse.items.filter((draft) => draft.content.trim().length > 0));
      setConversations(conversationResponse);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Brouillons indisponibles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const conversationById = useMemo(
    () => new Map(conversations.map((conversation) => [conversation.id, conversation])),
    [conversations]
  );

  function conversationTitle(conversationId: string) {
    const conversation = conversationById.get(conversationId);
    if (!conversation) return 'Conversation';
    if (conversation.title) return conversation.title;
    const others = conversation.members.filter((member) => member.userId !== currentUserId);
    return others.map((member) => member.user.displayName).join(', ') || 'Conversation';
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>BROUILLONS PERSONNELS</Text>
          <Text style={[styles.heading, { color: colors.text }]}>Reprendre un message</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={() => void load()}
          style={({ pressed }) => [
            styles.refresh,
            { borderColor: colors.border },
            (pressed || loading) && styles.pressed
          ]}
        >
          <Text style={{ color: colors.text, fontWeight: '800' }}>Actualiser</Text>
        </Pressable>
      </View>

      <Text style={[styles.muted, { color: colors.muted }]}>Les brouillons restent privés à ton compte. Ouvrir une conversation ne modifie aucun droit d’accès.</Text>

      {loading ? <ActivityIndicator color={colors.accent} /> : null}
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      {!loading && !error && drafts.length === 0 ? (
        <Text style={[styles.muted, { color: colors.muted }]}>Aucun brouillon enregistré.</Text>
      ) : null}

      {drafts.map((draft) => (
        <Pressable
          accessibilityRole="button"
          key={draft.conversationId}
          onPress={() => onOpenConversation(draft.conversationId)}
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed
          ]}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {conversationTitle(draft.conversationId)}
          </Text>
          <Text numberOfLines={3} style={[styles.preview, { color: colors.muted }]}>
            {draft.content}
          </Text>
          <Text style={[styles.meta, { color: colors.muted }]}>v{draft.version} · modifié {new Date(draft.updatedAt).toLocaleString()}</Text>
          <Text style={[styles.open, { color: colors.accent }]}>Ouvrir le brouillon →</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 12 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  headingCopy: { flex: 1 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  heading: { fontSize: 24, fontWeight: '900', marginTop: 4 },
  refresh: { borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 9 },
  muted: { lineHeight: 20 },
  error: { lineHeight: 20 },
  card: { borderWidth: 1, borderRadius: 18, padding: 15, gap: 7 },
  cardTitle: { fontSize: 17, fontWeight: '900' },
  preview: { lineHeight: 19 },
  meta: { fontSize: 11 },
  open: { fontSize: 13, fontWeight: '900' },
  pressed: { opacity: 0.72 }
});
