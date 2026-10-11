import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';
import { StoriesRail } from './StoriesRail';
import { Avatar, BrandMark, GlassSurface, KnowMeIcon } from './ui/KnowMeUI';

type Author = {
  id: string;
  displayName: string;
  username: string;
  avatarUrl?: string | null;
};

type PostSummary = {
  id: string;
  authorId: string;
  content: string;
  imageUrl?: string | null;
  createdAt: string;
  author: Author;
  _count: { likes: number; comments: number };
};

type PostDetail = PostSummary;

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  author: Author;
};

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

function PostDiscussion({ postId, userId, onBack, onDeleted }: {
  postId: string;
  userId: string;
  onBack: () => void;
  onDeleted: (postId: string) => void;
}) {
  const { colors } = useAppearance();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [postData, commentData] = await Promise.all([
        apiFetch<PostDetail>(`/posts/${postId}`),
        apiFetch<Comment[]>(`/posts/${postId}/comments`)
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

  async function loadMore() {
    const cursor = comments[comments.length - 1]?.id;
    if (!cursor || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await apiFetch<Comment[]>(`/posts/${postId}/comments?cursor=${encodeURIComponent(cursor)}`);
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
    try {
      const created = await apiFetch<Comment>(`/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content })
      });
      setCommentText('');
      setComments((current) => [...current, created]);
      setPost((current) => current ? {
        ...current,
        _count: { ...current._count, comments: current._count.comments + 1 }
      } : current);
    } catch (cause) {
      Alert.alert('Commentaire impossible', errorMessage(cause, 'Réessaie.'));
    } finally {
      setSending(false);
    }
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

  if (loading || !post) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.muted, { color: colors.muted }]}>{loading ? 'Chargement de la discussion…' : 'Publication introuvable.'}</Text>
        <ActionButton title="Retour" onPress={onBack} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>DISCUSSION</Text>
          <Text style={[styles.heading, { color: colors.text }]}>Publication</Text>
        </View>
        <ActionButton title="Retour" onPress={onBack} />
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.authorRow}>
          <Avatar uri={post.author.avatarUrl} name={post.author.displayName} size={44} />
          <View style={styles.flex}><Text style={[styles.title, { color: colors.text }]}>{post.author.displayName}</Text><Text style={[styles.muted, { color: colors.muted }]}>@{post.author.username}</Text></View>
        </View>
        <Text style={[styles.postText, { color: colors.text }]}>{post.content}</Text>
        {post.imageUrl ? (
          <Image
            source={{ uri: post.imageUrl }}
            style={styles.postImage}
            resizeMode="cover"
          />
        ) : null}
        <Text style={[styles.dateText, { color: colors.muted }]}>{formatPostDate(post.createdAt, true)}</Text>
        <View style={styles.actionsRow}>
          <MetricButton icon="heart" count={post._count.likes} label="J’aime" onPress={() => void toggleLike()} />
          <MetricButton icon="messages" count={post._count.comments} label="Commentaires" />
          {post.authorId === userId && (
            <ActionButton title={busyId === post.id ? 'Suppression…' : 'Supprimer'} disabled={busyId === post.id} danger onPress={confirmDeletePost} />
          )}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>Ajouter un commentaire</Text>
        <TextInput
          value={commentText}
          onChangeText={setCommentText}
          multiline
          maxLength={500}
          placeholder="Écris ce que tu penses…"
          placeholderTextColor={colors.muted}
          selectionColor={colors.accent}
          style={[
            styles.input,
            {
              backgroundColor: colors.backgroundAccent,
              borderColor: colors.border,
              color: colors.text
            }
          ]}
        />
        <ActionButton title={sending ? 'Envoi…' : 'Commenter'} disabled={sending || !commentText.trim()} onPress={() => void sendComment()} />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Commentaires</Text>
      {comments.map((comment) => {
        const canDelete = comment.author.id === userId || post.authorId === userId;
        return (
          <View key={comment.id} style={[styles.commentCard, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
            <View style={styles.authorRow}>
              <Avatar uri={comment.author.avatarUrl} name={comment.author.displayName} size={36} />
              <View style={styles.flex}><Text style={[styles.title, { color: colors.text }]}>{comment.author.displayName}</Text><Text style={[styles.muted, { color: colors.muted }]}>@{comment.author.username}</Text></View>
              {canDelete && (
                <ActionButton
                  title={busyId === comment.id ? '…' : 'Supprimer'}
                  disabled={busyId === comment.id}
                  danger
                  onPress={() => confirmDeleteComment(comment)}
                />
              )}
            </View>
            <Text style={[styles.commentText, { color: colors.text }]}>{comment.content}</Text>
            <Text style={[styles.dateText, { color: colors.muted }]}>{formatPostDate(comment.createdAt, true)}</Text>
          </View>
        );
      })}
      {!comments.length && <Text style={[styles.muted, { color: colors.muted }]}>Aucun commentaire pour le moment.</Text>}
      {hasMore && <ActionButton title={loadingMore ? 'Chargement…' : 'Afficher plus'} disabled={loadingMore} onPress={() => void loadMore()} />}
    </ScrollView>
  );
}

export function FeedExperience({
  userId, currentUser, onOpenDiscover, openStoryComposer, onStoryComposerOpened,
  openComposerRequest, onComposerOpened, onContentScroll, onSecondaryModeChange
}: {
  userId: string;
  currentUser?: {id:string;displayName:string;username:string;avatarUrl?:string|null};
  onOpenDiscover?: () => void;
  openStoryComposer?: boolean;
  onStoryComposerOpened?: () => void;
  openComposerRequest?: boolean;
  onComposerOpened?: () => void;
  onContentScroll?: (offset: number) => void;
  onSecondaryModeChange?: (active: boolean) => void;
}) {
  const { colors } = useAppearance();
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<PostSummary | null>(null);
  const [menuPost, setMenuPost] = useState<PostSummary | null>(null);
  const [reportPost, setReportPost] = useState<PostSummary | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const [postBusy, setPostBusy] = useState(false);
  useEffect(() => {
    if (!openComposerRequest) return;
    setEditingPost(null);
    setContent('');
    setImageUrl('');
    setComposerOpen(true);
    onComposerOpened?.();
  }, [openComposerRequest, onComposerOpened]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [storiesOpen, setStoriesOpen] = useState(false);
  useEffect(() => {
    onSecondaryModeChange?.(selectedPostId !== null || storiesOpen || composerOpen || menuPost !== null || reportPost !== null);
    return () => { onSecondaryModeChange?.(false); };
  }, [selectedPostId, storiesOpen, composerOpen, menuPost, reportPost, onSecondaryModeChange]);
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

  function openEditor(post: PostSummary | null = null) {
    setEditingPost(post);
    setContent(post?.content ?? '');
    setImageUrl(post?.imageUrl ?? '');
    setMenuPost(null);
    setComposerOpen(true);
  }

  function postLink(postId: string) {
    return 'https://knowme-nextech.vercel.app/feed/' + encodeURIComponent(postId);
  }

  async function sharePost(post: PostSummary) {
    setMenuPost(null);
    try {
      await Share.share({ message: postLink(post.id), url: postLink(post.id), title: 'KnowMe' });
    } catch (cause) {
      Alert.alert('Partage impossible', errorMessage(cause, 'Réessaie.'));
    }
  }

  function confirmRemovePost(post: PostSummary) {
    setMenuPost(null);
    if (post.authorId !== userId) return;
    Alert.alert('Supprimer la publication ?', 'Cette action est définitive.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => { void (async () => {
        setPostBusy(true);
        try {
          await apiFetch('/posts/' + encodeURIComponent(post.id), { method: 'DELETE' });
          setPosts(list => list.filter(item => item.id !== post.id));
        } catch (cause) {
          Alert.alert('Suppression impossible', errorMessage(cause, 'Réessaie.'));
        } finally { setPostBusy(false); }
      })(); } }
    ]);
  }

  function hidePost(post: PostSummary) {
    setMenuPost(null);
    setHiddenIds(current => new Set(current).add(post.id));
  }

  async function submitReport(reason: string) {
    if (!reportPost || postBusy) return;
    setPostBusy(true);
    try {
      await apiFetch('/reports', {
        method: 'POST',
        body: JSON.stringify({ targetType: 'POST', targetId: reportPost.id, reason })
      });
      setReportPost(null);
      Alert.alert('Signalement envoyé', 'Merci, notre équipe pourra examiner la publication.');
    } catch (cause) {
      Alert.alert('Signalement impossible', errorMessage(cause, 'Réessaie.'));
    } finally { setPostBusy(false); }
  }

  async function publish() {
    const value = content.trim();
    const attachment = imageUrl.trim();
    if (!value || publishing) return;
    if (attachment && !/^https:\/\/[^\s]+\.[^\s]+/i.test(attachment)) {
      Alert.alert('Lien invalide', 'Utilise une URL HTTPS d’image accessible publiquement.');
      return;
    }
    setPublishing(true);
    try {
      if (editingPost) {
        await apiFetch('/posts/' + encodeURIComponent(editingPost.id), {
          method: 'PATCH',
          body: JSON.stringify({ content: value, imageUrl: attachment || null })
        });
      } else {
        await apiFetch('/posts', { method: 'POST',
          body: JSON.stringify({ content: value, ...(attachment ? {imageUrl:attachment} : {}) }) });
      }
      setEditingPost(null);
      setContent('');
      setImageUrl('');
      setComposerOpen(false);
      await load();
    } catch (cause) {
      Alert.alert('Publication impossible', errorMessage(cause, 'Réessaie.'));
    } finally {
      setPublishing(false);
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
        userId={userId}
        onBack={() => setSelectedPostId(null)}
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
      data={posts.filter(item => !hiddenIds.has(item.id))}
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
          <View style={[styles.discoverHeader,{backgroundColor:colors.surface}]}>
            <View style={styles.discoverBrand}>
              <BrandMark size={30} />
              <View>
                <Text style={[styles.heading, { color: colors.text }]}>KnowMe</Text>
                <Text style={[styles.discoverSub, { color: colors.muted }]}>Accueil</Text>
              </View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Rechercher des profils et publications"
              disabled={!onOpenDiscover} onPress={onOpenDiscover}
              style={[styles.discoverIcon,{backgroundColor:colors.backgroundAccent}]}>
              <KnowMeIcon name="search" size={22} color={colors.text} />
            </Pressable>
          </View>
          {currentUser && onOpenDiscover ? (
            <StoriesRail currentUser={currentUser} onOpenDiscover={onOpenDiscover}
              openComposer={openStoryComposer}
              onComposerOpened={onStoryComposerOpened}
              onImmersiveChange={setStoriesOpen}/>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Créer une publication"
            onPress={() => openEditor()}
            style={[styles.quickCompose,{backgroundColor:colors.surface,borderColor:colors.border}]}>
            {currentUser
              ? <Avatar uri={currentUser.avatarUrl} name={currentUser.displayName} size={40}/>
              : <KnowMeIcon name="profile" size={32} color={colors.muted}/>}
            <Text style={[styles.quickComposePrompt,{color:colors.muted}]}>
              Quoi de neuf ?
            </Text>
            <KnowMeIcon name="edit" size={20} color={colors.accent}/>
          </Pressable>
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
            { backgroundColor: colors.surfaceGlass, borderColor: colors.border }
          ]}
        >
          <View style={styles.authorRow}>
            <Avatar uri={item.author.avatarUrl} name={item.author.displayName} size={44} />
            <View style={styles.flex}>
              <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.title, { color: colors.text }]}>
                {item.author.displayName}
              </Text>
              <Text style={[styles.muted, { color: colors.muted }]}>@{item.author.username}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Options de publication"
              onPress={event => { event.stopPropagation(); setMenuPost(item); }}
              style={styles.postMoreButton}>
              <Text style={{ color: colors.text, fontSize: 23, lineHeight: 27 }}>⋮</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Masquer la publication"
              onPress={event => { event.stopPropagation(); hidePost(item); }}
              style={styles.postMoreButton}>
              <KnowMeIcon name="close" size={18} color={colors.muted}/>
            </Pressable>
          </View>
          <Text style={[styles.postText, { color: colors.text }]}>{item.content}</Text>
          {item.imageUrl ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.postImage}
              resizeMode="cover"
            />
          ) : null}
          <View style={styles.actionsRow}>
            <MetricButton icon="heart" count={item._count.likes} label="J’aime" onPress={() => void like(item.id)} />
            <MetricButton icon="messages" count={item._count.comments} label="Commentaires" onPress={() => setSelectedPostId(item.id)} />
            <Pressable accessibilityRole="button" accessibilityLabel="Partager la publication"
              onPress={event => { event.stopPropagation(); void sharePost(item); }}
              style={[styles.shareAction,{backgroundColor:colors.backgroundAccent}]}>
              <KnowMeIcon name="arrow" size={17} color={colors.muted}/>
              <Text style={{fontSize:12,fontWeight:'700',color:colors.muted}}>Partager</Text>
            </Pressable>
            <Text style={[styles.date, { color: colors.muted }]}>{formatPostDate(item.createdAt)}</Text>
          </View>
        </Pressable>
      )}
    />
    <Modal visible={composerOpen} animationType="slide"
      onRequestClose={() => { if (!publishing) setComposerOpen(false); }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.composerScreen,{backgroundColor:colors.background}]}>
        <View style={[styles.composerTop,{borderColor:colors.border}]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Fermer l’éditeur"
            onPress={() => setComposerOpen(false)} disabled={publishing}
            style={styles.composeClose}>
            <KnowMeIcon name="back" size={24} color={colors.text}/>
          </Pressable>
          <Text style={[styles.composeTitle,{color:colors.text}]}>
            {editingPost ? 'Modifier la publication' : 'Créer une publication'}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={editingPost ? 'Enregistrer les modifications' : 'Publier'}
            disabled={!content.trim() || publishing}
            onPress={() => void publish()}
            style={[styles.composePublish,{backgroundColor:colors.backgroundAccent,opacity:content.trim()?1:0.5}]}>
            <Text style={{color:colors.accent,fontWeight:'800'}}>
              {publishing ? 'Envoi…' : editingPost ? 'Enregistrer' : 'Publier'}
            </Text>
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.composeScroll}>
          <View style={styles.composeAuthor}>
            {currentUser ? <Avatar uri={currentUser.avatarUrl} name={currentUser.displayName} size={51}/> : null}
            <View style={{flex:1}}>
              <Text numberOfLines={1} style={{color:colors.text,fontSize:16,fontWeight:'800'}}>
                {currentUser?.displayName || 'Moi'}
              </Text>
              <Text style={{color:colors.muted,fontSize:12}}>Public · KnowMe</Text>
            </View>
          </View>
          <TextInput
            accessibilityLabel="Texte de la publication"
            multiline autoFocus
            maxLength={2000}
            value={content}
            onChangeText={setContent}
            placeholder="Quoi de neuf ?"
            placeholderTextColor={colors.muted}
            selectionColor={colors.accent}
            textAlignVertical="top"
            style={[styles.composeInput,{color:colors.text}]}
          />
          <Text style={[styles.composerHint,{color:colors.muted,textAlign:'right'}]}>{content.length}/2000</Text>
          <View style={[styles.composeAttachment,{borderColor:colors.border}]}>
            <Text style={{fontSize:14,fontWeight:'700',color:colors.text}}>Image par lien HTTPS</Text>
            <Text style={{fontSize:12,lineHeight:18,color:colors.muted}}>
              L’import direct de photos, vidéos et fichiers nécessite encore la nouvelle API de publications.
            </Text>
            <TextInput accessibilityLabel="URL de l’image"
              placeholder="https://…"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              keyboardType="url"
              value={imageUrl} onChangeText={setImageUrl}
              style={[styles.input,{color:colors.text,backgroundColor:colors.backgroundAccent,borderColor:colors.border}]}/>
            {imageUrl.trim().startsWith('https://') ?
              <Image source={{uri:imageUrl.trim()}} resizeMode="contain" style={styles.composeImagePreview}/> : null}
          </View>
        </ScrollView>
        <View style={[styles.composeFooter,{borderColor:colors.border}]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Publier la publication"
            disabled={!content.trim() || publishing}
            onPress={() => void publish()}
            style={[styles.composeSend,{backgroundColor:colors.accent,opacity:content.trim()?1:0.5}]}>
            <Text style={{fontSize:16,fontWeight:'800',color:colors.accentText}}>
              {publishing ? 'Enregistrement…' : editingPost ? 'Enregistrer' : 'Publier'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    <Modal visible={Boolean(menuPost)} transparent animationType="fade"
      onRequestClose={() => setMenuPost(null)}>
      <Pressable style={styles.sheetBackdrop} onPress={() => setMenuPost(null)}>
        <Pressable onPress={event => event.stopPropagation()}
          style={[styles.sheetContent,{backgroundColor:colors.surface,borderColor:colors.border}]}>
          <View style={[styles.sheetGrip,{backgroundColor:colors.border}]}/>
          <Text style={[styles.sheetTitle,{color:colors.text}]}>Options de publication</Text>
          {menuPost?.authorId === userId ? (
            <>
              <Pressable accessibilityRole="button" style={styles.sheetOption}
                onPress={() => {if(menuPost) openEditor(menuPost);}}>
                <KnowMeIcon name="edit" size={21} color={colors.accent}/>
                <Text style={[styles.sheetOptionLabel,{color:colors.text}]}>Modifier la publication</Text>
              </Pressable>
              <Pressable accessibilityRole="button" style={styles.sheetOption}
                onPress={() => {if(menuPost) void sharePost(menuPost);}}>
                <KnowMeIcon name="arrow" size={20} color={colors.accent}/>
                <Text style={[styles.sheetOptionLabel,{color:colors.text}]}>Partager</Text>
              </Pressable>
              <Pressable accessibilityRole="button" style={styles.sheetOption}
                onPress={() => {if(menuPost) confirmRemovePost(menuPost);}} disabled={postBusy}>
                <KnowMeIcon name="close" size={19} color={colors.danger}/>
                <Text style={[styles.sheetOptionLabel,{color:colors.danger}]}>Supprimer</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable accessibilityRole="button" style={styles.sheetOption}
                onPress={() => {if(menuPost) hidePost(menuPost);}}>
                <KnowMeIcon name="close" size={20} color={colors.muted}/>
                <View style={{flex:1}}>
                  <Text style={[styles.sheetOptionLabel,{color:colors.text}]}>Pas intéressé</Text>
                  <Text style={[styles.sheetHint,{color:colors.muted}]}>Masquer sur cet écran uniquement</Text>
                </View>
              </Pressable>
              <Pressable accessibilityRole="button" style={styles.sheetOption}
                onPress={() => {setReportPost(menuPost);setMenuPost(null);}}>
                <KnowMeIcon name="bell" size={20} color={colors.muted}/>
                <Text style={[styles.sheetOptionLabel,{color:colors.text}]}>Signaler</Text>
              </Pressable>
              <Pressable accessibilityRole="button" style={styles.sheetOption}
                onPress={() => {if(menuPost) void sharePost(menuPost);}}>
                <KnowMeIcon name="arrow" size={20} color={colors.muted}/>
                <Text style={[styles.sheetOptionLabel,{color:colors.text}]}>Partager</Text>
              </Pressable>
            </>
          )}
          <Pressable accessibilityRole="button" style={styles.sheetDismiss}
            onPress={() => setMenuPost(null)}>
            <Text style={{color:colors.accent,fontWeight:'700'}}>Fermer</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
    <Modal visible={Boolean(reportPost)} transparent animationType="slide"
      onRequestClose={() => {if(!postBusy)setReportPost(null);}}>
      <Pressable style={styles.sheetBackdrop} onPress={() => {if(!postBusy)setReportPost(null);}}>
        <Pressable onPress={event => event.stopPropagation()}
          style={[styles.sheetContent,{backgroundColor:colors.surface,borderColor:colors.border}]}>
          <View style={[styles.sheetGrip,{backgroundColor:colors.border}]}/>
          <Text style={[styles.sheetTitle,{color:colors.text}]}>Signaler la publication</Text>
          <Text style={[styles.sheetHint,{color:colors.muted}]}>
            Sélectionne une raison. Le signalement sera transmis à la modération KnowMe.
          </Text>
          {[
            'Spam ou contenu trompeur',
            'Harcèlement ou intimidation',
            'Contenu violent ou choquant',
            'Autre infraction aux règles KnowMe'
          ].map(reason => (
            <Pressable key={reason} accessibilityRole="button" disabled={postBusy}
              onPress={() => void submitReport(reason)} style={styles.sheetOption}>
              <Text style={[styles.sheetOptionLabel,{color:colors.text}]}>{reason}</Text>
              <KnowMeIcon name="arrow" size={18} color={colors.muted}/>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" disabled={postBusy} style={styles.sheetDismiss}
            onPress={() => setReportPost(null)}>
            <Text style={{color:colors.accent,fontWeight:'700'}}>Annuler</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 28, gap: 11 },
  headerBlock: { gap: 10, marginBottom: 2 },
  discoverHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 50, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 0, borderRadius:16 },
  discoverBrand: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  discoverSub: { fontSize: 10.5, marginTop: 0 },
  discoverIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  composerCard: { padding: 10, borderRadius: 20 },
  postMoreButton: {width:37,minHeight:44,alignItems:'center',justifyContent:'center'},
  shareAction: {minHeight:34,borderRadius:17,paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:6},
  sheetBackdrop: {flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.55)'},
  sheetContent: {paddingHorizontal:18,paddingTop:12,paddingBottom:26,borderTopLeftRadius:26,borderTopRightRadius:26,borderWidth:StyleSheet.hairlineWidth,gap:5},
  sheetGrip: {alignSelf:'center',width:40,height:4,borderRadius:4,marginBottom:9},
  sheetTitle: {fontSize:18,fontWeight:'800',marginBottom:8},
  sheetOption: {flexDirection:'row',minHeight:52,alignItems:'center',gap:14,paddingHorizontal:8,borderRadius:15},
  sheetOptionLabel: {fontSize:15,fontWeight:'650',flex:1},
  sheetHint: {fontSize:12,lineHeight:18},
  sheetDismiss: {minHeight:48,alignItems:'center',justifyContent:'center',marginTop:8},
  quickCompose: {flexDirection:'row',alignItems:'center',minHeight:58,borderWidth:StyleSheet.hairlineWidth,borderRadius:20,paddingHorizontal:12,gap:11},
  quickComposePrompt: {flex:1,fontSize:14},
  composerScreen: {flex:1},
  composerTop: {minHeight:58,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:9,borderBottomWidth:StyleSheet.hairlineWidth},
  composeClose: {width:44,height:44,alignItems:'center',justifyContent:'center'},
  composeTitle: {fontSize:17,fontWeight:'800',flex:1},
  composePublish: {minWidth:72,minHeight:40,alignItems:'center',justifyContent:'center',borderRadius:14},
  composeScroll: {flexGrow:1,padding:18,gap:12},
  composeAuthor: {flexDirection:'row',alignItems:'center',gap:11},
  composeInput: {minHeight:210,fontSize:22,lineHeight:30,paddingVertical:12},
  composeAttachment: {borderTopWidth:StyleSheet.hairlineWidth,paddingTop:18,gap:9},
  composeImagePreview: {height:210,width:'100%',borderRadius:18},
  composeFooter: {paddingHorizontal:16,paddingVertical:12,borderTopWidth:StyleSheet.hairlineWidth},
  composeSend: {minHeight:50,alignItems:'center',justifyContent:'center',borderRadius:14},

  composerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  composerHint: { fontSize: 11 },
  postCard: { borderRadius: 20, paddingVertical: 13 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  heading: { fontSize: 20, fontWeight: '800', letterSpacing: -0.35 },
  sectionTitle: { fontSize: 19, fontWeight: '800', marginTop: 3 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, padding: 15, gap: 10 },
  commentCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 14, gap: 9 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
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
