import { useCallback, useState } from 'react';
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
import { ConversationArchiveTimelineExperience } from './ConversationArchiveTimelineExperience';
import { ConversationArchivesExperience } from './ConversationArchivesExperience';
import { ConversationDraftsExperience } from './ConversationDraftsExperience';
import { ConversationFolderSearchExperience } from './ConversationFolderSearchExperience';
import { ConversationFoldersExperience } from './ConversationFoldersExperience';
import {
  ConversationOrganizationDetail,
  type ConversationOrganizationTool
} from './ConversationOrganizationDetail';
import { ConversationPinsExperience } from './ConversationPinsExperience';
import { RealtimeMessagesPanel } from './RealtimeMessagesPanel';
import { SavedMessagesExperience } from './SavedMessagesExperience';

type Conversation = {
  id: string;
  title?: string | null;
  members: Array<{
    userId: string;
    user: { displayName: string; username: string };
  }>;
};

type OrganizationTool = 'folders' | 'search' | 'archives' | 'archiveTimeline' | 'pins' | 'saved' | 'drafts';

type Props = {
  userId: string;
  refreshing: boolean;
  setRefreshing: (value: boolean) => void;
};

const organizationTools: Array<{
  id: OrganizationTool;
  title: string;
  description: string;
}> = [
  {
    id: 'folders',
    title: '🗂️ Dossiers privés',
    description: 'Classe et déplace tes conversations dans tes dossiers personnels.'
  },
  {
    id: 'search',
    title: '🔎 Recherche dans les dossiers',
    description: 'Retrouve localement un dossier ou une conversation déjà accessible.'
  },
  {
    id: 'archives',
    title: '📦 Archives personnelles',
    description: 'Archive ou restaure une conversation sans modifier les droits du groupe.'
  },
  {
    id: 'archiveTimeline',
    title: '🕓 Chronologie des archives',
    description: 'Parcours tes archives personnelles par période sans modifier leur état.'
  },
  {
    id: 'pins',
    title: '📌 Conversations épinglées',
    description: 'Gère tes raccourcis privés et leur ordre personnel.'
  },
  {
    id: 'saved',
    title: '🔖 Messages enregistrés',
    description: 'Retrouve et retire les messages que tu as enregistrés et qui restent accessibles.'
  },
  {
    id: 'drafts',
    title: '✍️ Brouillons synchronisés',
    description: 'Retrouve tes brouillons personnels et rouvre leur conversation sans envoyer de message.'
  }
];

