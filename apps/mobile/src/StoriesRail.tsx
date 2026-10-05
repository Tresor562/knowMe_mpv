import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';
import { Avatar, BrandMark, GlassSurface, KnowMeIcon, PressScale } from './ui/KnowMeUI';

type StoryAuthor = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
};

type Story = {
  id: string;
  type: string;
  caption?: string | null;
  createdAt?: string;
  expiresAt?: string | null;
  author: StoryAuthor | null;
  viewer: {
    own: boolean;
    reaction?: unknown;
  };
};

type StoryFeedResponse = {
  stories: Story[];
  nextCursor: string | null;
};

type StoryCreateResult = {
  id: string;
};

export function StoriesRail({
  currentUser,
  onOpenDiscover
}: {
  currentUser: {
    id: string;
    displayName: string;
    username: string;
    avatarUrl?: string | null;
  };
  onOpenDiscover: () => void;
}) {
  const { colors, visual } = useAppearance();
  const [stories, setStories] = useState<Story[]>([]);
  const [selected, setSelected] = useState<Story | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState<'FRIENDS' | 'PUBLIC' | 'PRIVATE'>('FRIENDS');
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await apiFetch<StoryFeedResponse>('/stories/feed');
      setStories(response.stories);
    } catch {
      setStories([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openStory(story: Story) {
    setSelected(story);
    try {
      await apiFetch('/stories/' + story.id + '/view', {
        method: 'POST',
        body: JSON.stringify({ completionBps: 10000 })
      });
    } catch {
      // Viewing remains available even if the receipt cannot be recorded.
    }
  }

  async function react(reaction: string) {
    if (!selected) return;
    try {
      await apiFetch('/stories/' + selected.id + '/reactions', {
        method: 'POST',
        body: JSON.stringify({ reaction })
      });
    } catch (cause) {
      Alert.alert(
        'Réaction impossible',
        cause instanceof Error ? cause.message : 'Réessaie.'
      );
    }
  }

  async function createStory() {
    const value = caption.trim();
    if (!value || publishing) return;
    setPublishing(true);
    try {
      const story = await apiFetch<StoryCreateResult>('/stories', {
        method: 'POST',
        body: JSON.stringify({
          type: 'TEXT',
          audience,
          caption: value,
          durationHours: 24,
          allowReplies: true,
          allowReactions: true,
          allowSharing: true,
          background: {
            preset: 'knowme-gradient',
            alignment: 'center'
          }
        })
      });
      setCaption('');
      setCreateOpen(false);
      await load();
      const fresh = await apiFetch<Story>('/stories/' + story.id);
      setSelected(fresh);
    } catch (cause) {
      Alert.alert(
        'Story impossible',
        cause instanceof Error ? cause.message : 'Réessaie.'
      );
    } finally {
      setPublishing(false);
    }
  }

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
      >
        <PressScale onPress={() => setCreateOpen(true)} style={styles.item}>
          <View
            style={[
              styles.createRing,
              { borderColor: colors.accent }
            ]}
          >
            <Avatar
              uri={currentUser.avatarUrl}
              name={currentUser.displayName}
              size={54}
            />
            <View
              style={[
                styles.plus,
                {
                  backgroundColor: colors.accent,
                  borderColor: colors.background
                }
              ]}
            >
              <KnowMeIcon
                name="create"
                size={13}
                color={colors.accentText}
                strokeWidth={2.1}
              />
            </View>
          </View>
          <Text
            numberOfLines={1}
            style={[styles.label, { color: colors.muted }]}
          >
            Ta story
          </Text>
        </PressScale>

        {stories.slice(0, 12).map((story) => (
          <PressScale
            key={story.id}
            onPress={() => void openStory(story)}
            style={styles.item}
          >
            <View style={[styles.storyRing, { borderColor: colors.accent }]}>
              <Avatar
                uri={story.author?.avatarUrl}
                name={story.author?.displayName ?? 'KnowMe'}
                size={54}
              />
            </View>
            <Text
              numberOfLines={1}
              style={[styles.label, { color: colors.muted }]}
            >
              {story.viewer.own
                ? 'Ta story'
                : story.author?.displayName ?? 'Story'}
            </Text>
          </PressScale>
        ))}

        <PressScale onPress={onOpenDiscover} style={styles.item}>
          <View
            style={[
              styles.discoverCircle,
              {
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.border
              }
            ]}
          >
            <KnowMeIcon name="discover" size={24} color={colors.accent} />
          </View>
          <Text
            numberOfLines={1}
            style={[styles.label, { color: colors.muted }]}
          >
            Discover
          </Text>
        </PressScale>
      </ScrollView>

      <Modal
        visible={Boolean(selected)}
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <View
          style={[
            styles.viewer,
            { backgroundColor: colors.background }
          ]}
        >
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressValue,
                { backgroundColor: colors.text }
              ]}
            />
          </View>

          <View style={styles.viewerHeader}>
            <View style={styles.viewerIdentity}>
              <Avatar
                uri={selected?.author?.avatarUrl}
                name={selected?.author?.displayName ?? 'KnowMe'}
                size={38}
              />
              <View>
                <Text style={[styles.viewerName, { color: colors.text }]}>
                  {selected?.viewer.own
                    ? currentUser.displayName
                    : selected?.author?.displayName ?? 'KnowMe'}
                </Text>
                <Text style={[styles.viewerHandle, { color: colors.muted }]}>
                  @{selected?.viewer.own
                    ? currentUser.username
                    : selected?.author?.username ?? 'knowme'}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => setSelected(null)}
              style={[
                styles.closeButton,
                { backgroundColor: colors.surfaceGlass, borderRadius: visual.controlRadius }
              ]}
            >
              <Text style={[styles.closeText, { color: colors.text }]}>×</Text>
            </Pressable>
          </View>

          <View
            style={[
              styles.storyCanvas,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border
              }
            ]}
          >
            <View
              style={[
                styles.storyGlowOne,
                { backgroundColor: colors.accent }
              ]}
            />
            <View
              style={[
                styles.storyGlowTwo,
                { backgroundColor: colors.secondary }
              ]}
            />
            <BrandMark size={54} />
            <Text style={[styles.storyCaption, { color: colors.text }]}>
              {selected?.caption?.trim() || 'KnowMe'}
            </Text>
          </View>

          {!selected?.viewer.own ? (
            <View style={styles.reactions}>
              <PressScale
                onPress={() => void react('LIKE')}
                style={[
                  styles.reactionButton,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border
                  }
                ]}
              >
                <KnowMeIcon name="check" size={18} color={colors.accent} />
                <Text style={[styles.reactionText, { color: colors.text }]}>
                  J’aime
                </Text>
              </PressScale>
              <PressScale
                onPress={() => void react('SPARK')}
                style={[
                  styles.reactionButton,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border
                  }
                ]}
              >
                <KnowMeIcon name="spark" size={18} color={colors.secondary} />
                <Text style={[styles.reactionText, { color: colors.text }]}>
                  Intéressant
                </Text>
              </PressScale>
            </View>
          ) : null}
        </View>
      </Modal>

      <Modal
        visible={createOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateOpen(false)}
      >
        <Pressable
          style={styles.createBackdrop}
          onPress={() => setCreateOpen(false)}
        >
          <View style={styles.createWrap}>
            <Pressable onPress={(event) => event.stopPropagation()}>
              <GlassSurface strength="strong" borderRadius={visual.cardRadius} style={styles.createSheet}>
              <View style={styles.createHeader}>
                <View>
                  <Text style={[styles.createTitle, { color: colors.text }]}>
                    Nouvelle Story
                  </Text>
                  <Text style={[styles.createSub, { color: colors.muted }]}>
                    24 heures · KnowMe
                  </Text>
                </View>
                <BrandMark size={34} />
              </View>

              <View
                style={[
                  styles.preview,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border
                  }
                ]}
              >
                <View
                  style={[
                    styles.previewGlow,
                    { backgroundColor: colors.accent }
                  ]}
                />
                <TextInput
                  value={caption}
                  onChangeText={setCaption}
                  multiline
                  maxLength={4000}
                  placeholder="Partage un moment, une pensée ou une idée…"
                  placeholderTextColor={colors.muted}
                  selectionColor={colors.accent}
                  style={[styles.captionInput, { color: colors.text }]}
                />
              </View>

              <View style={styles.audienceRow}>
                {([
                  ['FRIENDS', 'Amis'],
                  ['PUBLIC', 'Public'],
                  ['PRIVATE', 'Moi']
                ] as const).map(([value, label]) => {
                  const active = audience === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setAudience(value)}
                      style={[
                        styles.audienceButton,
                        {
                          backgroundColor: active
                            ? colors.accent
                            : colors.backgroundAccent,
                          borderColor: active ? colors.accent : colors.border
                        }
                      ]}
                    >
                      <Text
                        style={[
                          styles.audienceText,
                          {
                            color: active
                              ? colors.accentText
                              : colors.muted
                          }
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <PressScale
                disabled={!caption.trim() || publishing}
                onPress={() => void createStory()}
                style={[
                  styles.publishButton,
                  { backgroundColor: colors.accent }
                ]}
              >
                <Text
                  style={[
                    styles.publishText,
                    { color: colors.accentText }
                  ]}
                >
                  {publishing ? 'Publication…' : 'Partager la Story'}
                </Text>
                <KnowMeIcon
                  name="arrow"
                  size={18}
                  color={colors.accentText}
                />
              </PressScale>
              </GlassSurface>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  rail: {
    gap: 15,
    paddingBottom: 22
  },
  item: {
    width: 68,
    alignItems: 'center'
  },
  createRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  storyRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
        alignItems: 'center',
    justifyContent: 'center'
  },
  plus: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    right: -2,
    bottom: -1,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  discoverCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  label: {
    marginTop: 7,
    fontSize: 10.5,
    maxWidth: 68,
    textAlign: 'center'
  },
  viewer: {
    flex: 1,
    paddingTop: 10,
    paddingHorizontal: 14,
    paddingBottom: 24
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
    marginBottom: 13
  },
  progressValue: {
    width: '100%',
    height: '100%'
  },
  viewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  viewerIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  viewerName: {
    fontSize: 14,
    fontWeight: '900'
  },
  viewerHandle: {
    fontSize: 10.5,
    marginTop: 1
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeText: {
    fontSize: 25,
    lineHeight: 27
  },
  storyCanvas: {
    flex: 1,
    minHeight: 420,
    marginTop: 16,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  storyGlowOne: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    right: -105,
    top: -90,
    opacity: 0.18
  },
  storyGlowTwo: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    left: -90,
    bottom: -80,
    opacity: 0.12
  },
  storyCaption: {
    fontSize: 25,
    fontWeight: '900',
    lineHeight: 34,
    textAlign: 'center',
    marginTop: 26
  },
  reactions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14
  },
  reactionButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  reactionText: {
    fontSize: 12,
    fontWeight: '800'
  },
  createBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,4,9,0.7)',
    justifyContent: 'flex-end'
  },
  createWrap: {
    padding: 12,
    paddingBottom: 18
  },
  createSheet: {
    borderRadius: 30,
    borderWidth: 1,
    padding: 16,
    gap: 14
  },
  createHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  createTitle: {
    fontSize: 21,
    fontWeight: '900'
  },
  createSub: {
    fontSize: 11,
    marginTop: 2
  },
  preview: {
    minHeight: 260,
    borderRadius: 25,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 20,
    justifyContent: 'center'
  },
  previewGlow: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    right: -80,
    top: -90,
    opacity: 0.18
  },
  captionInput: {
    minHeight: 180,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 28,
    textAlignVertical: 'center',
    textAlign: 'center'
  },
  audienceRow: {
    flexDirection: 'row',
    gap: 8
  },
  audienceButton: {
    flex: 1,
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  audienceText: {
    fontSize: 11.5,
    fontWeight: '900'
  },
  publishButton: {
    minHeight: 52,
    borderRadius: 17,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  publishText: {
    fontSize: 14,
    fontWeight: '900'
  }
});
