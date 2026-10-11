import { useCallback, useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { apiFetch, API_URL, authenticatedMediaHeaders } from './api';
import { AndroidMediaLibraryPicker, SelectedAndroidMedia } from './AndroidMediaLibraryPicker';
import { uploadKnowMeMobileMedia } from './mobile-media-upload';
import { NativeStoryVideo } from './NativeStoryVideo';
import { useAppearance } from './AppearanceProvider';
import { Avatar, GlassSurface, KnowMeIcon, PressScale } from './ui/KnowMeUI';

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
  assetId?: string | null;
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
  onOpenDiscover,
  openComposer=false,
  onComposerOpened,
  onImmersiveChange
}: {
  currentUser: {
    id: string;
    displayName: string;
    username: string;
    avatarUrl?: string | null;
  };
  onOpenDiscover: () => void;
  openComposer?: boolean;
  onComposerOpened?: () => void;
  onImmersiveChange?: (active: boolean) => void;
}) {
  const { colors, visual } = useAppearance();
  const [stories, setStories] = useState<Story[]>([]);
  const [selected, setSelected] = useState<Story | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [caption, setCaption] = useState('');
  const [storyType, setStoryType] = useState<'TEXT'|'PHOTO'|'VIDEO'>('TEXT');
  const [storyMedia, setStoryMedia] = useState<SelectedAndroidMedia|null>(null);
  const [pickerVisible,setPickerVisible] = useState(false);
  const [selectedPhotoUri,setSelectedPhotoUri] = useState<string|null>(null);
  const [selectedVideoUri,setSelectedVideoUri] = useState<string|null>(null);
  const [mediaError,setMediaError] = useState('');
  const [audience, setAudience] = useState<'FRIENDS' | 'PUBLIC' | 'PRIVATE'>('FRIENDS');
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    onImmersiveChange?.(Boolean(selected || createOpen || pickerVisible));
    return () => { onImmersiveChange?.(false); };
  }, [selected, createOpen, pickerVisible, onImmersiveChange]);

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

  useEffect(() => {
    if(!openComposer)return;
    setCreateOpen(true);
    onComposerOpened?.();
  }, [openComposer, onComposerOpened]);

  useEffect(() => {
    let cancelled=false;
    let uri:string|null=null;
    setSelectedPhotoUri(null);
    setSelectedVideoUri(null);
    setMediaError('');
    if(!selected?.assetId || !FileSystem.cacheDirectory)return;
    if(selected.type!=='PHOTO' && selected.type!=='VIDEO')return;
    const isVideo=selected.type==='VIDEO';
    const temporary=`${FileSystem.cacheDirectory}knowme-story-${selected.id}.${isVideo?'mp4':'jpg'}`;
    void (async()=>{
      try{
        await FileSystem.deleteAsync(temporary,{idempotent:true});
        const headers=await authenticatedMediaHeaders();
        const response=await FileSystem.downloadAsync(
          `${API_URL}/stories/${encodeURIComponent(selected.id)}/media`,temporary,{headers}
        );
        const info=await FileSystem.getInfoAsync(response.uri);
        if(response.status<200||response.status>=300||!info.exists||
          info.isDirectory||!info.size||info.size<1024){
          throw new Error('Le média de la story est indisponible.');
        }
        uri=response.uri;
        if(!cancelled){
          if(isVideo)setSelectedVideoUri(uri);
          else setSelectedPhotoUri(uri);
        }
      }catch(error){
        if(!cancelled){
          setMediaError(error instanceof Error?error.message:'Lecture de la story impossible.');
        }
      }
    })();
    return ()=>{
      cancelled=true;
      // Delay cleanup until the native player unmounts from the old story.
      if(uri)void FileSystem.deleteAsync(uri,{idempotent:true}).catch(()=>undefined);
    };
  },[selected?.id,selected?.assetId,selected?.type]);

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
    if (publishing || (storyType==='TEXT'&&!value) || (storyType!=='TEXT'&&!storyMedia)) return;
    setPublishing(true);
    try {
      const assetId=storyType!=='TEXT'&&storyMedia
        ? await uploadKnowMeMobileMedia(storyMedia,'STORY') : undefined;
      const story = await apiFetch<StoryCreateResult>('/stories', {
        method: 'POST',
        body: JSON.stringify({
          type: storyType,
          audience,
          caption: value||undefined,
          assetId,
          durationHours: 24,
          allowReplies: true,
          allowReactions: true,
          allowSharing: true,
          background: storyType==='TEXT' ? {
            preset: 'knowme-gradient',
            alignment: 'center'
          } : undefined
        })
      });
      setCaption('');
      setStoryMedia(null);
      setStoryType('TEXT');
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

        {stories.filter((story) => !story.viewer.own).slice(0, 12).map((story) => (
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
            <PressScale
              accessibilityRole="button"
              accessibilityLabel="Fermer la Story"
              onPress={() => setSelected(null)}
              style={[
                styles.closeButton,
                {
                  backgroundColor: colors.surfaceGlass,
                  borderColor: colors.border,
                  borderRadius: visual.controlRadius
                }
              ]}
            >
              <KnowMeIcon name="close" size={19} color={colors.text} />
            </PressScale>
          </View>

          <View
            style={[
              styles.storyCanvas,
              {
                backgroundColor: colors.backgroundAccent,
                borderColor: colors.border,
                borderRadius: visual.cardRadius
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
            <View style={[styles.storyMark, { backgroundColor: colors.surfaceGlass, borderColor: colors.border }]}>
              <KnowMeIcon name="spark" size={20} color={colors.accent} />
            </View>
            {selected?.type==='PHOTO'&&selectedPhotoUri?<Image source={{uri:selectedPhotoUri}}
              resizeMode="cover" style={StyleSheet.absoluteFillObject} accessibilityLabel="Photo de la story"/>:null}
            {selected?.type==='VIDEO'&&selectedVideoUri?<NativeStoryVideo
              key={selected.id} sourceUri={selectedVideoUri}
              style={StyleSheet.absoluteFillObject}/>:null}
            {mediaError?<Text style={[styles.storyCaption,{color:colors.danger}]}>
              {mediaError}
            </Text>:null}
            {(selected?.type!=='VIDEO'||!selectedVideoUri)&&!mediaError?<Text
              style={[styles.storyCaption,{color:colors.text}]}>
              {selected?.caption?.trim()||(selected?.type==='VIDEO'?'Chargement de la vidéo…':'Story')}
            </Text>:null}
          </View>

          {!selected?.viewer.own ? (
            <View style={styles.reactions}>
              <PressScale
                onPress={() => void react('LIKE')}
                style={[
                  styles.reactionButton,
                  {
                    backgroundColor: colors.surfaceGlass,
                    borderColor: colors.border
                  }
                ]}
              >
                <KnowMeIcon name="heart" size={18} color={colors.accent} />
                <Text style={[styles.reactionText, { color: colors.text }]}>
                  J’aime
                </Text>
              </PressScale>
              <PressScale
                onPress={() => void react('SPARK')}
                style={[
                  styles.reactionButton,
                  {
                    backgroundColor: colors.surfaceGlass,
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
        visible={createOpen&&!pickerVisible}
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
              <GlassSurface strength="medium" borderRadius={visual.cardRadius} style={styles.createSheet}>
              <View style={styles.createHeader}>
                <View style={styles.flex}>
                  <Text style={[styles.createTitle, { color: colors.text }]}>
                    Nouvelle Story
                  </Text>
                  <Text style={[styles.createSub, { color: colors.muted }]}>
                    Visible pendant 24 heures
                  </Text>
                </View>
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel="Fermer"
                  onPress={() => setCreateOpen(false)}
                  style={[
                    styles.createClose,
                    { backgroundColor: colors.backgroundAccent, borderColor: colors.border }
                  ]}
                >
                  <KnowMeIcon name="close" size={18} color={colors.text} />
                </PressScale>
              </View>

              <View style={{flexDirection:'row',gap:8,marginBottom:10}}>
                {(['TEXT','PHOTO','VIDEO'] as const).map(type=><Pressable key={type}
                  accessibilityRole="button" style={{flex:1,minHeight:44,borderRadius:14,justifyContent:'center',alignItems:'center',
                    backgroundColor:storyType===type?colors.accent:colors.backgroundAccent}}
                  onPress={()=>{setStoryType(type);setStoryMedia(null);}}>
                  <Text style={{color:storyType===type?colors.accentText:colors.text,fontWeight:'700'}}>
                    {type==='TEXT'?'Texte':type==='PHOTO'?'Photo':'Vidéo'}
                  </Text>
                </Pressable>)}
              </View>
              {storyType!=='TEXT'?<Pressable accessibilityRole="button"
                onPress={()=>setPickerVisible(true)}
                style={{minHeight:48,justifyContent:'center',alignItems:'center',borderRadius:14,
                  backgroundColor:colors.backgroundAccent,marginBottom:10}}>
                <Text style={{color:colors.text}}>{storyMedia?storyMedia.name:
                  storyType==='PHOTO'?'Choisir une photo':'Choisir une vidéo MP4'}</Text>
              </Pressable>:null}
              <View
                style={[
                  styles.preview,
                  {
                    backgroundColor: colors.surfaceGlass,
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
                <Text style={[styles.captionCounter, { color: colors.muted }]}>
                  {caption.length}/4000
                </Text>
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
                disabled={publishing||(storyType==='TEXT'?!caption.trim():!storyMedia)}
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
      <AndroidMediaLibraryPicker visible={pickerVisible} allowVideo={storyType==='VIDEO'}
        onClose={()=>setPickerVisible(false)}
        onPicked={media=>{
          if(storyType==='VIDEO'&&media.mime!=='video/mp4')return;
          if(storyType==='PHOTO'&&!media.mime.startsWith('image/'))return;
          setStoryMedia(media);setPickerVisible(false);
        }}/>
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
    paddingTop: 8,
    paddingHorizontal: 12,
    paddingBottom: 18
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
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  storyCanvas: {
    flex: 1,
    minHeight: 420,
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
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
  storyMark: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18
  },
  storyCaption: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 33,
    textAlign: 'center'
  },
  reactions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14
  },
  reactionButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    justifyContent: 'center'
  },
  reactionText: {
    fontSize: 11.5,
    fontWeight: '700'
  },
  createBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,4,9,0.7)',
    justifyContent: 'flex-end'
  },
  createWrap: {
    padding: 10,
    paddingBottom: 14
  },
  createSheet: {
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 12
  },
  createHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  flex: { flex: 1 },
  createClose: { width: 38, height: 38, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  createTitle: {
    fontSize: 19,
    fontWeight: '800'
  },
  createSub: {
    fontSize: 11,
    marginTop: 2
  },
  preview: {
    minHeight: 220,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    padding: 18,
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
    minHeight: 150,
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 27,
    textAlignVertical: 'center',
    textAlign: 'center'
  },
  captionCounter: { position: 'absolute', right: 12, bottom: 10, fontSize: 9.5 },
  audienceRow: {
    flexDirection: 'row',
    gap: 8
  },
  audienceButton: {
    flex: 1,
    minHeight: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  audienceText: {
    fontSize: 11,
    fontWeight: '700'
  },
  publishButton: {
    minHeight: 48,
    borderRadius: 20,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  publishText: {
    fontSize: 13,
    fontWeight: '800'
  }
});
