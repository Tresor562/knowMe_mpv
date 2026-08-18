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
type OptionalSource = Tool;

type OptionalAvailability = Record<OptionalSource, boolean>;

const availableByDefault: OptionalAvailability = {
  folders: true,
  archives: true,
  pins: true,
  drafts: true,
  saved: true
};

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
  const [availability, setAvailability] = useState<OptionalAvailability>(availableByDefault);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');
      setWarning('');
      setConversations([]);

      try {
        const conversationData = await apiFetch<Conversation[]>('/conversations');
        if (!active) return;
        setConversations(conversationData);

        const [folderResult, draftResult, archiveResult, pinResult, savedResult] = await Promise.allSettled([
          apiFetch<{ items: Folder[] }>('/conversation-folders'),
          apiFetch<{ items: Draft[] }>('/conversation-drafts'),
          apiFetch<{ items: Archive[] }>('/conversation-archives'),
          apiFetch<{ items: Pin[] }>('/conversation-pins'),
          apiFetch<{ items: SavedMessage[] }>('/saved-messages?limit=100')
        ]);
        if (!active) return;

        const nextAvailability: OptionalAvailability = {
          folders: folderResult.status === 'fulfilled',
          drafts: draftResult.status === 'fulfilled',
          archives: archiveResult.status === 'fulfilled',
          pins: pinResult.status === 'fulfilled',
          saved: savedResult.status === 'fulfilled'
        };

        setAvailability(nextAvailability);
        setFolders(folderResult.status === 'fulfilled' ? folderResult.value.items : []);
        setDrafts(draftResult.status === 'fulfilled' ? draftResult.value.items : []);
        setArchives(archiveResult.status === 'fulfilled' ? archiveResult.value.items : []);
        setPins(pinResult.status === 'fulfilled' ? pinResult.value.items : []);
        setSaved(savedResult.status === 'fulfilled' ? savedResult.value.items : []);

        if (Object.values(nextAvailability).some((available) => !available)) {
          setWarning(
            'Certaines informations personnelles sont momentanément indisponibles. Les autres états restent consultables.'
          );
        }
      } catch (cause) {
        if (!active) return;
        setConversations([]);
        setError(cause instanceof Error ? cause.message : 'Organisation indisponible.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [conversationId]);

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

  const unavailableTitle = 'Indisponible pour le moment';
  const cards: Array<{
    tool: Tool;
    eyebrow: string;
    title: string;
    detail?: string;
    available: boolean;
  }> = [
    {
      tool: 'folders',
      eyebrow: 'DOSSIER',
      title: availability.folders ? (folder ? `🗂️ ${folder.name}` : '🗂️ Aucun dossier') : unavailableTitle,
      available: availability.folders
    },
    {
      tool: 'archives',
      eyebrow: 'ARCHIVE',
      title: availability.archives ? (archive ? '📦 Archivée' : '📬 Active') : unavailableTitle,
      detail: availability.archives && archive ? `Depuis ${new Date(archive.archivedAt).toLocaleString()}` : undefined,
      available: availability.archives
    },
    {
      tool: 'pins',
      eyebrow: 'ÉPINGLE',
      title: availability.pins
        ? pin
          ? `📌 Épinglée · position ${pin.position + 1}`
          : '📌 Non épinglée'
        : unavailableTitle,
      detail: availability.pins
        ? pin
          ? `Depuis ${new Date(pin.pinnedAt).toLocaleString()}`
          : 'Raccourci privé non activé pour cette conversation.'
        : undefined,
      available: availability.pins
    },
    {
      tool: 'drafts',
      eyebrow: 'BROUILLON',
      title: availability.drafts ? (draft ? `📝 v${draft.version}` : '📝 Aucun brouillon') : unavailableTitle,
      detail: availability.drafts && draft
        ? draft.content.length > 120
          ? `${draft.content.slice(0, 117)}…`
          : draft.content || 'Brouillon vide'
        : undefined,
      available: availability.drafts
    },
    {
      tool: 'saved',
      eyebrow: 'MESSAGES ENREGISTRÉS',
      title: availability.saved ? `🔖 ${savedCount}` : unavailableTitle,
      detail: availability.saved
        ? 'Références personnelles encore accessibles dans cette conversation.'
        : undefined,
      available: availability.saved
    }
  ];

  const authorityReady = !loading && !error && Boolean(conversation);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.eyebrow, { color: colors.accent }]}>CONVERSATION · ORGANISATION PRIVÉE</Text>
      <Text style={[styles.heading, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.muted, { color: colors.muted }]}>Vue en lecture seule de tes outils personnels pour cette conversation.</Text>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      {loading ? <Text style={[styles.muted, { color: colors.muted }]}>Chargement…</Text> : null}
      {!loading && !error && !conversation ? (
        <Text style={[styles.error, { color: colors.danger }]}>Cette conversation n’est plus accessible.</Text>
      ) : null}
      {warning && authorityReady ? <Text style={[styles.warning, { color: colors.muted }]}>{warning}</Text> : null}

      {authorityReady
        ? cards.map((card) => (
            <Pressable
              key={card.tool}
              disabled={!onOpenTool || !card.available}
              onPress={() => onOpenTool?.(card.tool)}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
                !card.available && styles.unavailable,
                pressed && card.available && styles.pressed
              ]}
            >
              <Text style={[styles.label, { color: colors.muted }]}>{card.eyebrow}</Text>
              <Text style={[styles.title, { color: colors.text }]}>{card.title}</Text>
              {card.detail ? <Text style={[styles.muted, { color: colors.muted }]}>{card.detail}</Text> : null}
            </Pressable>
          ))
        : null}

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
  warning: { fontSize: 13, lineHeight: 19, fontStyle: 'italic' },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 6 },
  pressed: { opacity: 0.78 },
  unavailable: { opacity: 0.58 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  title: { fontSize: 18, fontWeight: '900' },
  small: { fontSize: 12, lineHeight: 17 }
});
