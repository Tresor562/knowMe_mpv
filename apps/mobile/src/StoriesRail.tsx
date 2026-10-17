import { KnowMeAlert as Alert } from './ui/KnowMeFeedback';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { buildKnowMePublicLink } from '@knowme/link-contract';
import { apiFetch, API_URL, authenticatedMediaHeaders } from './api';
import { AndroidMediaLibraryPicker, SelectedAndroidMedia } from './AndroidMediaLibraryPicker';
import { uploadKnowMeMobileMedia } from './mobile-media-upload';
import { NativeStoryVideo } from './NativeStoryVideo';
import { useAppearance } from './AppearanceProvider';
import { useProfileNavigation } from './profile-navigation';
import { Avatar, GlassSurface, KnowMeIcon, PressScale } from './ui/KnowMeUI';
import { BlueVerifiedBadge } from './ui/BlueVerifiedBadge';

type StoryAuthor = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  verification?: {isVerified:true;label:string}|null;
};

type Story = {
  id: string;
  type: string;
  caption?: string | null;
  assetId?: string | null;
  createdAt?: string;
  expiresAt?: string | null;
  author: StoryAuthor | null;
  allowSharing?: boolean;
  viewer: {
    own: boolean;
    reaction?: unknown;
  };
};

type StoryFeedResponse = {
  stories: Story[];
  nextCursor: string | null;
};

type StoryGroup = { story: Story; count: number };
type StoryRailResponse = { groups: StoryGroup[]; nextOffset: number | null };

function groupLegacyStories(stories: Story[]): StoryGroup[] {
  const index = new Map<string, StoryGroup>();
  for (const story of stories) {
    const key = story.viewer.own ? 'owner' : story.author?.id;
    if (!key) continue;
    const group = index.get(key);
    if (group) group.count += 1;
    else index.set(key, { story, count: 1 });
  }
  return [...index.values()];
}

type StoryCreateResult = {
  id: string;
};

