import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';
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
        <Text style={[styles.muted, { color: colors.muted }]}>{new Date(post.createdAt).toLocaleString('fr-FR')}</Text>
        <View style={styles.actionsRow}>
          <ActionButton title={`J’aime · ${post._count.likes}`} onPress={() => void toggleLike()} />
          <Text style={[styles.muted, { color: colors.muted }]}>Commentaires · {post._count.comments}</Text>
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
            <Text style={[styles.muted, { color: colors.muted }]}>{new Date(comment.createdAt).toLocaleString('fr-FR')}</Text>
          </View>
        );
      })}
      {!comments.length && <Text style={[styles.muted, { color: colors.muted }]}>Aucun commentaire pour le moment.</Text>}
      {hasMore && <ActionButton title={loadingMore ? 'Chargement…' : 'Afficher plus'} disabled={loadingMore} onPress={() => void loadMore()} />}
    </ScrollView>
  );
}

export function FeedExperience({ userId }: { userId: string }) {
  const { colors } = useAppearance();
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [content, setContent] = useState('');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
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

  async function publish() {
    const value = content.trim();
    if (!value || publishing) return;
    setPublishing(true);
    try {
      await apiFetch('/posts', { method: 'POST', body: JSON.stringify({ content: value }) });
      setContent('');
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
    <FlatList
      style={{ backgroundColor: colors.background }}
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
          <GlassSurface strength="soft" borderRadius={28} style={styles.discoverHeader}>
            <View style={styles.discoverBrand}>
              <BrandMark size={30} />
              <View>
                <Text style={[styles.heading, { color: colors.text }]}>Discover</Text>
                <Text style={[styles.discoverSub, { color: colors.muted }]}>Le monde KnowMe, sans bruit inutile.</Text>
              </View>
            </View>
            <GlassSurface strength="soft" borderRadius={21} style={styles.discoverIcon}>
              <KnowMeIcon name="discover" size={22} color={colors.accent} />
            </GlassSurface>
          </GlassSurface>
          <View
            style={[
              styles.card,
              styles.composerCard,
              { backgroundColor: colors.surface, borderColor: colors.border }
            ]}
          >
            <TextInput
              multiline
              maxLength={1000}
              value={content}
              onChangeText={setContent}
              placeholder="Partage une découverte, une question ou un défi…"
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
            <View style={styles.composerFooter}>
              <Text style={[styles.composerHint, { color: colors.muted }]}>{content.length}/1000</Text>
              <ActionButton title={publishing ? 'Publication…' : 'Publier'} disabled={publishing || !content.trim()} onPress={() => void publish()} />
            </View>
          </View>
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
            { backgroundColor: colors.surface, borderColor: colors.border }
          ]}
        >
          <View style={styles.authorRow}>
            <Avatar uri={item.author.avatarUrl} name={item.author.displayName} size={44} />
            <View style={styles.flex}><Text style={[styles.title, { color: colors.text }]}>{item.author.displayName}</Text><Text style={[styles.muted, { color: colors.muted }]}>@{item.author.username}</Text></View>
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
            <ActionButton title={`J’aime · ${item._count.likes}`} onPress={() => void like(item.id)} />
            <Text style={[styles.muted, { color: colors.muted }]}>Commentaires · {item._count.comments}</Text>
            <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString('fr-FR')}</Text>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, gap: 14 },
  headerBlock: { gap: 14, marginBottom: 4 },
  discoverHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 64, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 2 },
  discoverBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  discoverSub: { fontSize: 11.5, marginTop: 1 },
  discoverIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  composerCard: { padding: 14, borderRadius: 20 },
  composerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  composerHint: { fontSize: 11 },
  postCard: { borderRadius: 22 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  heading: { fontSize: 23, fontWeight: '900', letterSpacing: -0.45 },
  sectionTitle: { fontSize: 22, fontWeight: '900', marginTop: 4 },
  card: { borderWidth: 1, borderRadius: 24, padding: 18, gap: 12 },
  commentCard: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 10 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  flex: { flex: 1 },
  title: { fontSize: 17, fontWeight: '800' },
  postText: { fontSize: 16.5, lineHeight: 24 },
  postImage: { width: '100%', aspectRatio: 1.2, borderRadius: 18 },
  commentText: { fontSize: 15, lineHeight: 22 },
  muted: {},
  date: { marginLeft: 'auto' },
  input: { minHeight: 56, borderWidth: 1, borderRadius: 28, paddingHorizontal: 16, paddingVertical: 13, fontSize: 16, textAlignVertical: 'top' },
  action: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' },
  actionText: { fontWeight: '800' },
  dangerAction: { borderWidth: 1 },
  dangerText: {},
  mutedAction: { opacity: 0.45 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#7A5CFF', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontWeight: '900', fontSize: 18 },
  smallAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#171E2C', alignItems: 'center', justifyContent: 'center' },
  smallAvatarText: { color: '#7A5CFF', fontWeight: '900' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }
});
