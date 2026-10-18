import { KnowMeAlert as Alert } from './ui/KnowMeFeedback';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  FlatList,
  Image, type ImageStyle,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { buildKnowMePublicLink } from '@knowme/link-contract';
import { API_URL, apiFetch } from './api';
import { AndroidMediaLibraryPicker, type SelectedAndroidMedia } from './AndroidMediaLibraryPicker';
import { uploadKnowMeMobileMedia } from './mobile-media-upload';
import { useAppearance } from './AppearanceProvider';
import { KnowMeMentionText } from './KnowMeMentionText';
import { Avatar, BrandMark, GlassSurface, KnowMeIcon } from './ui/KnowMeUI';
import { GoldVerifiedBadge } from './ui/GoldVerifiedBadge';
import { BlueVerifiedBadge } from './ui/BlueVerifiedBadge';
import { RemoteCosmeticBadges } from './ui/RemoteCosmeticBadges';
import { useRuntimeModules } from './RuntimeExperienceProvider';
import { StoriesRail } from './StoriesRail';
import { PostComposerExperience } from './PostComposerExperience';
import {PublicPostVideo} from './PublicPostVideo';

type Author = {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string | null;
  staff?: {shield?:string}|null;
  verification?: {isVerified:true;label:string}|null;
};

type PostSummary = {
  id: string;
  authorId: string;
  content: string;
  imageUrl?: string | null;
  media?: Array<{url:string;mimeType:string;position:number}>;
  createdAt: string;
  author: Author;
  _count: { likes: number; comments: number };
};

type PostDetail = PostSummary;

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  parentId?: string | null;
  _count?: { replies: number };
  author: Author;
};

type ReactionSummary = {total:number;mine:string|null;emojis:Array<{emoji:string;count:number}>};
const COMMENT_EMOJI_CHOICES = ['❤️','😂','😮','😢','😡'];

function resolvePostImage(url: string) {
  return url.startsWith('/media/public/post/') ? `${API_URL}${url}` : url;
}