export function StoriesRail({
  currentUser,
  onOpenDiscover,
  openComposer=false,
  initialStoryId,
  onComposerOpened
}: {
  currentUser: {
    id: string;
    displayName: string;
    username: string;
    avatarUrl?: string | null;
  };
  onOpenDiscover: () => void;
  openComposer?: boolean;
  initialStoryId?: string | null;
  onComposerOpened?: () => void;
}) {
  const { colors, visual } = useAppearance();
  const openProfile = useProfileNavigation();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const loadingNext = useRef(false);
  const [selected, setSelected] = useState<Story | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [caption, setCaption] = useState('');
  const [storyType, setStoryType] = useState<'TEXT'|'PHOTO'|'VIDEO'>('TEXT');
  const [storyMedia, setStoryMedia] = useState<SelectedAndroidMedia[]>([]);
  const [pickerVisible,setPickerVisible] = useState(false);
  const [selectedPhotoUri,setSelectedPhotoUri] = useState<string|null>(null);
  const [selectedVideoUri,setSelectedVideoUri] = useState<string|null>(null);
  const [mediaError,setMediaError] = useState('');
  const [audience, setAudience] = useState<'FRIENDS' | 'PUBLIC' | 'PRIVATE'>('FRIENDS');
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    try {
      try {
        const response = await apiFetch<StoryRailResponse>('/stories/rail');
        if (!Array.isArray(response?.groups)) {
          const legacy = await apiFetch<StoryFeedResponse>('/stories/feed');
          setGroups(groupLegacyStories(legacy.stories));
          setNextOffset(null);
        } else {
          setGroups(response.groups);
          setNextOffset(typeof response.nextOffset === 'number' ? response.nextOffset : null);
        }
      } catch (cause) {
        if ((cause as { status?: number })?.status !== 404) throw cause;
        const legacy = await apiFetch<StoryFeedResponse>('/stories/feed');
        setGroups(groupLegacyStories(legacy.stories));
        setNextOffset(null);
      }
    } catch {
      // Keep the last known stories during temporary network failures.
      // Emptying the rail here makes an outage look like deleted content.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadNext = useCallback(async () => {
    if (loadingNext.current || nextOffset === null) return;
    loadingNext.current = true;
    try {
      const next = await apiFetch<StoryRailResponse>(`/stories/rail?offset=${nextOffset}`);
      if (!Array.isArray(next?.groups)) {
        setNextOffset(null);
        return;
      }
      setGroups(current => {
        const known = new Set(current.map(g => g.story.author?.id));
        return [...current, ...next.groups.filter(g => !known.has(g.story.author?.id))];
      });
      setNextOffset(next.nextOffset);
    } catch {
      // Keep visible cards intact, retry when the user scrolls again.
    } finally {
      loadingNext.current = false;
    }
  }, [nextOffset]);

  useEffect(() => {
    if (!initialStoryId) return;
    let active = true;
    void apiFetch<Story>(`/stories/${encodeURIComponent(initialStoryId)}`)
      .then(story => { if (active) void openStory(story); })
      .catch(() => { if (active) setMediaError('Story inaccessible ou expirée.'); });
    return () => { active = false; };
  }, [initialStoryId]);

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
    const value=caption.trim();
    if(publishing||(storyType==='TEXT'&&!value)||(storyType!=='TEXT'&&!storyMedia.length))return;
    if(storyMedia.length>10){
      Alert.alert('Trop de stories','Sélectionne jusqu’à 10 médias par envoi.');
      return;
    }
    setPublishing(true);
    let publishedId:string|null=null;
    try {
      const shared={audience,caption:value||undefined,durationHours:24,
        allowReplies:true,allowReactions:true,allowSharing:true};
      if(storyType==='TEXT'){
        const story=await apiFetch<StoryCreateResult>('/stories',{
          method:'POST',body:JSON.stringify({...shared,type:'TEXT',
            background:{preset:'knowme-gradient',alignment:'center'}})
        });
        publishedId=story.id;
      }else{
        const payload=[];
        // Keep media validation and error reporting on a per-file basis.
        // Publish only after every media transfer has passed inspection.
        for(const media of storyMedia){
          const type=media.mime.startsWith('video/')?'VIDEO':'PHOTO';
          const assetId=await uploadKnowMeMobileMedia(media,'STORY');
          payload.push({...shared,type,assetId});
        }
        const batch=await apiFetch<{stories:StoryCreateResult[]}>('/stories/batch',{
          method:'POST',body:JSON.stringify({stories:payload})
        });
        publishedId=batch.stories[0]?.id??null;
      }
      setCaption('');
      setStoryMedia([]);
      setStoryType('TEXT');
      setCreateOpen(false);
    }catch(cause){
      const error=cause as {code?:string;message?:string};
      const uncertain=error?.code==='KNOWME_TIMEOUT'||error?.code==='KNOWME_NETWORK_UNAVAILABLE';
      Alert.alert(uncertain?'Publication non confirmée':'Story impossible',
        uncertain?'Vérifie tes stories avant de réessayer pour éviter un doublon.'
          :cause instanceof Error?cause.message:'Réessaie.');
    }finally{setPublishing(false);}
    if(!publishedId)return;
    await load();
    try{
      const fresh=await apiFetch<Story>('/stories/'+publishedId);
      setSelected(fresh);
    }catch{/* Already published; refresh may be temporarily unavailable. */}
  }

  const myGroup = groups.find(group => group.story.viewer.own);
  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        onScroll={({nativeEvent}) => {
          const { contentOffset, layoutMeasurement, contentSize } = nativeEvent;
          if (contentOffset.x + layoutMeasurement.width >= contentSize.width - 170) void loadNext();
        }}
        scrollEventThrottle={180}
      >
        <View style={[styles.storyCard,{backgroundColor:colors.surfaceRaised,borderColor:colors.border}]}>
          <PressScale onPress={() => myGroup ? void openStory(myGroup.story) : setCreateOpen(true)}
            style={styles.storyCardTap} accessibilityLabel={myGroup ? `Ta story (${myGroup.count})` : 'Créer une story'}>
            {currentUser.avatarUrl
              ? <Image source={{uri:currentUser.avatarUrl}} style={styles.storyCardBackdrop} resizeMode="cover"/>
              : <View style={[styles.storyCardBackdrop,{backgroundColor:colors.backgroundAccent,justifyContent:'center',alignItems:'center'}]}>
                  <Avatar uri={currentUser.avatarUrl} name={currentUser.displayName} size={70}/>
                </View>}
            <View style={styles.storyCardShade}/>
            {myGroup && myGroup.count > 1 ? (
              <View style={[styles.storyCardCount,{backgroundColor:colors.accent}]}>
                <Text style={[styles.storyCardCountText,{color:colors.accentText}]}>{myGroup.count}</Text>
              </View>
            ):null}
            <Text numberOfLines={2} style={styles.storyCardLabel}>{myGroup ? 'Ta story' : 'Créer une story'}</Text>
          </PressScale>
          <PressScale onPress={() => setCreateOpen(true)} accessibilityRole="button"
            accessibilityLabel="Ajouter une story" style={[styles.storyCardPlus,{backgroundColor:colors.accent,borderColor:colors.background}]}>
            <KnowMeIcon name="create" size={16} strokeWidth={2.2} color={colors.accentText}/>
          </PressScale>
        </View>

        {groups.filter(g => !g.story.viewer.own).map(({story,count}) => (
          <View key={story.author?.id ?? story.id}
            style={[styles.storyCard,{backgroundColor:colors.surfaceRaised,borderColor:colors.border}]}>
            <PressScale accessibilityRole="button"
              accessibilityLabel={`Voir les ${count} stories de ${story.author?.displayName ?? 'KnowMe'}`}
              onPress={() => void openStory(story)} style={styles.storyCardTap}>
              {story.author?.avatarUrl
                ? <Image source={{uri:story.author.avatarUrl}} style={styles.storyCardBackdrop} resizeMode="cover"/>
                : <View style={[styles.storyCardBackdrop,{backgroundColor:colors.backgroundAccent,justifyContent:'center',alignItems:'center'}]}>
                    <Avatar name={story.author?.displayName ?? 'KnowMe'} size={70}/>
                  </View>}
              <View style={styles.storyCardShade}/>
              {count>1 && (
                <View style={[styles.storyCardCount,{backgroundColor:colors.accent}]}>
                  <Text style={[styles.storyCardCountText,{color:colors.accentText}]}>{count}</Text>
                </View>
              )}
              <Text numberOfLines={2} style={styles.storyCardLabel}>{story.author?.displayName ?? 'KnowMe'}</Text>
            </PressScale>
            {story.author?.username && (
              <Pressable accessibilityRole="button" accessibilityLabel={`Profil de ${story.author.displayName}`}
                onPress={() => openProfile?.(story.author!.username)}
                style={styles.storyCardProfileLink}>
                <KnowMeIcon name="profile" size={14} color="#fff"/>
              </Pressable>
            )}
          </View>
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
            <Pressable accessibilityRole="button" accessibilityLabel="Voir le profil de l'auteur"
              onPress={() => {
                const username = selected?.viewer.own ? currentUser.username : selected?.author?.username;
                if (username) {
                  setSelected(null);
                  openProfile?.(username);
                }
              }} style={styles.viewerIdentity}>
              <Avatar
                uri={selected?.author?.avatarUrl}
                name={selected?.author?.displayName ?? 'KnowMe'}
                size={38}
              />
              <View>
                <View style={{flexDirection:'row',alignItems:'center',gap:5}}>
                <Text style={[styles.viewerName, { color: colors.text }]}>
                  {selected?.viewer.own
                    ? currentUser.displayName
                    : selected?.author?.displayName ?? 'KnowMe'}
                </Text>
                {selected?.author?.verification?.isVerified?<BlueVerifiedBadge size={18} label={selected.author.verification.label}/>:null}
                </View>
                <Text style={[styles.viewerHandle, { color: colors.muted }]}>
                  @{selected?.viewer.own
                    ? currentUser.username
                    : selected?.author?.username ?? 'knowme'}
                </Text>
              </View>
            </Pressable>
            {selected?.allowSharing ? (
              <PressScale accessibilityRole="button" accessibilityLabel="Partager la Story"
                onPress={() => { void Share.share({message:buildKnowMePublicLink({kind:'story',id:selected.id})}); }}
                style={[styles.closeButton,{backgroundColor:colors.surfaceGlass,borderColor:colors.border,borderRadius:visual.controlRadius}]}>
                <Text style={{color:colors.text,fontSize:18}}>↗</Text>
              </PressScale>
            ) : null}
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
        transparent={false}
        onRequestClose={() => {if(!publishing)setCreateOpen(false);}}
      >
        <View style={[styles.createBackdrop,{backgroundColor:colors.background}]}>
          <ScrollView style={styles.createWrap} keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.createContent}>
            <View style={styles.createSheet}>
              <View style={styles.createHeader}>
                <View style={styles.flex}>
                  <Text style={[styles.createTitle, { color: colors.text }]}>
                    Nouvelle story
                  </Text>
                  <Text style={[styles.createSub, { color: colors.muted }]}>
                    Choisis un format, puis personnalise ta story.
                  </Text>
                </View>
                <PressScale
                  accessibilityRole="button"
                  accessibilityLabel="Fermer"
                  onPress={() => {if(!publishing)setCreateOpen(false);}}
                  style={[
                    styles.createClose,
                    { backgroundColor: colors.backgroundAccent, borderColor: colors.border }
                  ]}
                >
                  <KnowMeIcon name="close" size={18} color={colors.text} />
                </PressScale>
              </View>

              <Text style={{color:colors.muted,fontSize:12,fontWeight:'800',marginBottom:8}}>
                CRÉER
              </Text>
              <View style={{flexDirection:'row',gap:8,marginBottom:12}}>
                {(['TEXT','PHOTO','VIDEO'] as const).map(type=><Pressable key={type}
                  accessibilityRole="button" style={{flex:1,minHeight:44,borderRadius:14,justifyContent:'center',alignItems:'center',
                    backgroundColor:storyType===type?colors.accent:colors.backgroundAccent}}
                  onPress={()=>{setStoryType(type);setStoryMedia([]);}}>
                  <Text style={{color:storyType===type?colors.accentText:colors.text,fontWeight:'700'}}>
                    {type==='TEXT'?'Texte':type==='PHOTO'?'Photo':'Vidéo'}
                  </Text>
                </Pressable>)}
              </View>
              {storyType!=='TEXT'?<Pressable accessibilityRole="button"
                onPress={()=>setPickerVisible(true)}
                style={{minHeight:48,justifyContent:'center',alignItems:'center',borderRadius:14,
                  backgroundColor:colors.backgroundAccent,marginBottom:10}}>
                <Text style={{color:colors.text}}>{storyMedia.length?`${storyMedia.length} média(s) sélectionné(s)`:
                  storyType==='PHOTO'?'Galerie KnowMe · Photos':'Galerie KnowMe · Vidéos'}</Text>
              </Pressable>:null}
              {storyMedia.length>0 ? (
                <View style={styles.storyMediaPreview}>
                  <Image source={{uri:storyMedia[0]!.uri}} style={styles.storyMediaThumb} resizeMode="cover" />
                  <View style={{flex:1,gap:5}}>
                    <Text numberOfLines={1} style={{color:colors.text,fontSize:13,fontWeight:'800'}}>
                      {storyMedia.length===1?storyMedia[0]!.name:`${storyMedia.length} stories distinctes`}
                    </Text>
                    <Text style={{color:colors.muted,fontSize:11}}>
                      {storyType==='VIDEO'?'Vidéo sélectionnée':'Photo sélectionnée'}
                    </Text>
                  </View>
                  <PressScale accessibilityRole="button" accessibilityLabel="Retirer le média"
                    disabled={publishing} onPress={()=>setStoryMedia([])}
                    style={[styles.storyRemove,{backgroundColor:colors.backgroundAccent}]}>
                    <KnowMeIcon name="close" size={16} color={colors.text}/>
                  </PressScale>
                </View>
              ) : null}
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
                  placeholder="Partage un moment, une pensée ou une idée…"
                  placeholderTextColor={colors.muted}
                  selectionColor={colors.accent}
                  style={[styles.captionInput, { color: colors.text }]}
                />
                <Text style={[styles.captionCounter, { color: colors.muted }]}>
                  {caption.length} caractères
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
                disabled={publishing||(storyType==='TEXT'?!caption.trim():!storyMedia.length)}
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
            </View>
          </ScrollView>
        </View>
      </Modal>
      <AndroidMediaLibraryPicker visible={pickerVisible} purpose="story"
        multiple maxSelection={10}
        allowVideo mediaFilter="all"
        onClose={()=>setPickerVisible(false)}
        onPickedMany={media=>{
          if(media.length>10){
            Alert.alert('Limite atteinte','10 médias maximum par série de stories.');
            return;
          }
          setStoryMedia(media);
          if(media.length){
            setStoryType(media[0]!.mime.startsWith('video/')?'VIDEO':'PHOTO');
          }
          setPickerVisible(false);
        }}/>

    </>
  );
}

