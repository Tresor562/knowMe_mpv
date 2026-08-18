import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';

type Folder = {
  id: string;
  name: string;
  position: number;
  conversationIds: string[];
};

type FolderList = { items: Folder[] };

type Conversation = {
  id: string;
  title?: string | null;
  isGroup: boolean;
  members: Array<{
    userId: string;
    user: { id: string; displayName: string; username: string };
  }>;
};

export function ConversationFoldersExperience({
  currentUserId,
  onOpenConversation
}: {
  currentUserId: string;
  onOpenConversation?: (conversationId: string) => void;
}) {
  const { colors } = useAppearance();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [authorityValid, setAuthorityValid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const clearAuthority = useCallback(() => {
    setFolders([]);
    setConversations([]);
    setAuthorityValid(false);
  }, []);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    clearAuthority();
    try {
      const [folderData, conversationData] = await Promise.all([
        apiFetch<FolderList>('/conversation-folders'),
        apiFetch<Conversation[]>('/conversations')
      ]);
      setFolders(folderData.items);
      setConversations(conversationData);
      setAuthorityValid(true);
    } catch (cause) {
      clearAuthority();
      setError(cause instanceof Error ? cause.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, [clearAuthority]);

  useEffect(() => {
    void load();
  }, [load, currentUserId]);

  const conversationNames = useMemo(() => {
    return new Map(
      conversations.map((conversation) => {
        const peers = conversation.members.filter((member) => member.userId !== currentUserId);
        const label = conversation.title || peers.map((member) => member.user.displayName).join(', ') || 'Conversation';
        return [conversation.id, label] as const;
      })
    );
  }, [conversations, currentUserId]);

  function invalidateAuthority(message: string) {
    clearAuthority();
    setError(message);
  }

  async function createFolder() {
    const normalized = name.trim();
    if (!authorityValid || !normalized || busy) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch('/conversation-folders', {
        method: 'POST',
        body: JSON.stringify({ name: normalized, position: folders.length })
      });
      setName('');
      await load();
    } catch (cause) {
      invalidateAuthority(
        cause instanceof Error
          ? cause.message
          : 'Création impossible. Recharge les dossiers avant de réessayer.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function assign(folderId: string, conversationId: string) {
    if (!authorityValid || busy) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch(
        `/conversation-folders/${encodeURIComponent(folderId)}/conversations/${encodeURIComponent(conversationId)}`,
        { method: 'PUT' }
      );
      await load();
    } catch (cause) {
      invalidateAuthority(
        cause instanceof Error
          ? cause.message
          : 'Classement impossible. Recharge les dossiers avant de réessayer.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function unassign(conversationId: string) {
    if (!authorityValid || busy) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/conversation-folders/assignments/${encodeURIComponent(conversationId)}`, {
        method: 'DELETE'
      });
      await load();
    } catch (cause) {
      invalidateAuthority(
        cause instanceof Error
          ? cause.message
          : 'Retrait impossible. Recharge les dossiers avant de réessayer.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeFolder(folderId: string) {
    if (!authorityValid || busy) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/conversation-folders/${encodeURIComponent(folderId)}`, { method: 'DELETE' });
      await load();
    } catch (cause) {
      invalidateAuthority(
        cause instanceof Error
          ? cause.message
          : 'Suppression impossible. Recharge les dossiers avant de réessayer.'
      );
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
      <Text style={[styles.eyebrow, { color: colors.accent }]}>MESSAGERIE · ORGANISATION PRIVÉE</Text>
      <Text style={[styles.heading, { color: colors.text }]}>Dossiers de conversations</Text>
      <Text style={[styles.muted, { color: colors.muted }]}>Ton classement reste privé et ne change jamais les membres d'une conversation.</Text>

      {authorityValid ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={40}
            placeholder="Nouveau dossier"
            placeholderTextColor={colors.muted}
            editable={!busy}
            style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
          />
          <Pressable
            disabled={busy || !name.trim()}
            onPress={() => void createFolder()}
            style={[styles.primary, { backgroundColor: colors.accent }, (busy || !name.trim()) && styles.disabled]}
          >
            <Text style={{ color: colors.accentText, fontWeight: '900' }}>Créer</Text>
          </Pressable>
        </View>
      ) : null}

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      {loading ? <Text style={[styles.muted, { color: colors.muted }]}>Chargement…</Text> : null}
      {!loading && !authorityValid ? (
        <Pressable
          disabled={busy}
          onPress={() => void load()}
          style={[styles.secondary, { borderColor: colors.border, alignSelf: 'flex-start' }, busy && styles.disabled]}
        >
          <Text style={{ color: colors.text, fontWeight: '800' }}>Recharger</Text>
        </Pressable>
      ) : null}

      {authorityValid ? folders.map((folder) => {
        const assigned = new Set(folders.flatMap((candidate) => candidate.conversationIds));
        const unassigned = conversations.filter((conversation) => !assigned.has(conversation.id));
        return (
          <View key={folder.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.folderHeader}>
              <View style={styles.folderCopy}>
                <Text style={[styles.folderName, { color: colors.text }]}>{folder.name}</Text>
                <Text style={[styles.small, { color: colors.muted }]}>{folder.conversationIds.length} conversation(s)</Text>
              </View>
              <Pressable
                disabled={busy}
                onPress={() => void removeFolder(folder.id)}
                style={[styles.secondary, { borderColor: colors.border }, busy && styles.disabled]}
              >
                <Text style={{ color: colors.text, fontWeight: '800' }}>Supprimer</Text>
              </Pressable>
            </View>

            {folder.conversationIds.map((conversationId) => (
              <View key={conversationId} style={styles.conversationRow}>
                <Pressable
                  disabled={!onOpenConversation || busy}
                  onPress={() => onOpenConversation?.(conversationId)}
                  style={[styles.conversationLabel, busy && styles.disabled]}
                >
                  <Text style={{ color: colors.text, fontWeight: '800' }}>
                    {conversationNames.get(conversationId) ?? 'Conversation'}
                  </Text>
                </Pressable>
                <Pressable
                  disabled={busy}
                  onPress={() => void unassign(conversationId)}
                  style={[styles.secondary, { borderColor: colors.border }, busy && styles.disabled]}
                >
                  <Text style={{ color: colors.text }}>Retirer</Text>
                </Pressable>
              </View>
            ))}

            {unassigned.length ? (
              <View style={styles.availableList}>
                <Text style={[styles.small, { color: colors.muted }]}>Ajouter une conversation :</Text>
                {unassigned.map((conversation) => (
                  <Pressable
                    key={conversation.id}
                    disabled={busy}
                    onPress={() => void assign(folder.id, conversation.id)}
                    style={[styles.assignment, { borderColor: colors.border }, busy && styles.disabled]}
                  >
                    <Text style={{ color: colors.text }}>{conversationNames.get(conversation.id)}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        );
      }) : null}

      {authorityValid && !folders.length ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.folderName, { color: colors.text }]}>Aucun dossier</Text>
          <Text style={[styles.muted, { color: colors.muted }]}>Crée ton premier dossier pour organiser tes conversations.</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 44, gap: 12 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  heading: { fontSize: 29, fontWeight: '900' },
  muted: { fontSize: 14, lineHeight: 20 },
  card: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 10 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11 },
  primary: { borderRadius: 13, paddingHorizontal: 14, paddingVertical: 11, alignItems: 'center' },
  secondary: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8 },
  disabled: { opacity: 0.45 },
  error: { fontSize: 13, lineHeight: 19 },
  folderHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' },
  folderCopy: { flex: 1 },
  folderName: { fontSize: 17, fontWeight: '900' },
  small: { fontSize: 12, lineHeight: 17 },
  conversationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  conversationLabel: { flex: 1, paddingVertical: 8 },
  availableList: { gap: 7, marginTop: 4 },
  assignment: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 9 }
});