function errorMessage(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

function formatPostDate(value: string, withTime = false) {
  const date = new Date(value);
  return withTime
    ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function ActionButton({ title, onPress, disabled = false, danger = false }: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const { colors } = useAppearance();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: danger ? 'transparent' : colors.backgroundAccent,
          borderColor: danger ? colors.danger : colors.border
        },
        danger && styles.dangerAction,
        (pressed || disabled) && styles.mutedAction
      ]}
    >
      <Text
        style={[
          styles.actionText,
          { color: danger ? colors.danger : colors.text }
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function MetricButton({
  icon,
  count,
  label,
  onPress
}: {
  icon: 'heart' | 'messages';
  count: number;
  label: string;
  onPress?: () => void;
}) {
  const { colors } = useAppearance();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${label} : ${count}`}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.metricAction,
        { backgroundColor: colors.backgroundAccent },
        pressed && onPress ? styles.metricPressed : null
      ]}
    >
      <KnowMeIcon name={icon} size={18} color={colors.muted} strokeWidth={1.8} />
      <Text style={[styles.metricCount, { color: colors.muted }]}>{count}</Text>
    </Pressable>
  );
}

/** Native KnowMe action sheet: the same actions are available on Android and iOS. */
function PublicationActions({ post, userId, onClose, onView, onDelete, onOpenProfile }: {
  post: PostSummary | null;
  userId: string;
  onClose: () => void;
  onView?: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenProfile?: (username: string) => void;
}) {
  const { colors } = useAppearance();
  if (!post) return null;
  const action = (label: string, run: () => void, danger = false) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      onPress={() => { onClose(); run(); }}
      style={({ pressed }) => [styles.sheetAction, { backgroundColor: pressed ? colors.backgroundAccent : 'transparent' }]}
    >
      <Text style={[styles.sheetActionLabel, { color: danger ? colors.danger : colors.text }]}>{label}</Text>
    </Pressable>
  );
  return (
    <Modal visible animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.sheetOverlay}>
        <Pressable accessibilityLabel="Fermer les options" style={styles.sheetScrim} onPress={onClose} />
        <View style={[styles.sheetPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.muted }]} />
          <Text style={[styles.sheetHeading, { color: colors.text }]}>Options de la publication</Text>
          {onView ? action('Voir la publication', () => onView(post.id)) : null}
          {action('Partager la publication', () => { void Share.share({ message: buildKnowMePublicLink({ kind: 'post', id: post.id }) }); })}
          {onOpenProfile ? action('Voir le profil', () => onOpenProfile(post.author.username)) : null}
          {post.authorId === userId ? action('Supprimer la publication', () => onDelete(post.id), true) : null}
          {action('Annuler', onClose)}
        </View>
      </View>
    </Modal>
  );
}

function PostDiscussion({ postId, userId, onBack, onDeleted, targetCommentId, onOpenProfile }: {
  postId: string;
  userId: string;
  onBack: () => void;
  onDeleted: (postId: string) => void;
  targetCommentId?: string | null;
  onOpenProfile?: (username: string) => void;
}) {
  const { colors } = useAppearance();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyTo,setReplyTo] = useState<Comment|null>(null);
  const [repliesByParent,setRepliesByParent] = useState<Record<string,Comment[]>>({});
  const [expandedReplies,setExpandedReplies] = useState<string[]>([]);
  const [moreReplies,setMoreReplies] = useState<Record<string,boolean>>({});
  const [loadingReplies,setLoadingReplies] = useState<string|null>(null);
  const [reactions,setReactions] = useState<Record<string,ReactionSummary>>({});
  const [reactionPickerFor,setReactionPickerFor] = useState<string|null>(null);
  const [reactionBusy,setReactionBusy] = useState(false);
  const suppressReactionTap=useRef(false);
  const [customEmoji,setCustomEmoji] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const discussionScroll = useRef<ScrollView>(null);
  const commentInputRef = useRef<TextInput>(null);
  const commentsStart = useRef(0);
  const soughtCommentCursors = useRef(new Set<string>());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [postData, commentData] = await Promise.all([
        apiFetch<PostDetail>(`/posts/${postId}`),
        apiFetch<Comment[]>(`/posts/${postId}/comments?roots=true`)
      ]);
      setPost(postData);
      setComments(commentData);
      setHasMore(commentData.length === 30);
    } catch (cause) {
      Alert.alert('Discussion indisponible', errorMessage(cause, 'Réessaie plus tard.'));
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!targetCommentId || loading || loadingMore || comments.some(item => item.id === targetCommentId)) return;
    const cursor = comments[comments.length - 1]?.id;
    if (hasMore && cursor && soughtCommentCursors.current.size < 100 && !soughtCommentCursors.current.has(cursor)) {
      soughtCommentCursors.current.add(cursor);
      void loadMore();
    }
  }, [targetCommentId, loading, loadingMore, comments, hasMore]);

  async function loadMore() {
    const cursor = comments[comments.length - 1]?.id;
    if (!cursor || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await apiFetch<Comment[]>(`/posts/${postId}/comments?roots=true&cursor=${encodeURIComponent(cursor)}`);
      setComments((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...page.filter((item) => !known.has(item.id))];
      });
      setHasMore(page.length === 30);
    } catch (cause) {
      Alert.alert('Chargement impossible', errorMessage(cause, 'Réessaie.'));
    } finally {
      setLoadingMore(false);
    }
  }

  const currentCommentIds = [...new Set([
    ...comments.map(item=>item.id),
    ...Object.values(repliesByParent).flat().map(item=>item.id)
  ])].join(',');

  useEffect(()=>{
    if(!currentCommentIds) return;
    let active=true;
    const ids=currentCommentIds.split(',');
    void Promise.all(Array.from({length:Math.ceil(ids.length/30)},(_,i)=>{
      const chunk=ids.slice(i*30,i*30+30);
      return apiFetch<Record<string,ReactionSummary>>(
        `/posts/${postId}/comments/reaction-summaries?ids=${encodeURIComponent(chunk.join(','))}`);
    })).then(parts=>{if(active)setReactions(previous=>Object.assign({},previous,...parts));})
      .catch(()=>undefined);
    return()=>{active=false;};
  },[postId,currentCommentIds]);

  async function reactTo(id:string,emoji:string) {
    if(reactionBusy) return;
    setReactionBusy(true);
    try{
      const endpoint=`/posts/${postId}/comments/${encodeURIComponent(id)}/reaction`;
      const result = reactions[id]?.mine===emoji
        ? await apiFetch<ReactionSummary>(endpoint,{method:'DELETE'})
        : await apiFetch<ReactionSummary>(endpoint,{method:'PUT',body:JSON.stringify({emoji})});
      setReactions(previous=>({...previous,[id]:result}));
      setReactionPickerFor(null);
      setCustomEmoji('');
    }catch(cause){Alert.alert('Réaction impossible',errorMessage(cause,'Réessaie.'));}
    finally{setReactionBusy(false);}
  }

  async function toggleReplies(comment:Comment, append=false) {
    if (!append && expandedReplies.includes(comment.id)) {
      setExpandedReplies(prev=>prev.filter(id=>id!==comment.id));
      return;
    }
    if(loadingReplies) return;
    setLoadingReplies(comment.id);
    try {
      const existing=repliesByParent[comment.id]??[];
      const cursor=append?existing[existing.length-1]?.id:undefined;
      const query=cursor?`?cursor=${encodeURIComponent(cursor)}`:'';
      const data=await apiFetch<Comment[]>(
        `/posts/${postId}/comments/${encodeURIComponent(comment.id)}/replies${query}`
      );
      setRepliesByParent(prev=>{
        const previous=append?prev[comment.id]??[]:[];
        const seen=new Set(previous.map(item=>item.id));
        return {...prev,[comment.id]:[...previous,...data.filter(item=>!seen.has(item.id))]};
      });
      setMoreReplies(prev=>({...prev,[comment.id]:data.length===30}));
      setExpandedReplies(prev=>prev.includes(comment.id)?prev:[...prev,comment.id]);
    }catch(cause){Alert.alert('Réponses indisponibles',errorMessage(cause,'Réessaie.'));}
    finally{setLoadingReplies(null);}
  }

  async function toggleLike() {
    if (!post) return;
    try {
      const result = await apiFetch<{ liked: boolean }>(`/posts/${post.id}/like`, { method: 'POST' });
      setPost((current) => current ? {
        ...current,
        _count: {
          ...current._count,
          likes: Math.max(0, current._count.likes + (result.liked ? 1 : -1))
        }
      } : current);
    } catch (cause) {
      Alert.alert('Action impossible', errorMessage(cause, 'Réessaie.'));
    }
  }

  async function sendComment() {
    const content = commentText.trim();
    if (!content || sending) return;
    setSending(true);
    const replyParent=replyTo;
    let created:Comment;
    try {
      created = await apiFetch<Comment>(`/posts/${postId}/comments`, {
        method:'POST',body:JSON.stringify({
          content,...(replyParent?{parentId:replyParent.id}:{})
        })
      });
    } catch(cause){
      const error=cause as {code?:string;message?:string};
      const uncertain=error?.code==='KNOWME_TIMEOUT'||error?.code==='KNOWME_NETWORK_UNAVAILABLE';
      Alert.alert('Envoi non confirmé', uncertain
        ? 'Vérifie les commentaires avant de recommencer, afin d’éviter un doublon.'
        :errorMessage(cause,'Réessaie.'));
      setSending(false);
      return;
    }
    setCommentText('');
    setReplyTo(null);
    setPost(current=>current?{...current,
      _count:{...current._count,comments:current._count.comments+1}}:current);
    if(replyParent){
      setRepliesByParent(prev=>({
        ...prev,[replyParent.id]:[...(prev[replyParent.id]??[]),created]
      }));
      setExpandedReplies(prev=>prev.includes(replyParent.id)?prev:[...prev,replyParent.id]);
      setComments(prev=>prev.map(item=>item.id===replyParent.id?{
        ...item,_count:{replies:(item._count?.replies??0)+1}
      }:item));
    }else{
      setComments(current=>[created,...current.filter(item=>item.id!==created.id)]);
      discussionScroll.current?.scrollTo({y:Math.max(0,commentsStart.current-12),animated:true});
    }
    setSending(false);
  }

  function confirmDeleteComment(comment: Comment) {
    Alert.alert(
      'Supprimer le commentaire ?',
      'Cette action est définitive.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => void deleteComment(comment.id) }
      ]
    );
  }

  async function deleteComment(commentId: string) {
    setBusyId(commentId);
    try {
      await apiFetch(`/posts/${postId}/comments/${commentId}`, { method: 'DELETE' });
      setComments((current) => current.filter((item) => item.id !== commentId));
      setPost((current) => current ? {
        ...current,
        _count: { ...current._count, comments: Math.max(0, current._count.comments - 1) }
      } : current);
    } catch (cause) {
      Alert.alert('Suppression impossible', errorMessage(cause, 'Réessaie.'));
    } finally {
      setBusyId(null);
    }
  }

  function confirmDeletePost() {
    Alert.alert(
      'Supprimer cette publication ?',
      'La publication et ses commentaires seront supprimés définitivement.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => void deletePost() }
      ]
    );
  }

  async function deletePost() {
    if (!post) return;
    setBusyId(post.id);
    try {
      await apiFetch(`/posts/${post.id}`, { method: 'DELETE' });
      onDeleted(post.id);
      onBack();
    } catch (cause) {
      Alert.alert('Suppression impossible', errorMessage(cause, 'Réessaie.'));
    } finally {
      setBusyId(null);
    }
  }

  function renderDiscussionComment(comment:Comment, depth:number):ReactNode {
    const canDelete=comment.author.id===userId || post?.authorId===userId;
    const children=repliesByParent[comment.id]??[];
    const reaction=reactions[comment.id];
    const count=comment._count?.replies??0;
    const expanded=expandedReplies.includes(comment.id);
    return (
      <View key={comment.id} style={[{marginLeft:Math.min(depth,4)*12},
        styles.threadComment,{borderBottomColor:colors.border,
        backgroundColor:comment.id===targetCommentId?colors.backgroundAccent:'transparent'}]}
        onLayout={event=>{
          if(comment.id===targetCommentId){
            discussionScroll.current?.scrollTo({y:Math.max(0,event.nativeEvent.layout.y-80),animated:true});
          }
        }}>
        <Pressable accessibilityRole="button"
          accessibilityLabel={`Profil de ${comment.author.displayName}`}
          onPress={()=>onOpenProfile?.(comment.author.username)}>
          <Avatar uri={comment.author.avatarUrl} name={comment.author.displayName} size={depth?30:36}/>
        </Pressable>
        <View style={styles.flex}>
          <View style={styles.threadIdentity}>
            <Pressable onPress={()=>onOpenProfile?.(comment.author.username)}>
              <View style={styles.verifiedName}>
                <Text style={[styles.compactAuthor,{color:colors.text}]}>{comment.author.displayName}</Text>
                {comment.author.staff?.shield==='GOLD'?<GoldVerifiedBadge size={17}/>:null}
                {comment.author.verification?.isVerified?<BlueVerifiedBadge size={17} label={comment.author.verification.label}/>:null}
                <RemoteCosmeticBadges username={comment.author.username} size={17}/>
              </View>
            </Pressable>
            <Text style={[styles.smallMeta,{color:colors.muted}]}>{formatPostDate(comment.createdAt)}</Text>
          </View>
          <KnowMeMentionText text={comment.content} style={[styles.threadBody,{color:colors.text}]}/>
          <View style={styles.threadTools}>
            <Pressable accessibilityRole="button" disabled={reactionBusy}
              accessibilityLabel={`Réagir au commentaire de ${comment.author.displayName}`}
              onPress={()=>{
                if(suppressReactionTap.current){suppressReactionTap.current=false;return;}
                void reactTo(comment.id,'❤️');
              }}
              onLongPress={()=>{
                suppressReactionTap.current=true;
                setReactionPickerFor(comment.id);
              }} delayLongPress={380}>
              <Text style={[styles.threadToolText,{color:reaction?.mine?colors.accent:colors.muted}]}>
                {reaction?.mine??'♡'} Réagir{reaction?.total?' · '+reaction.total:''}
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Choisir un emoji"
              onPress={()=>setReactionPickerFor(comment.id)}>
              <Text style={[styles.threadToolText,{color:colors.muted}]}>☺</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={()=>{setReplyTo(comment);requestAnimationFrame(()=>commentInputRef.current?.focus());}}>
              <Text style={[styles.threadToolText,{color:colors.muted}]}>Répondre</Text>
            </Pressable>
            <Pressable accessibilityRole="button"
              onPress={()=>{void Share.share({message:buildKnowMePublicLink({kind:'comment',id:comment.id})});}}>
              <Text style={[styles.threadToolText,{color:colors.muted}]}>Partager</Text>
            </Pressable>
            {canDelete?<Pressable accessibilityRole="button" disabled={busyId===comment.id}
              onPress={()=>confirmDeleteComment(comment)}>
              <Text style={[styles.threadToolText,{color:colors.danger}]}>Supprimer</Text>
            </Pressable>:null}
          </View>
          {reaction?.emojis?.length ? (
            <View style={{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:6}}>
              {reaction.emojis.slice(0,5).map(r=><Text key={r.emoji}
                style={[styles.smallMeta,{color:colors.muted}]}>{r.emoji} {r.count}</Text>)}
            </View>
          ):null}
          {(count>0||children.length>0)?(
            <Pressable accessibilityRole="button" onPress={()=>void toggleReplies(comment)}
              style={{minHeight:42,justifyContent:'center'}}>
              <Text style={[styles.threadToolText,{color:colors.accent}]}>
                {expanded?'Masquer les réponses':`Voir les réponses (${count||children.length})`}
              </Text>
            </Pressable>
          ):null}
          {expanded && children.length>0 && (
            <View style={{borderLeftWidth:2,borderLeftColor:colors.border,paddingLeft:5}}>
              {children.map(child=>renderDiscussionComment(child,depth+1))}
              {moreReplies[comment.id]&&(
                <Pressable accessibilityRole="button"
                  accessibilityLabel="Afficher les réponses suivantes"
                  disabled={loadingReplies===comment.id}
                  onPress={()=>void toggleReplies(comment,true)}
                  style={{minHeight:44,justifyContent:'center',paddingHorizontal:8}}>
                  <Text style={[styles.threadToolText,{color:colors.accent}]}>
                    {loadingReplies===comment.id?'Chargement…':'Afficher les réponses suivantes'}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>
    );
  }

  if (loading || !post) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.muted, { color: colors.muted }]}>{loading ? 'Chargement de la discussion…' : 'Publication introuvable.'}</Text>
        <ActionButton title="Retour" onPress={onBack} />
      </View>
    );
  }

  return (
    <View style={[styles.discussionScreen, { backgroundColor: colors.background }]}>
    <ScrollView
      ref={discussionScroll}
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.discussionContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.discussionHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={onBack}
          style={[styles.roundControl, { backgroundColor: colors.backgroundAccent }]}>
          <KnowMeIcon name="back" size={22} color={colors.text}/>
        </Pressable>
        <Text style={[styles.discussionTitle, { color: colors.text }]}>Commentaires</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Options de la publication" onPress={() => setOptionsOpen(true)}
          style={[styles.roundControl, { backgroundColor: colors.backgroundAccent }]}>
          <Text style={{ fontSize: 24, lineHeight: 27, color: colors.text }}>⋯</Text>
        </Pressable>
      </View>

      <View style={[styles.discussionPost, { borderBottomColor: colors.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Voir le profil de ${post.author.displayName}`}
          onPress={() => onOpenProfile?.(post.author.username)} style={styles.authorRow}>
          <Avatar uri={post.author.avatarUrl} name={post.author.displayName} size={42} />
          <View style={styles.flex}>
            <View style={styles.verifiedName}><Text style={[styles.compactAuthor, { color: colors.text }]}>{post.author.displayName}</Text>{post.author.staff?.shield==='GOLD'?<GoldVerifiedBadge size={18}/>:null}{post.author.verification?.isVerified?<BlueVerifiedBadge size={18} label={post.author.verification.label}/>:null}<RemoteCosmeticBadges username={post.author.username} size={18}/></View>
            <Text style={[styles.smallMeta, { color: colors.muted }]}>@{post.author.username} · {formatPostDate(post.createdAt)}</Text>
          </View>
        </Pressable>
        <KnowMeMentionText text={post.content} style={[styles.postText, { color: colors.text }]}/>
        {post.media?.length ? <View style={{flexDirection:'row',flexWrap:'wrap',gap:3}}>
          {post.media.slice(0,5).map((medium,index)=><View key={medium.url}
            style={{width:post.media!.length===1?'100%':index<2?'49%':'32%',
              height:post.media!.length===1?290:index<2?205:127,
              backgroundColor:colors.surface,overflow:'hidden',position:'relative',borderRadius:3}}>
            {medium.mimeType.startsWith('image/')?
              <Image source={{uri:resolvePostImage(medium.url)}} style={{width:'100%',height:'100%'}}
                resizeMode="cover"/>:<PublicPostVideo url={medium.url}/>}
            {index===4&&post.media!.length>5?<View
              style={{position:'absolute',top:0,bottom:0,left:0,right:0,
                backgroundColor:'#000a',justifyContent:'center',alignItems:'center'}}>
              <Text style={{color:'#fff',fontSize:29,fontWeight:'800'}}>+{post.media!.length-5}</Text>
            </View>:null}
          </View>)}
        </View>:post.imageUrl?
          <Image source={{uri:resolvePostImage(post.imageUrl)}} style={styles.postImage as ImageStyle}
            resizeMode="cover"/>:null}
        <View style={styles.discussionMetrics}>
          <Pressable accessibilityRole="button" accessibilityLabel="Réagir à la publication" onPress={() => void toggleLike()}
            style={styles.metricInline}>
            <KnowMeIcon name="heart" size={19} color={colors.muted}/>
            <Text style={[styles.metaText, { color: colors.muted }]}>{post._count.likes}</Text>
          </Pressable>
          <View style={styles.metricInline}>
            <KnowMeIcon name="messages" size={19} color={colors.muted}/>
            <Text style={[styles.metaText, { color: colors.muted }]}>{post._count.comments}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Partager la publication"
            onPress={() => { void Share.share({ message: buildKnowMePublicLink({ kind: 'post', id: post.id }) }); }}
            style={styles.metricInline}>
            <KnowMeIcon name="arrow" size={18} color={colors.muted}/>
            <Text style={[styles.metaText, { color: colors.muted }]}>Partager</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.commentsHeadingRow} onLayout={event => { commentsStart.current = event.nativeEvent.layout.y; }}>
        <Text style={[styles.commentsHeading, { color: colors.text }]}>Commentaires · {post._count.comments}</Text>
      </View>
      {comments.map(comment=>renderDiscussionComment(comment,0))}
      {!comments.length && <View style={styles.emptyDiscussion}><KnowMeIcon name="messages" size={27} color={colors.muted}/><Text style={[styles.emptyDiscussionText, {color:colors.muted}]}>Aucun commentaire pour l’instant. Lance la discussion !</Text></View>}
      {hasMore && <ActionButton title={loadingMore ? 'Chargement…' : 'Afficher plus'} disabled={loadingMore} onPress={() => void loadMore()} />}
    </ScrollView>
    <View style={[styles.commentDock, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      {replyTo ? (
        <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:10}}>
          <Text style={[styles.smallMeta,{color:colors.text}]}>Réponse à {replyTo.author.displayName}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Annuler la réponse"
            onPress={()=>setReplyTo(null)} style={{padding:10}}>
            <KnowMeIcon name="close" color={colors.muted} size={20}/>
          </Pressable>
        </View>
      ):null}
      <TextInput ref={commentInputRef}
        accessibilityLabel="Écrire un commentaire"
        value={commentText}
        onChangeText={setCommentText}
        multiline
        maxLength={500}
        placeholder={replyTo?`Répondre à ${replyTo.author.displayName}…`:"Écris un commentaire…"}
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        style={[styles.commentDockInput, { backgroundColor: colors.backgroundAccent, color: colors.text }]}
      />
      <Pressable accessibilityRole="button" accessibilityLabel="Envoyer le commentaire"
        disabled={sending || !commentText.trim()} onPress={() => void sendComment()}
        style={[styles.commentSend, { backgroundColor: colors.accent, opacity: sending || !commentText.trim() ? 0.45 : 1 }]}>
        <KnowMeIcon name="arrow" size={22} color={colors.accentText}/>
      </Pressable>
    </View>
    <Modal visible={Boolean(reactionPickerFor)} transparent animationType="slide"
      onRequestClose={()=>setReactionPickerFor(null)} statusBarTranslucent>
      <View style={[styles.sheetOverlay,{justifyContent:'flex-end'}]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer les réactions"
          style={styles.sheetScrim} onPress={()=>setReactionPickerFor(null)}/>
        <View style={[styles.sheetPanel,{backgroundColor:colors.surface,borderColor:colors.border}]}>
          <View style={[styles.sheetHandle,{backgroundColor:colors.muted}]}/>
          <Text style={[styles.sheetHeading,{color:colors.text}]}>Réagir au commentaire</Text>
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:3,paddingVertical:12}}>
            {COMMENT_EMOJI_CHOICES.map(emoji=>(
              <Pressable key={emoji} accessibilityRole="button"
                accessibilityLabel={`Réagir avec ${emoji}`}
                disabled={reactionBusy}
                onPress={()=>{if(reactionPickerFor)void reactTo(reactionPickerFor,emoji);}}
                style={{flex:1,minHeight:54,borderRadius:18,alignItems:'center',justifyContent:'center',
                  backgroundColor:colors.backgroundAccent}}>
                <Text style={{fontSize:25}}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.smallMeta,{color:colors.muted,marginBottom:7}]}>
            Autre emoji (choisis-le avec le clavier)
          </Text>
          <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
            <TextInput value={customEmoji} onChangeText={setCustomEmoji} maxLength={32}
              placeholder="😊" placeholderTextColor={colors.muted}
              accessibilityLabel="Choisir un autre emoji"
              style={{flex:1,minHeight:48,paddingHorizontal:13,borderRadius:14,
                color:colors.text,backgroundColor:colors.backgroundAccent,fontSize:22}}/>
            <Pressable accessibilityRole="button" accessibilityLabel="Valider l’emoji"
              disabled={!customEmoji.trim()||reactionBusy}
              onPress={()=>{if(reactionPickerFor)void reactTo(reactionPickerFor,customEmoji.trim());}}
              style={{minHeight:48,paddingHorizontal:15,borderRadius:14,justifyContent:'center',
                backgroundColor:colors.accent,opacity:reactionBusy?.5:1}}>
              <Text style={{color:colors.accentText,fontWeight:'700'}}>Valider</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
    <PublicationActions
      post={optionsOpen ? post : null} userId={userId} onClose={() => setOptionsOpen(false)}
      onOpenProfile={onOpenProfile}
      onDelete={() => confirmDeletePost()}
    />
    </View>
  );
}