const styles = StyleSheet.create({
  rail: {
    gap: 9,
    paddingBottom: 12
  },
  storyCard: {
    width: 124,
    height: 190,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    position: 'relative'
  },
  storyCardTap: { width: 124, height: 190, position: 'relative' },
  storyCardBackdrop: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, width: '100%', height: '100%' },
  storyCardShade: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor:'rgba(0,0,0,.35)' },
  storyCardLabel: { position: 'absolute', bottom: 9, left: 10, right: 8,
    fontSize: 12, fontWeight:'700', color:'#fff', textShadowColor:'rgba(0,0,0,.85)',
    textShadowOffset:{width:0,height:1},textShadowRadius:3 },
  storyCardCount: { position: 'absolute', top: 9, right: 9,
    minWidth: 24, height: 24, paddingHorizontal:6, borderRadius:7,
    alignItems: 'center',justifyContent: 'center' },
  storyCardCountText: { fontSize: 12,fontWeight:'800' },
  storyCardPlus: { position: 'absolute',top:8,left:8,borderRadius:18,
    width:34,height:34,borderWidth:2,justifyContent:'center',alignItems:'center' },
  storyCardProfileLink: { position:'absolute',top:8,left:8,width:34,height:34,
    borderRadius:17,backgroundColor:'rgba(0,0,0,.36)',
    alignItems:'center',justifyContent:'center' },
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
  createBackdrop: {flex:1,justifyContent:'flex-start'},
  createWrap: {flex:1},
  createContent:{flexGrow:1,paddingBottom:24},
  createSheet: {flex:1,paddingHorizontal:16,paddingVertical:18,gap:12},
  storyMediaPreview:{flexDirection:'row',alignItems:'center',minHeight:84,gap:12},
  storyMediaThumb:{height:74,width:74,borderRadius:15},
  storyRemove:{height:40,width:40,borderRadius:20,justifyContent:'center',alignItems:'center'},
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