export function MessagesOrganizationExperience({
  userId,
  refreshing,
  setRefreshing
}: Props) {
  const { colors } = useAppearance();
  const [organizationOpen, setOrganizationOpen] = useState(false);
  const [organizationTool, setOrganizationTool] = useState<OrganizationTool | null>(null);
  const [organizationConversationId, setOrganizationConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setConversations(await apiFetch<Conversation[]>('/conversations'));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Conversations indisponibles.');
    } finally {
      setLoading(false);
    }
  }, []);

  function openOrganization() {
    setOrganizationConversationId(null);
    setOrganizationTool(null);
    setOrganizationOpen(true);
    void loadConversations();
  }

  function closeOrganization() {
    setOrganizationConversationId(null);
    setOrganizationTool(null);
    setOrganizationOpen(false);
  }

  function openConversationFromTool(conversationId: string) {
    setOrganizationTool(null);
    setOrganizationConversationId(conversationId);
  }

  function openToolFromConversation(tool: ConversationOrganizationTool) {
    setOrganizationConversationId(null);
    setOrganizationTool(tool);
  }

  const rootStyle = [styles.root, { backgroundColor: colors.background }];
  const secondaryButtonStyle = [styles.secondaryButton, { borderColor: colors.border }];
  const secondaryTextStyle = [styles.secondaryText, { color: colors.text }];
  const mutedStyle = [styles.muted, { color: colors.muted }];
  const cardStyle = [
    styles.card,
    { backgroundColor: colors.surface, borderColor: colors.border }
  ];

  if (organizationConversationId) {
    return (
      <View style={rootStyle}>
        <View style={styles.toolbar}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setOrganizationConversationId(null)}
            style={({ pressed }) => [secondaryButtonStyle, pressed && styles.pressed]}
          >
            <Text style={secondaryTextStyle}>← Organisation</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={closeOrganization}
            style={({ pressed }) => [secondaryButtonStyle, pressed && styles.pressed]}
          >
            <Text style={secondaryTextStyle}>Messages</Text>
          </Pressable>
        </View>
        <ConversationOrganizationDetail
          conversationId={organizationConversationId}
          currentUserId={userId}
          onOpenTool={openToolFromConversation}
        />
      </View>
    );
  }

  if (organizationTool) {
    return (
      <View style={rootStyle}>
        <View style={styles.toolbarPadded}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setOrganizationTool(null)}
            style={({ pressed }) => [secondaryButtonStyle, pressed && styles.pressed]}
          >
            <Text style={secondaryTextStyle}>← Organisation</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={closeOrganization}
            style={({ pressed }) => [secondaryButtonStyle, pressed && styles.pressed]}
          >
            <Text style={secondaryTextStyle}>Messages</Text>
          </Pressable>
        </View>

        {organizationTool === 'folders' ? (
          <ConversationFoldersExperience
            currentUserId={userId}
            onOpenConversation={openConversationFromTool}
          />
        ) : null}
        {organizationTool === 'search' ? (
          <ConversationFolderSearchExperience
            currentUserId={userId}
            onOpenConversation={openConversationFromTool}
          />
        ) : null}
        {organizationTool === 'archives' ? (
          <ConversationArchivesExperience
            currentUserId={userId}
            onOpenConversation={openConversationFromTool}
          />
        ) : null}
        {organizationTool === 'archiveTimeline' ? (
          <ConversationArchiveTimelineExperience
            currentUserId={userId}
            onOpenConversation={openConversationFromTool}
          />
        ) : null}
        {organizationTool === 'pins' ? (
          <ConversationPinsExperience
            currentUserId={userId}
            onOpenConversation={openConversationFromTool}
          />
        ) : null}
        {organizationTool === 'saved' ? <SavedMessagesExperience /> : null}
        {organizationTool === 'drafts' ? (
          <ConversationDraftsExperience
            currentUserId={userId}
            onOpenConversation={openConversationFromTool}
          />
        ) : null}
      </View>
    );
  }

  if (organizationOpen) {
    return (
      <ScrollView style={rootStyle} contentContainerStyle={styles.content}>
        <View style={styles.toolbar}>
          <Pressable
            accessibilityRole="button"
            onPress={closeOrganization}
            style={({ pressed }) => [secondaryButtonStyle, pressed && styles.pressed]}
          >
            <Text style={secondaryTextStyle}>← Messages</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={loading}
            onPress={() => void loadConversations()}
            style={({ pressed }) => [
              secondaryButtonStyle,
              (pressed || loading) && styles.pressed
            ]}
          >
            <Text style={secondaryTextStyle}>Actualiser</Text>
          </Pressable>
        </View>

        <Text style={[styles.eyebrow, { color: colors.accent }]}>ORGANISATION PRIVÉE</Text>
        <Text style={[styles.heading, { color: colors.text }]}>Organiser mes conversations</Text>
        <Text style={mutedStyle}>
          Ces outils restent personnels : ils n’ajoutent aucun droit d’accès et ne modifient pas les conversations des autres membres.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Outils personnels</Text>
        {organizationTools.map((tool) => (
          <Pressable
            accessibilityRole="button"
            key={tool.id}
            onPress={() => setOrganizationTool(tool.id)}
            style={({ pressed }) => [cardStyle, pressed && styles.pressed]}
          >
            <Text style={[styles.cardTitle, { color: colors.text }]}>{tool.title}</Text>
            <Text style={mutedStyle}>{tool.description}</Text>
          </Pressable>
        ))}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Par conversation</Text>
        <Text style={mutedStyle}>
          Ouvre la vue personnelle d’une conversation pour retrouver son dossier, son état d’archive, son brouillon et ses messages enregistrés.
        </Text>

        {loading ? <ActivityIndicator color={colors.accent} /> : null}
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

        {conversations.map((conversation) => {
          const others = conversation.members.filter((member) => member.userId !== userId);
          const title = conversation.title || others
            .map((member) => member.user.displayName)
            .join(', ') || 'Conversation';

          return (
            <Pressable
              accessibilityRole="button"
              key={conversation.id}
              onPress={() => setOrganizationConversationId(conversation.id)}
              style={({ pressed }) => [cardStyle, pressed && styles.pressed]}
            >
              <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
              <Text style={mutedStyle}>🗂️ Voir l’organisation privée</Text>
            </Pressable>
          );
        })}

        {!loading && !error && conversations.length === 0 ? (
          <Text style={mutedStyle}>Aucune conversation accessible.</Text>
        ) : null}
      </ScrollView>
    );
  }

  return (
    <View style={rootStyle}>
      <View style={styles.entrypoint}>
        <Pressable
          accessibilityRole="button"
          onPress={openOrganization}
          style={({ pressed }) => [
            styles.organizationButton,
            { borderColor: colors.border },
            pressed && styles.pressed
          ]}
        >
          <Text style={[styles.organizationButtonText, { color: colors.text }]}>🗂️ Organisation privée</Text>
        </Pressable>
      </View>
      <View style={styles.messages}>
        <RealtimeMessagesPanel
          userId={userId}
          refreshing={refreshing}
          setRefreshing={setRefreshing}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  messages: { flex: 1 },
  entrypoint: { paddingHorizontal: 20, paddingTop: 10 },
  organizationButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: 'center'
  },
  organizationButtonText: { fontWeight: '800' },
  content: { padding: 20, paddingBottom: 40, gap: 12 },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  toolbarPadded: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingHorizontal: 20, paddingTop: 14 },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 13
  },
  secondaryText: { fontWeight: '800' },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  heading: { fontSize: 28, fontWeight: '900' },
  sectionTitle: { fontSize: 16, fontWeight: '900', marginTop: 6 },
  muted: { lineHeight: 20 },
  error: { lineHeight: 20 },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 6
  },
  cardTitle: { fontSize: 17, fontWeight: '800' },
  pressed: { opacity: 0.72 }
});
