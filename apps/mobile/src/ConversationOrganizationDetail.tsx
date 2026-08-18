import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';

type Folder = { id: string; name: string; conversationIds: string[] };
type Draft = { conversationId: string; content: string; version: number; updatedAt: string };
type Archive = { conversationId: string; archivedAt: string };
type Pin = { conversationId: string; pinnedAt: string; position: number };
type SavedMessage = {
  messageId: string;
  savedAt: string;
  message: { id: string; conversationId: string; content: string };
};
type Conversation = {
  id: string;
  title?: string | null;
  members: Array<{ userId: string; user: { displayName: string; username: string } }>;
};

type Tool = 'folders' | 'archives' | 'pins' | 'drafts' | 'saved';

export function ConversationOrganizationDetail({
  conversationId,
  currentUserId,
  onOpenTool
}: {
  conversationId: string;
  currentUserId: string;
  onOpenTool?: (tool: Tool) => void;
}) {
  const { colors } = useAppearance();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [archives, setArchives] = useState<Archive[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [saved, setSaved] = useState<SavedMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      apiFetch<{ items: Folder[] }>('/conversation-folders'),
      apiFetch<{ items: Draft[] }>('/conversation-drafts'),
      apiFetch<{ items: Archive[] }>('/conversation-archives'),
      apiFetch<{ items: Pin[] }>('/conversation-pins'),
      apiFetch<{ items: SavedMessage[] }>('/saved-messages?limit=100'),
      apiFetch<Conversation[]>('/conversations')
    ])
      .then(([folderData, draftData, archiveData, pinData, savedData, conversationData]) => {
        if (!active) return;
        setFolders(folderData.items);
        setDrafts(draftData.items);
        setArchives(archiveData.items);
        setPins(pinData.items);
        setSaved(savedData.items);
        setConversations(conversationData);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Organisation indisponible.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const conversation = conversations.find((item) => item.id === conversationId);
  const title = useMemo(() => {
    if (!conversation) return 'Conversation';
    const peers = conversation.members.filter((member) => member.userId !== currentUserId);
    return conversation.title || peers.map((member) => member.user.displayName).join(', ') || 'Conversation';
  }, [conversation, currentUserId]);

  const folder = folders.find((item) => item.conversationIds.includes(conversationId));
  const draft = drafts.find((item) => item.conversationId === conversationId);
  const archive = archives.find((item) => item.conversationId === conversationId);
  const pin = pins.find((item) => item.conversationId === conversationId);
  const savedCount = saved.filter((item) => item.message.conversationId === conversationId).length;

  const cards: Array<{
    tool: Tool;
    eyebrow: string;
    title: string;
    detail?: string;
  }> = [
    {
      tool: 'folders',
      eyebrow: 'DOSSIER',
      title: folder ? `🗂️ ${folder.name}` : '🗂️ Aucun dossier'
    },
    {
      tool: 'archives',
      eyebrow: 'ARCHIVE',
      title: archive ? '📦 Archivée' : '📬 Active',
      detail: archive ? `Depuis ${new Date(archive.archivedAt).toLocaleString()}` : undefined
    },
    {
      tool: 'pins',
      eyebrow: 'ÉPINGLE',
      title: pin ? `📌 Épinglée · position ${pin.position + 1}` : '📌 Non épinglée',
      detail: pin ? `Depuis ${new Date(pin.pinnedAt).toLocaleString()}` : 'Raccourci privé non activé pour cette conversation.'
    },
    {
      tool: 'drafts',
      eyebrow: 'BROUILLON',
      title: draft ? `📝 v${draft.version}` : '📝 Aucun brouillon',
      detail: draft
        ? draft.content.length > 120
          ? `${draft.content.slice(0, 117)}…`
          : draft.content || 'Brouillon vide'
        : undefined
    },
    {
      tool: 'saved',
      eyebrow: 'MESSAGES ENREGISTRÉS',
      title: `🔖 ${savedCount}`,
      detail: 'Références personnelles encore accessibles dans cette conversation.'
    }
  ];

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.eyebrow, { color: colors.accent }]}>CONVERSATION · ORGANISATION PRIVÉE</Text>
      <Text style={[styles.heading, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.muted, { color: colors.muted }]}>Vue en lecture seule de tes outils personnels pour cette conversation.</Text>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      {loading ? <Text style={[styles.muted, { color: colors.muted }]}>Chargement…</Text> : null}

      {cards.map((card) => (
        <Pressable
          key={card.tool}
          disabled={!onOpenTool}
          onPress={() => onOpenTool?.(card.tool)}
          style={({ pressed }) => [
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed
          ]}
        >
          <Text style={[styles.label, { color: colors.muted }]}>{card.eyebrow}</Text>
          <Text style={[styles.title, { color: colors.text }]}>{card.title}</Text>
          {card.detail ? <Text style={[styles.muted, { color: colors.muted }]}>{card.detail}</Text> : null}
        </Pressable>
      ))}

      <Text style={[styles.small, { color: colors.muted }]}>
        Cette vue n'accorde aucun droit supplémentaire : chaque donnée affichée vient des API personnelles déjà autorisées.
      </Text>
    </ScrollView>
  );
}

export type ConversationOrganizationTool = Tool;

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 44, gap: 12 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  heading: { fontSize: 29, fontWeight: '900' },
  muted: { fontSize: 14, lineHeight: 20 },
  error: { fontSize: 13, lineHeight: 19 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 6 },
  pressed: { opacity: 0.78 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  title: { fontSize: 18, fontWeight: '900' },
  small: { fontSize: 12, lineHeight: 17 }
});
