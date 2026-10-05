import { useCallback, useEffect, useRef, useState } from 'react';
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
import { GlassSurface, KnowMeIcon, PressScale } from './ui/KnowMeUI';

type Conversation = {
  id: string;
  title?: string | null;
  members: Array<{
    userId: string;
    user: { displayName: string; username: string };
  }>;
};

type CollectionResponse = { items: unknown[] };

type OrganizationOverview = {
  conversations: number;
  folders: number | null;
  archives: number | null;
  pins: number | null;
  drafts: number | null;
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
    title: 'Dossiers privés',
    description: 'Classe et déplace tes conversations dans tes dossiers personnels.'
  },
  {
    id: 'search',
    title: 'Recherche dans les dossiers',
    description: 'Retrouve localement un dossier ou une conversation déjà accessible.'
  },
  {
    id: 'archives',
    title: 'Archives personnelles',
    description: 'Archive ou restaure une conversation sans modifier les droits du groupe.'
  },
  {
    id: 'archiveTimeline',
    title: 'Chronologie des archives',
    description: 'Parcours tes archives personnelles par période sans modifier leur état.'
  },
  {
    id: 'pins',
    title: 'Conversations épinglées',
    description: 'Gère tes raccourcis privés et leur ordre personnel.'
  },
  {
    id: 'saved',
    title: 'Messages enregistrés',
    description: 'Retrouve et retire les messages que tu as enregistrés et qui restent accessibles.'
  },
  {
    id: 'drafts',
    title: 'Brouillons synchronisés',
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
  const [overview, setOverview] = useState<OrganizationOverview | null>(null);
  const [overviewWarning, setOverviewWarning] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const authorityGeneration = useRef(0);

  const loadOrganization = useCallback(async () => {
    const generation = ++authorityGeneration.current;
    setLoading(true);
    setError('');
    setOverviewWarning('');
    setConversations([]);
    setOverview(null);

    try {
      const conversationData = await apiFetch<Conversation[]>('/conversations');
      if (generation !== authorityGeneration.current) return;
      setConversations(conversationData);

      const [foldersResult, archivesResult, pinsResult, draftsResult] = await Promise.allSettled([
        apiFetch<CollectionResponse>('/conversation-folders'),
        apiFetch<CollectionResponse>('/conversation-archives'),
        apiFetch<CollectionResponse>('/conversation-pins'),
        apiFetch<CollectionResponse>('/conversation-drafts')
      ]);
      if (generation !== authorityGeneration.current) return;

      const countItems = (result: PromiseSettledResult<CollectionResponse>) =>
        result.status === 'fulfilled' ? result.value.items.length : null;

      setOverview({
        conversations: conversationData.length,
        folders: countItems(foldersResult),
        archives: countItems(archivesResult),
        pins: countItems(pinsResult),
        drafts: countItems(draftsResult)
      });

      if ([foldersResult, archivesResult, pinsResult, draftsResult].some((result) => result.status === 'rejected')) {
        setOverviewWarning(
          'Certains compteurs personnels sont momentanément indisponibles. Les conversations restent accessibles.'
        );
      }
    } catch (cause) {
      if (generation !== authorityGeneration.current) return;
      setConversations([]);
      setOverview(null);
      setOverviewWarning('');
      setOrganizationConversationId(null);
      setError(cause instanceof Error ? cause.message : 'Organisation indisponible.');
    } finally {
      if (generation === authorityGeneration.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    authorityGeneration.current += 1;
    setOrganizationConversationId(null);
    setOrganizationTool(null);
    setConversations([]);
    setOverview(null);
    setOverviewWarning('');
    setError('');
    setLoading(false);

    if (organizationOpen) {
      void loadOrganization();
    }
  }, [userId, organizationOpen, loadOrganization]);

  function openOrganization() {
    setOrganizationConversationId(null);
    setOrganizationTool(null);
    setOrganizationOpen(true);
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
    { backgroundColor: colors.surfaceGlass, borderColor: colors.border }
  ];

  if (organizationConversationId) {
    return (
      <View style={rootStyle}>
        <View style={styles.toolbar}>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Retour à Organisation"
            onPress={() => setOrganizationConversationId(null)}
            style={[styles.iconButton, { backgroundColor: colors.backgroundAccent, borderColor: colors.border }]}
          >
            <KnowMeIcon name="back" size={18} color={colors.text} />
          </PressScale>
          <Text style={[styles.toolbarTitle, { color: colors.text }]}>Organisation</Text>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Fermer Organisation"
            onPress={closeOrganization}
            style={[styles.iconButton, { backgroundColor: colors.backgroundAccent, borderColor: colors.border }]}
          >
            <KnowMeIcon name="close" size={18} color={colors.text} />
          </PressScale>
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
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Retour à Organisation"
            onPress={() => setOrganizationTool(null)}
            style={[styles.iconButton, { backgroundColor: colors.backgroundAccent, borderColor: colors.border }]}
          >
            <KnowMeIcon name="back" size={18} color={colors.text} />
          </PressScale>
          <Text style={[styles.toolbarTitle, { color: colors.text }]}>Organisation</Text>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Fermer Organisation"
            onPress={closeOrganization}
            style={[styles.iconButton, { backgroundColor: colors.backgroundAccent, borderColor: colors.border }]}
          >
            <KnowMeIcon name="close" size={18} color={colors.text} />
          </PressScale>
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
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Retour aux Messages"
            onPress={closeOrganization}
            style={[styles.iconButton, { backgroundColor: colors.backgroundAccent, borderColor: colors.border }]}
          >
            <KnowMeIcon name="back" size={18} color={colors.text} />
          </PressScale>
          <View style={styles.toolbarCopy}>
            <Text style={[styles.heading, { color: colors.text }]}>Organisation</Text>
            <Text style={[styles.toolbarSub, { color: colors.muted }]}>Privée et personnelle</Text>
          </View>
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Actualiser"
            disabled={loading}
            onPress={() => void loadOrganization()}
            style={[
              styles.iconButton,
              { backgroundColor: colors.backgroundAccent, borderColor: colors.border },
              loading && styles.pressed
            ]}
          >
            <KnowMeIcon name="refresh" size={18} color={colors.text} />
          </PressScale>
        </View>

        <Text style={mutedStyle}>
          Dossiers, archives, épingles et brouillons restent visibles uniquement par toi.
        </Text>

        {overview ? (
          <GlassSurface strength="soft" borderRadius={20} style={styles.overviewStrip}>
            {[
              ['Chats', overview.conversations],
              ['Dossiers', overview.folders],
              ['Archives', overview.archives],
              ['Épingles', overview.pins],
              ['Brouillons', overview.drafts]
            ].map(([label, count]) => (
              <View key={String(label)} style={styles.overviewMetric}>
                <Text style={[styles.overviewCount, { color: colors.text }]}>
                  {count === null ? '—' : String(count)}
                </Text>
                <Text style={[styles.overviewLabel, { color: colors.muted }]}>{String(label)}</Text>
              </View>
            ))}
          </GlassSurface>
        ) : null}

        {overviewWarning ? (
          <Text style={[styles.warning, { color: colors.muted }]}>{overviewWarning}</Text>
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Outils personnels</Text>
        <GlassSurface strength="soft" borderRadius={20} style={styles.toolGroup}>
          {organizationTools.map((tool, index) => (
            <Pressable
              accessibilityRole="button"
              key={tool.id}
              onPress={() => setOrganizationTool(tool.id)}
              style={({ pressed }) => [styles.toolRow, pressed && styles.pressed]}
            >
              <View style={[styles.toolIcon, { backgroundColor: colors.backgroundAccent }]}>
                <KnowMeIcon
                  name={tool.id === 'search' ? 'search' : tool.id === 'saved' ? 'heart' : 'settings'}
                  size={18}
                  color={tool.id === 'search' ? colors.accent : tool.id === 'saved' ? colors.secondary : colors.text}
                />
              </View>
              <View style={styles.toolCopy}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{tool.title}</Text>
                <Text style={mutedStyle} numberOfLines={1}>{tool.description}</Text>
              </View>
              <KnowMeIcon name="arrow" size={16} color={colors.muted} />
              {index < organizationTools.length - 1 ? (
                <View style={[styles.toolDivider, { backgroundColor: colors.border }]} />
              ) : null}
            </Pressable>
          ))}
        </GlassSurface>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Par conversation</Text>
        <Text style={mutedStyle}>
          Ouvre la vue personnelle d’une conversation pour retrouver son dossier, son état d’archive, son épingle, son brouillon et ses messages enregistrés.
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
              <Text style={mutedStyle}>Voir l’organisation privée</Text>
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
        <GlassSurface strength="soft" borderRadius={20}>
          <Pressable
            accessibilityRole="button"
            onPress={openOrganization}
            style={({ pressed }) => [
              styles.organizationButton,
              pressed && styles.pressed
            ]}
          >
            <View style={[styles.organizationIcon, { backgroundColor: colors.backgroundAccent }]}>
              <KnowMeIcon name="settings" size={17} color={colors.accent} />
            </View>
            <Text style={[styles.organizationButtonText, { color: colors.text }]}>Organiser mes messages</Text>
            <KnowMeIcon name="arrow" size={16} color={colors.muted} />
          </Pressable>
        </GlassSurface>
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
  entrypoint: { paddingHorizontal: 14, paddingTop: 8 },
  organizationButton: {
    minHeight: 46,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9
  },
  organizationIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  organizationButtonText: { flex: 1, fontSize: 12.5, fontWeight: '700' },
  content: { padding: 14, paddingBottom: 30, gap: 10 },
  toolbar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9 },
  toolbarPadded: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 14, paddingTop: 8 },
  secondaryButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingVertical: 9,
    paddingHorizontal: 12
  },
  iconButton: { width: 38, height: 38, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  toolbarTitle: { flex: 1, fontSize: 16, fontWeight: '800' },
  toolbarCopy: { flex: 1 },
  toolbarSub: { fontSize: 10.5, marginTop: 1 },
  secondaryText: { fontWeight: '800' },
  eyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1 },
  heading: { fontSize: 18, fontWeight: '800' },
  sectionTitle: { fontSize: 15, fontWeight: '800', marginTop: 5 },
  muted: { fontSize: 11.5, lineHeight: 16.5 },
  warning: { lineHeight: 20, fontStyle: 'italic' },
  error: { lineHeight: 20 },
  overviewStrip: { flexDirection: 'row', padding: 5 },
  overviewMetric: { flex: 1, minWidth: 0, minHeight: 54, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  overviewCount: { fontSize: 14, fontWeight: '800' },
  overviewLabel: { marginTop: 1, fontSize: 8.5, fontWeight: '600', textAlign: 'center' },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 19,
    padding: 12,
    gap: 5
  },
  toolGroup: { overflow: 'hidden' },
  toolRow: { minHeight: 58, paddingHorizontal: 10, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 9, position: 'relative' },
  toolIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  toolCopy: { flex: 1 },
  toolDivider: { position: 'absolute', height: StyleSheet.hairlineWidth, left: 53, right: 10, bottom: 0 },
  cardTitle: { fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.72 }
});