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
import { ConversationArchivesExperience } from './ConversationArchivesExperience';
import { ConversationDraftsExperience } from './ConversationDraftsExperience';
import { ConversationFolderSearchExperience } from './ConversationFolderSearchExperience';
import { ConversationFoldersExperience } from './ConversationFoldersExperience';
import { ConversationOrganizationDetail } from './ConversationOrganizationDetail';
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

type OrganizationTool = 'folders' | 'search' | 'archives' | 'pins' | 'saved' | 'drafts';

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

  if (organizationConversationId) {
    return (
      <View style={styles.root}>
        <View style={styles.toolbar}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setOrganizationConversationId(null)}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>← Organisation</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={closeOrganization}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>Messages</Text>
          </Pressable>
        </View>
        <ConversationOrganizationDetail
          conversationId={organizationConversationId}
          currentUserId={userId}
        />
      </View>
    );
  }

  if (organizationTool) {
    return (
      <View style={styles.root}>
        <View style={styles.toolbarPadded}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setOrganizationTool(null)}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>← Organisation</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={closeOrganization}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>Messages</Text>
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
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <View style={styles.toolbar}>
          <Pressable
            accessibilityRole="button"
            onPress={closeOrganization}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          >
            <Text style={styles.secondaryText}>← Messages</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={loading}
            onPress={() => void loadConversations()}
            style={({ pressed }) => [
              styles.secondaryButton,
              (pressed || loading) && styles.pressed
            ]}
          >
            <Text style={styles.secondaryText}>Actualiser</Text>
          </Pressable>
        </View>

        <Text style={styles.eyebrow}>ORGANISATION PRIVÉE</Text>
        <Text style={styles.heading}>Organiser mes conversations</Text>
        <Text style={styles.muted}>
          Ces outils restent personnels : ils n’ajoutent aucun droit d’accès et ne modifient pas les conversations des autres membres.
        </Text>

        <Text style={styles.sectionTitle}>Outils personnels</Text>
        {organizationTools.map((tool) => (
          <Pressable
            accessibilityRole="button"
            key={tool.id}
            onPress={() => setOrganizationTool(tool.id)}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <Text style={styles.cardTitle}>{tool.title}</Text>
            <Text style={styles.muted}>{tool.description}</Text>
          </Pressable>
        ))}

        <Text style={styles.sectionTitle}>Par conversation</Text>
        <Text style={styles.muted}>
          Ouvre la vue personnelle d’une conversation pour retrouver son dossier, son état d’archive, son brouillon et ses messages enregistrés.
        </Text>

        {loading ? <ActivityIndicator color="#45e6bd" /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

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
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <Text style={styles.cardTitle}>{title}</Text>
              <Text style={styles.muted}>🗂️ Voir l’organisation privée</Text>
            </Pressable>
          );
        })}

        {!loading && !error && conversations.length === 0 ? (
          <Text style={styles.muted}>Aucune conversation accessible.</Text>
        ) : null}
      </ScrollView>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.entrypoint}>
        <Pressable
          accessibilityRole="button"
          onPress={openOrganization}
          style={({ pressed }) => [styles.organizationButton, pressed && styles.pressed]}
        >
          <Text style={styles.organizationButtonText}>🗂️ Organisation privée</Text>
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
  root: { flex: 1, backgroundColor: '#071410' },
  messages: { flex: 1 },
  entrypoint: { paddingHorizontal: 20, paddingTop: 10 },
  organizationButton: {
    borderColor: '#315449',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: 'center'
  },
  organizationButtonText: { color: '#d9ebe4', fontWeight: '800' },
  content: { padding: 20, paddingBottom: 40, gap: 12 },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  toolbarPadded: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingHorizontal: 20, paddingTop: 14 },
  secondaryButton: {
    borderColor: '#315449',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 13
  },
  secondaryText: { color: '#d9ebe4', fontWeight: '800' },
  eyebrow: { color: '#45e6bd', fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  heading: { color: '#f4fff9', fontSize: 28, fontWeight: '900' },
  sectionTitle: { color: '#d9ebe4', fontSize: 16, fontWeight: '900', marginTop: 6 },
  muted: { color: '#91a79e', lineHeight: 20 },
  error: { color: '#ff8f86', lineHeight: 20 },
  card: {
    backgroundColor: '#10231d',
    borderColor: '#1c3a31',
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    gap: 6
  },
  cardTitle: { color: '#f4fff9', fontSize: 17, fontWeight: '800' },
  pressed: { opacity: 0.72 }
});
