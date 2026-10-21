import { KnowMeAlert as Alert } from './ui/KnowMeFeedback';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system';
import {
  AppState,
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
import Svg, { Ellipse, Circle } from 'react-native-svg';
import { apiFetch, API_URL, authenticatedMediaHeaders } from './api';
import { AndroidMediaLibraryPicker, SelectedAndroidMedia } from './AndroidMediaLibraryPicker';
import { uploadKnowMeMobileMedia } from './mobile-media-upload';
import { NativeStoryVideo } from './NativeStoryVideo';
import { storyCompletionBps, storyProgressCheckpoint } from './story-view-progress-model';
import { storySequence, storySegments, storyStep, storyTextColor, storyAgeLabel, STORY_TEXT_COLORS } from './story-sequence-model';
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
  background?: {preset?:string;color?:string}|null;
  allowReplies?:boolean;
  allowReactions?:boolean;
  assetId?: string | null;
  thumbnailAssetId?: string | null;
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
type StoryViewer = {viewerUserId:string;lastViewedAt:string;viewCount:number;
  reaction?:{reaction:string}|null;
  user?:{username:string;displayName:string;avatarUrl?:string|null}|null;};
type StoryViewersPage = {uniqueViewers:number;viewers:StoryViewer[];nextCursor?:string|null};
type AudienceCandidate = {id:string;username:string;displayName:string;avatarUrl?:string|null};

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

/** Use an authenticated photo or video poster for Stories, while text stories
 * show their own caption. A full private MP4 is never fetched for the rail. */
function StoryRailBackdrop({story,visible,avatarUrl,name}:{
  story?:Story|null;
  visible:boolean;
  avatarUrl?:string|null;
  name:string;
}){
  const [poster,setPoster]=useState<string|null>(null);
  useEffect(()=>{
    let cancelled=false;
    let downloaded:string|null=null;
    setPoster(null);
    const photo=story?.type==='PHOTO'&&Boolean(story.assetId);
    const video=story?.type==='VIDEO'&&Boolean(story.thumbnailAssetId);
    if(!visible || (!photo&&!video) || !FileSystem.cacheDirectory || !story)return;
    const endpoint=photo?'media':'thumbnail';
    const filename=FileSystem.cacheDirectory + 'knowme-rail-poster-' +
      encodeURIComponent(story.id) + '-' + endpoint + '.webp';
    void (async()=>{
      try{
        const headers=await authenticatedMediaHeaders();
        if(cancelled)return;
        const result=await FileSystem.downloadAsync(
          API_URL+'/stories/'+encodeURIComponent(story.id)+'/'+endpoint,
          filename,{headers}
        );
        downloaded=result.uri;
        const mime=String(result.headers?.['content-type']??result.headers?.['Content-Type']??'')
          .split(';')[0]?.trim().toLowerCase() ?? '';
        const info=await FileSystem.getInfoAsync(result.uri);
        if(result.status!==200 || !['image/png','image/jpeg','image/webp'].includes(mime)
          ||!info.exists ||info.isDirectory ||!info.size ||info.size>5*1024*1024)
          throw new Error('Poster de story non disponible.');
        if(cancelled){await FileSystem.deleteAsync(result.uri,{idempotent:true});return;}
        setPoster(result.uri);
      }catch{
        if(downloaded)void FileSystem.deleteAsync(downloaded,{idempotent:true}).catch(()=>undefined);
        // An unavailable or expired thumbnail falls back to the author avatar.
      }
    })();
    return ()=>{
      cancelled=true;
      if(downloaded)void FileSystem.deleteAsync(downloaded,{idempotent:true}).catch(()=>undefined);
    };
  },[visible,story?.id,story?.type,story?.assetId,story?.thumbnailAssetId]);
  if(story?.type==='TEXT'&&story.caption?.trim())return (
    <View style={styles.storyTextCover}>
      <Text style={styles.storyTextContent} numberOfLines={6}>{story.caption.trim()}</Text>
    </View>
  );
  if(poster)return <Image source={{uri:poster}} style={styles.storyCardBackdrop} resizeMode="cover"/>;
  if(avatarUrl)return <Image source={{uri:avatarUrl}} style={styles.storyCardBackdrop} resizeMode="cover"/>;
  return <View style={[styles.storyCardBackdrop,{justifyContent:'center',alignItems:'center'}]}>
    <Avatar name={name} size={70}/>
  </View>;
}

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
  const [storyProgress,setStoryProgress]=useState(0);
  const [playbackSequence,setPlaybackSequence]=useState<Story[]>([]);
  const playbackRef=useRef<Story[]>([]);
  const sequenceRequest=useRef(0);
  const sequenceLoading=useRef(false);
  const pendingStep=useRef<-1|1|null>(null);
  const textElapsed=useRef(0);
  const [insightsOpen,setInsightsOpen]=useState(false);
  const [viewerPage,setViewerPage]=useState<StoryViewersPage|null>(null);
  const [viewersBusy,setViewersBusy]=useState(false);
  const [viewerLoadMore,setViewerLoadMore]=useState(false);
  const [viewerError,setViewerError]=useState(false);
  const [replyText,setReplyText]=useState('');
  const [sendingReply,setSendingReply]=useState(false);
  const [colorIndex,setColorIndex]=useState(() => Math.floor(Math.random()*STORY_TEXT_COLORS.length));
  const [storyPaused,setStoryPaused]=useState(false);
  const [viewerMenuOpen,setViewerMenuOpen]=useState(false);
  const activeStoryId=useRef<string|null>(null);
  const lastProgressMilestone=useRef(0);
  const receiptQueue=useRef<Promise<void>>(Promise.resolve());
  const [createOpen, setCreateOpen] = useState(false);
  const [caption, setCaption] = useState('');
  const [storyType, setStoryType] = useState<'TEXT'|'PHOTO'|'VIDEO'>('TEXT');
  const [storyMedia, setStoryMedia] = useState<SelectedAndroidMedia[]>([]);
  const [pickerVisible,setPickerVisible] = useState(false);
  const [selectedPhotoUri,setSelectedPhotoUri] = useState<string|null>(null);
  const [selectedVideoUri,setSelectedVideoUri] = useState<string|null>(null);
  const [mediaError,setMediaError] = useState('');
  const [audience, setAudience] = useState<'FRIENDS' | 'PUBLIC' | 'PRIVATE'>('FRIENDS');
  const [excludeQuery,setExcludeQuery]=useState('');
  const [excludedAccounts,setExcludedAccounts]=useState<AudienceCandidate[]>([]);
  const [audienceCandidates,setAudienceCandidates]=useState<AudienceCandidate[]>([]);
  const [audienceSearchError,setAudienceSearchError]=useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(()=>{
    const query=excludeQuery.trim();
    if(!createOpen||audience==='PRIVATE'||query.length<2){
      setAudienceCandidates([]);
      setAudienceSearchError(false);
      return;
    }
    let alive=true;
    const timer=setTimeout(()=>{
      void apiFetch<{users:AudienceCandidate[]}>(
        '/stories/audience/candidates?q='+encodeURIComponent(query)
      ).then(result=>{
        if(alive){
          setAudienceCandidates(Array.isArray(result.users)?result.users:[]);
          setAudienceSearchError(false);
        }
      }).catch(()=>{
        if(alive){setAudienceSearchError(true);setAudienceCandidates([]);}
      });
    },300);
    return()=>{alive=false;clearTimeout(timer);};
  },[createOpen,audience,excludeQuery]);

  const toggleExcludedAccount=(person:AudienceCandidate)=>{
    setExcludedAccounts(current=>current.some(x=>x.id===person.id)
      ?current.filter(x=>x.id!==person.id)
      :current.length>=200?current:[...current,person]);
  };

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
      .then(story => { if (active) void openStory(story,true,false); })
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

  function enqueueStoryReceipt(storyId:string,completionBps:number):Promise<void>{
    // Opening must reach the API before a completion milestone. A queued
    // request also avoids out-of-order updates when the network is slow.
    const pending=receiptQueue.current.catch(()=>undefined).then(async()=>{
      await apiFetch('/stories/'+encodeURIComponent(storyId)+'/view',{
        method:'POST',body:JSON.stringify({completionBps})
      });
    });
    receiptQueue.current=pending.catch(()=>undefined);
    return receiptQueue.current;
  }

  useEffect(()=>{if(!selected)activeStoryId.current=null;},[selected]);

  useEffect(()=>{
    if(!selected?.viewer.own){setViewerPage(null);return;}
    let live=true;
    setViewersBusy(true);setViewerError(false);setViewerPage(null);
    void apiFetch<StoryViewersPage>('/stories/'+encodeURIComponent(selected.id)+'/viewers')
      .then(page=>{if(live)setViewerPage(page);})
      .catch(()=>{if(live)setViewerError(true);})
      .finally(()=>{if(live)setViewersBusy(false);});
    return()=>{live=false;};
  },[selected?.id,selected?.viewer.own]);

  async function loadMoreViewers(){
    if(!selected?.viewer.own||!viewerPage?.nextCursor||viewerLoadMore)return;
    const storyId=selected.id;
    const cursor=viewerPage.nextCursor;
    setViewerLoadMore(true);
    try{
      const page=await apiFetch<StoryViewersPage>(
        '/stories/'+encodeURIComponent(storyId)+'/viewers?cursor='+encodeURIComponent(cursor));
      if(activeStoryId.current!==storyId)return;
      setViewerPage(old=>{
        if(!old||old.nextCursor!==cursor)return old;
        const seen=new Set(old.viewers.map(viewer=>viewer.viewerUserId));
        return {...page,viewers:[...old.viewers,
          ...page.viewers.filter(viewer=>!seen.has(viewer.viewerUserId))]};
      });
    }catch{setViewerError(true);}
    finally{setViewerLoadMore(false);}
  }

  function closeViewer(){
    sequenceRequest.current++;
    sequenceLoading.current=false;
    pendingStep.current=null;
    playbackRef.current=[];setPlaybackSequence([]);
    activeStoryId.current=null;
    setInsightsOpen(false);setViewerMenuOpen(false);setSelected(null);
  }

  async function prepareSequence(opened:Story,fromFirst:boolean) {
    const request=++sequenceRequest.current;
    sequenceLoading.current=true;
    const collected:Story[]=[];
    let cursor:string|null=null;
    const visited=new Set<string>();
    try{
      for(let page=0;page<15;page++){
        const query:string=cursor?'?cursor='+encodeURIComponent(cursor):'';
        const feed:StoryFeedResponse=await apiFetch<StoryFeedResponse>('/stories/feed'+query);
        if(!Array.isArray(feed.stories))break;
        collected.push(...feed.stories);
        const next:string|null=feed.nextCursor;
        if(!next||visited.has(next))break;
        visited.add(next);cursor=next;
      }
    }catch{
      // A failed page never creates fabricated progress segments.
    }finally{
      if(request!==sequenceRequest.current)return;
      const authors=groups.map(group=>group.story.author?.id).filter((v):v is string=>Boolean(v));
      const sequence=storySequence(collected,authors,opened);
      playbackRef.current=sequence.length?sequence:[opened];
      setPlaybackSequence(playbackRef.current);
      sequenceLoading.current=false;
      const first=fromFirst?storySegments(playbackRef.current,opened)[0]??opened:opened;
      void openStory(first,false);
    }
  }

  function navigateStep(direction:-1|1){
    if(!selected)return;
    const i=storyStep(playbackRef.current,selected.id,direction);
    if(i<0){
      if(sequenceLoading.current){pendingStep.current=direction;return;}
      closeViewer();return;
    }
    void openStory(playbackRef.current[i]!,false);
  }

  const authorSegments=selected?storySegments(playbackSequence,selected):[];
  const segments=authorSegments.length?authorSegments:selected?[selected]:[];
  const segmentIndex=selected?Math.max(0,segments.findIndex(item=>item.id===selected.id)):0;

  function reportStoryProgress(story:Story,completionBps:number){
    if(story.viewer.own||activeStoryId.current!==story.id)return;
    const checkpoint=storyProgressCheckpoint(completionBps,lastProgressMilestone.current);
    if(checkpoint===null)return;
    lastProgressMilestone.current=checkpoint;
    void enqueueStoryReceipt(story.id,checkpoint);
  }

  // PHOTO and TEXT consume five seconds of visible, foreground time.
  useEffect(()=>{
    if(!selected||selected.type==='VIDEO'||selected.type==='PHOTO'&&!selectedPhotoUri||mediaError)return;
    const story=selected;
    const tick=setInterval(()=>{
      if(activeStoryId.current!==story.id||AppState.currentState!=='active'||insightsOpen||viewerMenuOpen||storyPaused)return;
      textElapsed.current=Math.min(5000,textElapsed.current+100);
      const bps=storyCompletionBps(textElapsed.current,5000);
      setStoryProgress(bps);
      reportStoryProgress(story,bps);
      if(textElapsed.current>=5000){clearInterval(tick);navigateStep(1);}
    },100);
    return()=>clearInterval(tick);
  },[selected?.id,selected?.type,selectedPhotoUri,mediaError,insightsOpen,storyPaused]);

  async function openStory(story: Story, buildSequence=true, fromFirst=true) {
    if(buildSequence){
      // Wait for the actual author's first visible Story before recording a view.
      // Do not briefly open/mark the author's newest Story as seen by mistake.
      closeViewer();
      sequenceLoading.current=true;
      void prepareSequence(story,fromFirst);
      return;
    }
    activeStoryId.current=story.id;
    lastProgressMilestone.current=0;
    textElapsed.current=0;
    setStoryProgress(0);
    setSelectedPhotoUri(null);setSelectedVideoUri(null);setMediaError('');
    setInsightsOpen(false);setViewerMenuOpen(false);setStoryPaused(false);setReplyText('');
    setSelected(story);
    if(story.viewer.own)return;
    await enqueueStoryReceipt(story.id,0);
  }

  async function sendStoryReply(){
    if(!selected||selected.viewer.own||!selected.allowReplies||sendingReply||!replyText.trim())return;
    setSendingReply(true);
    try{
      await apiFetch('/stories/'+encodeURIComponent(selected.id)+'/replies',{
        method:'POST',body:JSON.stringify({content:replyText.trim()})
      });
      setReplyText('');
      Alert.alert('Réponse enregistrée','Ta réponse à cette story a été reçue.');
    }catch(error){
      Alert.alert('Envoi impossible',error instanceof Error?error.message:'Réessaie.');
    }finally{setSendingReply(false);}
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
        excludeUserIds:audience==='PRIVATE'?[]:excludedAccounts.map(person=>person.id),
        allowReplies:true,allowReactions:true,allowSharing:true};
      if(storyType==='TEXT'){
        const story=await apiFetch<StoryCreateResult>('/stories',{
          method:'POST',body:JSON.stringify({...shared,type:'TEXT',
            background:{preset:'solid',color:STORY_TEXT_COLORS[colorIndex]}})
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
      setExcludedAccounts([]);
      setExcludeQuery('');
      setStoryType('TEXT');
      setColorIndex(current=>(current+1+Math.floor(Math.random()*(STORY_TEXT_COLORS.length-1)))%
        STORY_TEXT_COLORS.length);
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
      void openStory(fresh,true,false);
    }catch{/* Already published; refresh may be temporarily unavailable. */}
  }

  const [railPosition,setRailPosition] = useState({offset:0,width:360});
  const storyVisible=(index:number)=>{
    const left=index*133;
    return left<=railPosition.offset+railPosition.width+133 &&
      left+124>=railPosition.offset-133;
  };
  const myGroup = groups.find(group => group.story.viewer.own);
  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}
        onScroll={({nativeEvent}) => {
          const { contentOffset, layoutMeasurement, contentSize } = nativeEvent;
          setRailPosition({offset:contentOffset.x,width:layoutMeasurement.width});
          if (contentOffset.x + layoutMeasurement.width >= contentSize.width - 170) void loadNext();
        }}
        scrollEventThrottle={180}
      >
        <View style={[styles.storyCard,{backgroundColor:colors.surfaceRaised,borderColor:colors.border}]}>
          <PressScale onPress={() => myGroup ? void openStory(myGroup.story) : setCreateOpen(true)}
            style={styles.storyCardTap} accessibilityLabel={myGroup ? `Ta story (${myGroup.count})` : 'Créer une story'}>
            <StoryRailBackdrop story={myGroup?.story} visible={storyVisible(0)}
              avatarUrl={currentUser.avatarUrl} name={currentUser.displayName}/>
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

        {groups.filter(g => !g.story.viewer.own).map(({story,count},index) => (
          <View key={story.author?.id ?? story.id}
            style={[styles.storyCard,{backgroundColor:colors.surfaceRaised,borderColor:colors.border}]}>
            <PressScale accessibilityRole="button"
              accessibilityLabel={`Voir les ${count} stories de ${story.author?.displayName ?? 'KnowMe'}`}
              onPress={() => void openStory(story)} style={styles.storyCardTap}>
              <StoryRailBackdrop story={story} visible={storyVisible(index+1)}
                avatarUrl={story.author?.avatarUrl} name={story.author?.displayName ?? 'KnowMe'}/>
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
        onRequestClose={() => {if(insightsOpen)setInsightsOpen(false);else closeViewer();}}
      >
        <View
          style={[
            styles.viewer,
            { backgroundColor: '#000' }
          ]}
        >
          <View style={styles.progressSegments} accessibilityLabel={`${segments.length} stories`}>
            {segments.map((segment,i)=><View key={segment.id} style={styles.progressTrack}>
              <View style={[styles.progressValue,{
                width: `${i<segmentIndex?100:i>segmentIndex?0:storyProgress/100}%` as `${number}%`,
                backgroundColor:'#fff'
              }]}/>
            </View>)}
          </View>

          <View style={styles.viewerHeader}>
            <Pressable accessibilityRole="button" accessibilityLabel="Retour à KnowMe"
              onPress={closeViewer} style={styles.viewerBack}>
              <KnowMeIcon name="back" size={25} color="#fff"/>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Voir le profil de l'auteur"
              onPress={() => {
                const username = selected?.viewer.own ? currentUser.username : selected?.author?.username;
                if (username) {
                  closeViewer();
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
                <Text style={[styles.viewerName, { color: '#fff' }]}>
                  {selected?.viewer.own ? 'Ma story' : selected?.author?.displayName ?? 'KnowMe'}
                </Text>
                {selected?.author?.verification?.isVerified?<BlueVerifiedBadge size={18} label={selected.author.verification.label}/>:null}
                </View>
                <Text style={[styles.viewerHandle, { color: '#dde2e6' }]}>
                  {storyAgeLabel(selected?.createdAt)}
                </Text>
              </View>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Options de la story"
              onPress={()=>setViewerMenuOpen(open=>!open)} style={styles.viewerBack}>
              <Text style={{color:'#fff',fontSize:28,fontWeight:'900'}}>⋮</Text>
            </Pressable>
          </View>

          {viewerMenuOpen?(
            <View style={styles.viewerMenu}>
              {selected?.allowSharing?<Pressable style={styles.viewerMenuAction}
                onPress={()=>{setViewerMenuOpen(false);void Share.share({
                  message:buildKnowMePublicLink({kind:'story',id:selected.id})
                });}}><Text style={styles.viewerMenuText}>Partager la story</Text></Pressable>:null}
              {selected?.viewer.own?<Pressable style={styles.viewerMenuAction}
                onPress={()=>{setViewerMenuOpen(false);setInsightsOpen(true);}}>
                <Text style={styles.viewerMenuText}>Voir les spectateurs</Text>
              </Pressable>:null}
              <Pressable style={styles.viewerMenuAction} onPress={closeViewer}>
                <Text style={styles.viewerMenuText}>Fermer</Text>
              </Pressable>
            </View>
          ):null}
          <View
            style={[
              styles.storyCanvas,
              {
                backgroundColor: selected?.type==='TEXT'?storyTextColor(selected.background,selected.id):'#050609',
                borderColor: '#000',
                borderRadius: 0
              }
            ]}
          >
            <View
              style={[
                styles.storyGlowOne,
                { backgroundColor: colors.accent,opacity:selected?.type==='TEXT'?0:0.18 }
              ]}
            />
            <View
              style={[
                styles.storyGlowTwo,
                { backgroundColor: colors.secondary,opacity:selected?.type==='TEXT'?0:0.12 }
              ]}
            />
            {selected?.type==='TEXT'?null:<View style={[styles.storyMark, { backgroundColor: colors.surfaceGlass, borderColor: colors.border }]}>
              <KnowMeIcon name="spark" size={20} color={colors.accent} />
            </View>}
            {selected?.type==='PHOTO'&&selectedPhotoUri?<Image source={{uri:selectedPhotoUri}}
              resizeMode="contain" style={StyleSheet.absoluteFillObject} accessibilityLabel="Photo de la story"/>:null}
            {selected?.type==='VIDEO'&&selectedVideoUri?<NativeStoryVideo
              key={selected.id} sourceUri={selectedVideoUri}
              paused={insightsOpen||viewerMenuOpen||storyPaused}
              onProgress={event=>{
                if(activeStoryId.current!==selected.id)return;
                const {positionMs,durationMs}=event.nativeEvent;
                const bps=storyCompletionBps(positionMs,durationMs);
                setStoryProgress(bps);
                reportStoryProgress(selected,bps);
              }}
              onPlaybackComplete={()=>{
                if(activeStoryId.current!==selected.id)return;
                setStoryProgress(10_000);
                reportStoryProgress(selected,10_000);
                navigateStep(1);
              }}
              onPlaybackError={event=>{
                setSelectedVideoUri(null);
                setMediaError(event.nativeEvent.message||'Vidéo indisponible.');
              }}
              style={StyleSheet.absoluteFillObject}/>:null}
            {mediaError?<Text style={[styles.storyCaption,{color:colors.danger}]}>
              {mediaError}
            </Text>:null}
            {(selected?.type!=='VIDEO'||!selectedVideoUri)&&!mediaError?<Text
              style={[styles.storyCaption,{color:selected?.type==='TEXT'?'#fff':colors.text}]}>
              {selected?.caption?.trim()||(selected?.type==='VIDEO'?'Chargement de la vidéo…':'Story')}
            </Text>:null}
            <View style={styles.storyTapZones} pointerEvents="box-none">
              <Pressable accessibilityRole="button" accessibilityLabel="Story précédente"
                onPress={()=>navigateStep(-1)} onLongPress={()=>setStoryPaused(true)}
                onPressOut={()=>setStoryPaused(false)} style={styles.storyTapZone}/>
              <Pressable accessibilityRole="button" accessibilityLabel="Story suivante"
                onPress={()=>navigateStep(1)} onLongPress={()=>setStoryPaused(true)}
                onPressOut={()=>setStoryPaused(false)} style={styles.storyTapZone}/>
            </View>
          </View>

          {selected?.viewer.own ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Afficher les spectateurs de cette story"
              onPress={()=>setInsightsOpen(true)} style={styles.viewersButton}>
              <Svg width={23} height={23} viewBox="0 0 24 24">
                <Ellipse cx={12} cy={12} rx={10} ry={6.7}
                  stroke="#fff" strokeWidth={2} fill="none"/>
                <Circle cx={12} cy={12} r={3.2} fill="#fff"/>
              </Svg>
              <Text style={styles.viewersCount}>{viewerPage?.uniqueViewers??(viewersBusy?'…':'—')}</Text>
            </Pressable>
          ) : null}
          {!selected?.viewer.own&&selected?.allowReactions!==false ? (
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
          {selected&&!selected.viewer.own&&selected.allowReplies!==false?(
            <View style={styles.replyRow}>
              <TextInput placeholder="Répondre à la story…" placeholderTextColor="#a8afba"
                value={replyText} onChangeText={setReplyText} maxLength={4000}
                multiline style={styles.replyInput}/>
              <Pressable accessibilityRole="button" accessibilityLabel="Envoyer la réponse"
                disabled={!replyText.trim()||sendingReply} onPress={()=>void sendStoryReply()}
                style={styles.replySend}>
                <KnowMeIcon name="arrow" size={20} color="#fff"/>
              </Pressable>
            </View>
          ):null}
          {insightsOpen&&selected?.viewer.own?(
            <View style={styles.insightsOverlay}>
              <Pressable onPress={()=>setInsightsOpen(false)} style={{flex:1}}
                accessibilityLabel="Fermer les spectateurs"/>
              <View style={styles.insightsPanel}>
                <View style={styles.insightsHeader}>
                  <Text style={styles.insightsTitle}>Vu par {viewerPage?.uniqueViewers??0}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="Fermer"
                    onPress={()=>setInsightsOpen(false)}>
                    <KnowMeIcon name="close" color="#fff" size={21}/>
                  </Pressable>
                </View>
                <ScrollView style={{maxHeight:330}}>
                  {viewersBusy?<Text style={styles.insightsEmpty}>Chargement des vues…</Text>:null}
                  {viewerError?<Text style={styles.insightsEmpty}>Impossible de charger certains spectateurs.</Text>:null}
                  {!viewersBusy&&!viewerError&&!viewerPage?.viewers.length?
                    <Text style={styles.insightsEmpty}>Aucune vue pour le moment</Text>:null}
                  {viewerPage?.viewers.map(person=><Pressable key={person.viewerUserId}
                    accessibilityRole="button"
                    onPress={()=>{if(person.user?.username){closeViewer();openProfile?.(person.user.username);}}}
                    style={styles.viewerPerson}>
                    <Avatar uri={person.user?.avatarUrl}
                      name={person.user?.displayName??'KnowMe'} size={38}/>
                    <View style={{flex:1}}>
                      <Text style={styles.viewerPersonName}>{person.user?.displayName??'Compte indisponible'}</Text>
                      <Text style={styles.viewerPersonTime}>
                        {storyAgeLabel(person.lastViewedAt)}
                      </Text>
                    </View>
                    {person.reaction?.reaction?<Text style={styles.viewerReaction}>
                      {person.reaction.reaction}</Text>:null}
                  </Pressable>)}
                  {viewerPage?.nextCursor?<Pressable onPress={()=>void loadMoreViewers()}
                    disabled={viewerLoadMore} accessibilityRole="button"
                    style={styles.moreViewers}>
                    <Text style={styles.moreViewersText}>
                      {viewerLoadMore?'Chargement…':'Afficher plus de spectateurs'}
                    </Text>
                  </Pressable>:null}
                </ScrollView>
              </View>
            </View>
          ):null}
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
              {storyType==='TEXT'?<Pressable accessibilityRole="button"
                accessibilityLabel="Changer la couleur de fond de la story"
                onPress={()=>setColorIndex((colorIndex+1)%STORY_TEXT_COLORS.length)}
                style={[styles.storyColorPicker,{backgroundColor:STORY_TEXT_COLORS[colorIndex]}]}>
                <Text style={{color:'#fff',fontSize:11}}>●</Text>
              </Pressable>:null}
              <View
                style={[
                  styles.preview,
                  {
                    backgroundColor:storyType==='TEXT'?STORY_TEXT_COLORS[colorIndex]:colors.surfaceGlass,
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

              {audience!=='PRIVATE'?<View style={styles.exclusions}>
                <Text style={[styles.exclusionHeading,{color:colors.text}]}>
                  Masquer cette story à certaines personnes
                </Text>
                <Text style={{color:colors.muted,fontSize:12}}>
                  Les personnes exclues ne verront pas cette story, même avec un lien direct.
                </Text>
                <TextInput value={excludeQuery} onChangeText={setExcludeQuery}
                  placeholder="Rechercher un compte ou @pseudo"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none" accessibilityLabel="Rechercher une personne à exclure"
                  style={[styles.exclusionSearch,{color:colors.text,borderColor:colors.border,
                    backgroundColor:colors.backgroundAccent}]}/>
                {excludedAccounts.length?<View style={styles.exclusionCandidates}>
                  {excludedAccounts.map(person=><Pressable key={person.id}
                    accessibilityRole="button" accessibilityLabel={'Retirer '+person.displayName+' des exclusions'}
                    onPress={()=>toggleExcludedAccount(person)}
                    style={[styles.exclusionPerson,{borderColor:colors.accent}]}>
                    <Text style={{color:colors.text}}>{person.displayName} ×</Text>
                  </Pressable>)}
                </View>:null}
                {audienceSearchError?<Text style={{color:colors.danger,fontSize:12}}>
                  Recherche impossible. Réessaie.
                </Text>:null}
                {excludeQuery.trim().length>=2?<View style={styles.exclusionCandidates}>
                  {audienceCandidates.map(person=><Pressable key={person.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{checked:excludedAccounts.some(x=>x.id===person.id)}}
                    onPress={()=>toggleExcludedAccount(person)}
                    style={[styles.exclusionPerson,{borderColor:colors.border}]}>
                    <Text style={{color:colors.text,fontSize:12}}>
                      {excludedAccounts.some(x=>x.id===person.id)?'✓  ':'＋  '}
                      {person.displayName}  @{person.username}
                    </Text>
                  </Pressable>)}
                </View>:null}
              </View>:null}

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
  storyTextCover: {position:'absolute',top:0,bottom:0,left:0,right:0,
    justifyContent:'center',alignItems:'center',paddingHorizontal:12,paddingBottom:22,
    backgroundColor:'#344d79'},
  storyTextContent: {color:'#fff',textAlign:'center',fontSize:14,fontWeight:'700',lineHeight:19},
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
  progressSegments:{flexDirection:'row',gap:4,marginBottom:13,width:'100%'},
  progressTrack: {
    height:3,flex:1,borderRadius:2,backgroundColor:'rgba(255,255,255,0.33)',
    overflow:'hidden'
  },
  progressValue: {
    width: '100%',
    height: '100%'
  },
  viewerBack:{minWidth:36,minHeight:44,alignItems:'center',justifyContent:'center'},
  viewerMenu:{position:'absolute',right:12,top:100,zIndex:15,minWidth:178,
    backgroundColor:'#171d24',borderRadius:15,paddingVertical:8,
    borderWidth:1,borderColor:'#343a42'},
  viewerMenuAction:{minHeight:44,justifyContent:'center',paddingHorizontal:15},
  viewerMenuText:{fontSize:13,color:'#fff',fontWeight:'700'},
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
  storyTapZones:{position:'absolute',left:0,right:0,top:0,bottom:0,flexDirection:'row'},
  storyTapZone:{flex:1},
  viewersButton:{alignSelf:'flex-start',marginTop:12,minHeight:46,minWidth:106,
    paddingHorizontal:18,borderRadius:25,backgroundColor:'rgba(29,37,43,.94)',
    flexDirection:'row',alignItems:'center',justifyContent:'center',gap:14},
  viewersCount:{fontSize:15,fontWeight:'800',color:'#fff'},
  replyRow:{flexDirection:'row',alignItems:'center',gap:10,marginTop:12},
  replyInput:{flex:1,minHeight:44,maxHeight:110,borderWidth:1,borderColor:'#61717b',
    borderRadius:24,color:'#fff',paddingHorizontal:16,paddingVertical:10},
  replySend:{height:44,width:44,borderRadius:22,backgroundColor:'#4b69bf',
    alignItems:'center',justifyContent:'center'},
  insightsOverlay:{position:'absolute',top:0,left:0,right:0,bottom:0,zIndex:9,
    backgroundColor:'rgba(0,0,0,.22)',justifyContent:'flex-end'},
  insightsPanel:{borderTopLeftRadius:22,borderTopRightRadius:22,backgroundColor:'#10151a',
    minHeight:240,padding:18,gap:12},
  insightsHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  insightsTitle:{color:'#fff',fontSize:21,fontWeight:'800'},
  insightsEmpty:{color:'#929da5',fontSize:14,textAlign:'center',marginVertical:22},
  viewerPerson:{flexDirection:'row',alignItems:'center',gap:12,minHeight:58},
  viewerPersonName:{fontSize:14,color:'#fff',fontWeight:'700'},
  viewerPersonTime:{fontSize:12,color:'#b5c0c9',marginTop:4},
  viewerReaction:{color:'#fff',fontSize:19},
  moreViewers:{minHeight:44,alignItems:'center',justifyContent:'center'},
  moreViewersText:{fontSize:13,color:'#aabff9',fontWeight:'700'},
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
  exclusions:{gap:9,marginVertical:12},
  exclusionHeading:{fontWeight:'800',fontSize:14},
  exclusionSearch:{minHeight:44,borderWidth:1,borderRadius:12,paddingHorizontal:12,fontSize:14},
  exclusionCandidates:{gap:7},
  exclusionPerson:{borderWidth:1,borderRadius:12,paddingHorizontal:11,paddingVertical:12,
    minHeight:44,justifyContent:'center'},
  storyColorPicker:{width:34,height:34,borderRadius:17,alignSelf:'flex-start',
    borderColor:'#fff',borderWidth:2,alignItems:'center',justifyContent:'center'},
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