export function FeedExperience({
  userId,
  initialPostId,
  initialCommentId,
  mode = 'discover',
  currentUser,
  onOpenDiscover,
  onOpenProfile,
  storyComposerRequest = false,
  initialStoryId,
  onStoryComposerHandled,
  openComposerRequest = false,
  onComposerOpened,
  onContentScroll,
  onDetailChange,
  topNavigation
}: {
  userId: string;
  initialPostId?: string | null;
  initialCommentId?: string | null;
  mode?: 'home' | 'discover';
  currentUser?: { id: string; displayName: string; username: string; avatarUrl?: string | null };
  onOpenDiscover?: () => void;
  onOpenProfile?: (username: string) => void;
  storyComposerRequest?: boolean;
  initialStoryId?: string | null;
  onStoryComposerHandled?: () => void;
  openComposerRequest?: boolean;
  onComposerOpened?: () => void;
  onContentScroll?: (offset: number) => void;
  onDetailChange?: (open: boolean) => void;
  topNavigation?: ReactNode;
}) {
  const { colors } = useAppearance();
  const runtimeModules = useRuntimeModules();
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [content, setContent] = useState('');
  const [composerOpen,setComposerOpen] = useState(false);
  useEffect(()=>{
    if(!openComposerRequest)return;
    setComposerOpen(true);
    onComposerOpened?.();
  },[openComposerRequest,onComposerOpened]);
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [postPhotoSupported, setPostPhotoSupported] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<SelectedAndroidMedia[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(initialPostId ?? null);
  const [menuPost, setMenuPost] = useState<PostSummary | null>(null);
  useEffect(() => { if(initialPostId) setSelectedPostId(initialPostId); }, [initialPostId]);
  useEffect(() => { onDetailChange?.(Boolean(selectedPostId)); return () => onDetailChange?.(false); },[selectedPostId,onDetailChange]);
  const [publishing, setPublishing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async () => {
    try {
      const page = await apiFetch<PostSummary[]>('/posts/feed');
      setPosts(page);
      setHasMore(page.length === 20);
    } catch (cause) {
      Alert.alert('Fil indisponible', errorMessage(cause, 'Réessaie.'));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let active = true;
    setPostPhotoSupported(false);
    void apiFetch<{ publicPostImage: boolean }>('/media/public/post-capabilities')
      .then(result => { if (active) setPostPhotoSupported(Boolean(result.publicPostImage)); })
      .catch(() => { if (active) setPostPhotoSupported(false); });
    return () => { active = false; };
  }, [userId]);

  async function loadMore() {
    const cursor = posts[posts.length - 1]?.id;
    if (!cursor || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await apiFetch<PostSummary[]>(`/posts/feed?cursor=${encodeURIComponent(cursor)}`);
      setPosts((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...page.filter((item) => !known.has(item.id))];
      });
      setHasMore(page.length === 20);
    } catch (cause) {
      Alert.alert('Chargement impossible', errorMessage(cause, 'Réessaie.'));
    } finally {
      setLoadingMore(false);
    }
  }

  async function publish() {
    const value=content.trim();
    if((!value&&!selectedPhotos.length)||publishing)return;
    setPublishing(true);
    try {
      const mediaAssetIds:string[]=[];
      for(const media of selectedPhotos){
        mediaAssetIds.push(await uploadKnowMeMobileMedia(media,'POST'));
      }
      await apiFetch('/posts',{
        method:'POST',body:JSON.stringify({content:value||' ',mediaAssetIds})
      });
      setContent('');
      setSelectedPhotos([]);
      setComposerOpen(false);
      await load();
    }catch(cause){
      Alert.alert('Publication impossible',errorMessage(cause,'Réessaie.'));
    }finally{setPublishing(false);}
  }

  function confirmRemovePost(id: string) {
    Alert.alert('Supprimer cette publication ?', 'La publication et ses commentaires seront supprimés définitivement.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => { void removePost(id); } }
    ]);
  }

  async function removePost(id: string) {
    try {
      await apiFetch(`/posts/${encodeURIComponent(id)}`,{method:'DELETE'});
      setPosts(current=>current.filter(post=>post.id!==id));
    } catch (cause) {
      Alert.alert('Suppression impossible',errorMessage(cause,'Réessaie.'));
    }
  }

  async function like(postId: string) {
    try {
      const result = await apiFetch<{ liked: boolean }>(`/posts/${postId}/like`, { method: 'POST' });
      setPosts((current) => current.map((post) => post.id === postId ? {
        ...post,
        _count: { ...post._count, likes: Math.max(0, post._count.likes + (result.liked ? 1 : -1)) }
      } : post));
    } catch (cause) {
      Alert.alert('Action impossible', errorMessage(cause, 'Réessaie.'));
    }
  }

  if (selectedPostId) {
    return (
      <PostDiscussion
        postId={selectedPostId}
        targetCommentId={selectedPostId === initialPostId ? initialCommentId : null}
        userId={userId}
        onBack={() => setSelectedPostId(null)}
        onOpenProfile={onOpenProfile}
        onDeleted={(postId) => setPosts((current) => current.filter((item) => item.id !== postId))}
      />
    );
  }

  return (
    <>
    <FlatList
      style={{ backgroundColor: colors.background }}
      onScroll={event => onContentScroll?.(event.nativeEvent.contentOffset.y)}
      scrollEventThrottle={16}
      data={posts}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={colors.accent}
          colors={[colors.accent]}
          onRefresh={() => { setRefreshing(true); void load(); }}
        />
      }
      contentContainerStyle={styles.content}
      ListHeaderComponent={(
        <View style={styles.headerBlock}>
          <GlassSurface strength="soft" borderRadius={topNavigation ? 26 : 28}
            style={topNavigation ? styles.joinedHeader : styles.discoverHeader}>
            <View style={topNavigation ? styles.discoverHeader : styles.inlineHeader}>
              <View style={styles.discoverBrand}>
                <BrandMark size={30} />
                <View>
                  <Text style={[styles.heading, { color: colors.text }]}>{mode === "home" ? "KnowMe" : "Discover"}</Text>
                  <Text style={[styles.discoverSub, { color: colors.muted }]}>{mode === "home" ? "Fil d’actualité" : "Découvre de nouveaux contenus."}</Text>
                </View>
              </View>
              <GlassSurface strength="soft" borderRadius={21} style={styles.discoverIcon}>
                <KnowMeIcon name="discover" size={22} color={colors.accent} />
              </GlassSurface>
            </View>
            {topNavigation}
          </GlassSurface>
          {runtimeModules.map(module => (
            <Pressable key={module.key} accessibilityRole={module.href?'link':'text'}
              disabled={!module.href} onPress={() => {
                if (module.href) void Linking.openURL('https://knowme-nextech.vercel.app'+module.href);
              }} style={{padding:12,marginTop:8,borderRadius:16,
                backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border}}>
              <Text style={{color:colors.text,fontWeight:'700'}}>{module.title}{module.href ? ' →' : ''}</Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Créer une publication"
            onPress={()=>setComposerOpen(true)}
            style={[styles.quickComposer,{borderBottomColor:colors.border}]}>
            <Avatar uri={currentUser?.avatarUrl} name={currentUser?.displayName ?? 'KnowMe'} size={40}/>
            <View style={[styles.quickPrompt,{backgroundColor:colors.backgroundAccent}]}>
              <Text numberOfLines={1} style={{color:colors.muted,fontSize:13}}>
                {content.trim() || 'Qu’as-tu envie de partager ?'}
              </Text>
            </View>
            <KnowMeIcon name="create" size={23} color={colors.accent}/>
          </Pressable>
          {mode === 'home' && currentUser ? (
            <StoriesRail
              currentUser={currentUser}
              onOpenDiscover={onOpenDiscover ?? (() => {})}
              openComposer={storyComposerRequest}
              initialStoryId={initialStoryId}
              onComposerOpened={onStoryComposerHandled}
            />
          ) : null}
        </View>
      )}
      ListEmptyComponent={<View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={[styles.title, { color: colors.text }]}>Le fil est calme</Text><Text style={[styles.muted, { color: colors.muted }]}>Sois la première personne à partager quelque chose.</Text></View>}
      ListFooterComponent={hasMore ? <ActionButton title={loadingMore ? 'Chargement…' : 'Afficher plus de publications'} disabled={loadingMore} onPress={() => void loadMore()} /> : null}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => setSelectedPostId(item.id)}
          style={[
            styles.card,
            styles.postCard,
            { backgroundColor: colors.background, borderColor: colors.border }
          ]}
        >
          <Pressable accessibilityRole="button" accessibilityLabel={`Voir le profil de ${item.author.displayName}`} onPress={() => onOpenProfile?.(item.author.username)} style={styles.authorRow}>
            <Avatar uri={item.author.avatarUrl} name={item.author.displayName} size={44} />
            <View style={styles.flex}><View style={styles.verifiedName}><Text style={[styles.title, { color: colors.text }]}>{item.author.displayName}</Text>{item.author.staff?.shield==='GOLD'?<GoldVerifiedBadge size={19}/>:null}{item.author.verification?.isVerified?<BlueVerifiedBadge size={19} label={item.author.verification.label}/>:null}<RemoteCosmeticBadges username={item.author.username} size={19}/></View><Text style={[styles.muted, { color: colors.muted }]}>@{item.author.username}</Text></View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Options de la publication"
            onPress={()=>setMenuPost(item)} style={[styles.postMenu,{backgroundColor:colors.backgroundAccent}]}>
            <Text style={{fontSize:24,lineHeight:26,color:colors.text}}>⋯</Text>
          </Pressable>
          <KnowMeMentionText text={item.content} style={[styles.postText, { color: colors.text }]}/>
          {item.media?.length?<View style={{flexDirection:'row',flexWrap:'wrap',gap:3}}>
            {item.media.slice(0,5).map((medium,index)=><View key={medium.url}
              style={{width:item.media!.length===1?'100%':index<2?'49%':'32%',
                height:item.media!.length===1?275:index<2?198:126,
                backgroundColor:colors.surface,position:'relative',overflow:'hidden',borderRadius:3}}>
              {medium.mimeType.startsWith('image/')?
                <Image source={{uri:resolvePostImage(medium.url)}}
                  style={{width:'100%',height:'100%'}} resizeMode="cover"/>:
                <PublicPostVideo url={medium.url}/>}
              {index===4&&item.media!.length>5?<View
                style={{position:'absolute',top:0,bottom:0,left:0,right:0,
                  backgroundColor:'#000a',alignItems:'center',justifyContent:'center'}}>
                <Text style={{color:'white',fontSize:27,fontWeight:'800'}}>+{item.media!.length-5}</Text>
              </View>:null}
            </View>)}
          </View>:item.imageUrl?<Image
            source={{uri:resolvePostImage(item.imageUrl)}}
            style={styles.postImage as ImageStyle} resizeMode="cover"/>:null}
          <View style={styles.actionsRow}>
            <MetricButton icon="heart" count={item._count.likes} label="J’aime" onPress={() => void like(item.id)} />
            <ActionButton title="Partager" onPress={() => { void Share.share({message:buildKnowMePublicLink({kind:'post',id:item.id})}); }} />
            <MetricButton icon="messages" count={item._count.comments} label="Commentaires" onPress={() => setSelectedPostId(item.id)} />
            <Text style={[styles.date, { color: colors.muted }]}>{formatPostDate(item.createdAt)}</Text>
          </View>
        </Pressable>
      )}
    />
    <PublicationActions
      post={menuPost} userId={userId} onClose={() => setMenuPost(null)}
      onView={id => setSelectedPostId(id)} onDelete={confirmRemovePost} onOpenProfile={onOpenProfile}
    />
    <PostComposerExperience
      visible={composerOpen&&!photoPickerOpen}
      author={currentUser ?? {displayName:'KnowMe',username:'knowme'}}
      content={content}
      onChangeContent={setContent}
      media={selectedPhotos}
      canAttachPhoto={postPhotoSupported}
      onChoosePhoto={()=>setPhotoPickerOpen(true)}
      onRemovePhoto={()=>setSelectedPhotos([])}
      onPublish={()=>void publish()}
      publishing={publishing}
      onClose={()=>{if(!publishing)setComposerOpen(false);}}
    />
    <AndroidMediaLibraryPicker
      visible={photoPickerOpen} purpose="publication" mediaFilter="all" allowVideo multiple
      maxSelection={500}
      onClose={()=>setPhotoPickerOpen(false)}
      onPickedMany={media=>{setSelectedPhotos(media);setPhotoPickerOpen(false);setComposerOpen(true);}}
    />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 28, gap: 8 },
  discussionScreen: { flex: 1 },
  discussionContent: { paddingHorizontal: 14, paddingBottom: 28, gap: 0 },
  discussionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 60, gap: 12 },
  discussionTitle: { flex: 1, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  roundControl: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  discussionPost: { paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  compactAuthor: { fontSize: 14.5, fontWeight: '800' },
  smallMeta: { fontSize: 11.5 },
  discussionMetrics: { flexDirection: 'row', alignItems: 'center', gap: 22, paddingTop: 3 },
  metricInline: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, fontWeight: '600' },
  commentsHeadingRow: { paddingTop: 20, paddingBottom: 8 },
  commentsHeading: { fontSize: 15, fontWeight: '800' },
  threadComment: { flexDirection: 'row', gap: 10, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  threadIdentity: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 },
  threadBody: { fontSize: 14.5, lineHeight: 21, marginTop: 4 },
  threadTools: { flexDirection: 'row', gap: 22, paddingTop: 7 },
  threadToolText: { fontSize: 12, fontWeight: '600', paddingVertical: 4 },
  emptyDiscussion: { alignItems: 'center', gap: 12, paddingVertical: 46 },
  emptyDiscussionText: { fontSize: 13, textAlign: 'center' },
  commentDock: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14 },
  commentDockInput: { flex: 1, minHeight: 44, maxHeight: 120, paddingVertical: 10, paddingHorizontal: 15, borderRadius: 22, fontSize: 14, textAlignVertical: 'center' },
  commentSend: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', transform: [{ rotate: '-90deg' }] },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheetScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheetPanel: { paddingHorizontal: 17, paddingTop: 10, paddingBottom: 32, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: StyleSheet.hairlineWidth },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 13, opacity: 0.45 },
  sheetHeading: { fontSize: 17, fontWeight: '800', marginBottom: 10 },
  sheetAction: { minHeight: 50, paddingHorizontal: 14, borderRadius: 14, justifyContent: 'center' },
  sheetActionLabel: { fontSize: 15, fontWeight: '600' },

  headerBlock: { gap: 10, marginBottom: 2 },
  joinedHeader: { overflow: 'hidden', padding: 0 },
  inlineHeader: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quickComposer:{minHeight:60,flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:StyleSheet.hairlineWidth,paddingHorizontal:6,paddingVertical:8},
  quickPrompt:{flex:1,minHeight:42,borderRadius:21,justifyContent:'center',paddingHorizontal:14},
  postMenu:{position:'absolute',right:0,top:9,minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:21,zIndex:2},
  discoverHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 54, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 0 },
  discoverBrand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  discoverSub: { fontSize: 10.5, marginTop: 0 },
  discoverIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  composerCard: { padding: 10, borderRadius: 18 },
  composerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' },
  composerPhotoPreview: { gap: 8, alignSelf: 'flex-start' },
  composerPreviewImage: { width: 144, height: 128, borderRadius: 14 },
  composerHint: { fontSize: 11 },
  postCard: { borderRadius: 0, borderWidth: 0, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 2, paddingVertical: 13 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  heading: { fontSize: 20, fontWeight: '800', letterSpacing: -0.35 },
  sectionTitle: { fontSize: 19, fontWeight: '800', marginTop: 3 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, padding: 15, gap: 10 },
  commentCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 14, gap: 9 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  verifiedName: {flexDirection:'row',alignItems:'center',gap:5,flexShrink:1},
  actionsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  flex: { flex: 1 },
  title: { fontSize: 17, fontWeight: '800' },
  postText: { fontSize: 15.5, lineHeight: 22 },
  postImage: { width: '100%', aspectRatio: 1.2, borderRadius: 18 },
  commentText: { fontSize: 15, lineHeight: 22 },
  muted: {},
  date: { marginLeft: 'auto', fontSize: 10.5 },
  dateText: { fontSize: 10.5 },
  input: { minHeight: 50, borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14.5, textAlignVertical: 'top' },
  action: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, paddingHorizontal: 13, paddingVertical: 9, alignItems: 'center' },
  actionText: { fontWeight: '800' },
  metricAction: { minHeight: 34, borderRadius: 17, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  metricCount: { fontSize: 11.5, fontWeight: '700' },
  metricPressed: { opacity: 0.68 },
  dangerAction: { borderWidth: 1 },
  dangerText: {},
  mutedAction: { opacity: 0.45 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#7A5CFF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontWeight: '900', fontSize: 18 },
  smallAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#171E2C', alignItems: 'center', justifyContent: 'center' },
  smallAvatarText: { color: '#7A5CFF', fontWeight: '900' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }
});
