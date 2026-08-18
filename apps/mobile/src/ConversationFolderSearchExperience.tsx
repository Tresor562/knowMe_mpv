import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';

type Folder = { id: string; name: string; conversationIds: string[] };
type Conversation = {
  id: string;
  title?: string | null;
  members: Array<{ userId: string; user: { displayName: string; username: string } }>;
};

export function ConversationFolderSearchExperience({
  currentUserId,
  onOpenConversation
}: {
  currentUserId: string;
  onOpenConversation?: (conversationId: string) => void;
}) {
  const { colors } = useAppearance();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setError('');
    setLoading(true);
    setFolders([]);
    setConversations([]);

    Promise.all([
      apiFetch<{ items: Folder[] }>('/conversation-folders'),
      apiFetch<Conversation[]>('/conversations')
    ])
      .then(([folderData, conversationData]) => {
        if (!active) return;
        setFolders(folderData.items);
        setConversations(conversationData);
      })
      .catch((cause) => {
        if (!active) return;
        setFolders([]);
        setConversations([]);
        setError(cause instanceof Error ? cause.message : 'Chargement impossible.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [currentUserId]);

  const labels = useMemo(
    () =>
      new Map(
        conversations.map((conversation) => {
          const peers = conversation.members.filter((member) => member.userId !== currentUserId);
          const label =
            conversation.title ||
            peers.map((member) => member.user.displayName).join(', ') ||
            'Conversation';
          return [conversation.id, label] as const;
        })
      ),
    [conversations, currentUserId]
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return folders;
    return folders.filter(
      (folder) =>
        folder.name.toLocaleLowerCase().includes(normalized) ||
        folder.conversationIds.some((id) =>
          labels.get(id)?.toLocaleLowerCase().includes(normalized)
        )
    );
  }, [folders, labels, query]);

  const hasAuthoritativeResults = !loading && !error;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.eyebrow, { color: colors.accent }]}>DOSSIERS · RECHERCHE LOCALE</Text>
      <Text style={[styles.heading, { color: colors.text }]}>Retrouver un dossier</Text>
      <Text style={[styles.muted, { color: colors.muted }]}>Le terme saisi reste sur cet écran et n'est pas envoyé à l'API.</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Nom du dossier ou conversation…"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          styles.input,
          { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }
        ]}
      />
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      {loading ? <Text style={[styles.muted, { color: colors.muted }]}>Chargement…</Text> : null}
      {hasAuthoritativeResults ? (
        <Text style={[styles.muted, { color: colors.muted }]}>{filtered.length} résultat(s)</Text>
      ) : null}

      {hasAuthoritativeResults
        ? filtered.map((folder) => (
            <View
              key={folder.id}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.title, { color: colors.text }]}>{folder.name}</Text>
              <Text style={[styles.small, { color: colors.muted }]}>{folder.conversationIds.length} conversation(s)</Text>
              <View style={styles.list}>
                {folder.conversationIds.map((conversationId) => (
                  <Pressable
                    key={conversationId}
                    disabled={!onOpenConversation}
                    onPress={() => onOpenConversation?.(conversationId)}
                    style={({ pressed }) => [styles.item, pressed && styles.pressed]}
                  >
                    <Text style={{ color: colors.text }}>
                      {labels.get(conversationId) ?? 'Conversation'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))
        : null}

      {hasAuthoritativeResults && !filtered.length ? (
        <Text style={[styles.muted, { color: colors.muted }]}>Aucun dossier ne correspond.</Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 44, gap: 12 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  heading: { fontSize: 29, fontWeight: '900' },
  muted: { fontSize: 14, lineHeight: 20 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10 },
  error: { fontSize: 13, lineHeight: 19 },
  card: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 7 },
  title: { fontSize: 16, fontWeight: '900' },
  small: { fontSize: 11, lineHeight: 16 },
  list: { gap: 4, marginTop: 4 },
  item: { paddingVertical: 8 },
  pressed: { opacity: 0.72 }
});
