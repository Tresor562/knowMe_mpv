import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';

type ConversationDraft = {
  userId: string;
  conversationId: string;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

type ConversationDraftList = { items: ConversationDraft[] };

type DraftStatus = 'loading' | 'ready' | 'saving' | 'saved' | 'conflict' | 'error';

export function ConversationDraftExperience({
  conversationId,
  onDraftChanged
}: {
  conversationId: string;
  onDraftChanged?: (content: string) => void;
}) {
  const { colors } = useAppearance();
  const [content, setContent] = useState('');
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState<DraftStatus>('loading');
  const [error, setError] = useState('');
  const loadedConversation = useRef('');

  const load = useCallback(async () => {
    setStatus('loading');
    setError('');
    setContent('');
    setVersion(0);
    loadedConversation.current = '';
    onDraftChanged?.('');

    try {
      const response = await apiFetch<ConversationDraftList>('/conversation-drafts');
      const current = response.items.find((item) => item.conversationId === conversationId);
      const nextContent = current?.content ?? '';
      setContent(nextContent);
      setVersion(current?.version ?? 0);
      loadedConversation.current = conversationId;
      onDraftChanged?.(nextContent);
      setStatus('ready');
    } catch (cause) {
      setContent('');
      setVersion(0);
      loadedConversation.current = '';
      onDraftChanged?.('');
      setError(cause instanceof Error ? cause.message : 'Brouillon indisponible.');
      setStatus('error');
    }
  }, [conversationId, onDraftChanged]);

  useEffect(() => {
    void load();
  }, [load]);

  function change(value: string) {
    setContent(value);
    onDraftChanged?.(value);
    if (status === 'saved') setStatus('ready');
  }

  async function save() {
    if (
      loadedConversation.current !== conversationId ||
      status === 'saving' ||
      (status !== 'ready' && status !== 'saved')
    ) {
      return;
    }
    setStatus('saving');
    setError('');
    try {
      const saved = await apiFetch<ConversationDraft>(
        `/conversation-drafts/${encodeURIComponent(conversationId)}`,
        {
          method: 'PUT',
          body: JSON.stringify({ content, expectedVersion: version })
        }
      );
      setVersion(saved.version);
      setContent(saved.content);
      onDraftChanged?.(saved.content);
      setStatus('saved');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Enregistrement impossible.';
      if (message.includes('CONVERSATION_DRAFT_VERSION_CONFLICT')) {
        setError('Le brouillon a changé sur un autre appareil. Recharge-le avant de réessayer.');
        setStatus('conflict');
      } else {
        loadedConversation.current = '';
        setError(message);
        setStatus('error');
      }
    }
  }

  async function remove() {
    if (
      loadedConversation.current !== conversationId ||
      status === 'saving' ||
      (status !== 'ready' && status !== 'saved')
    ) {
      return;
    }
    setStatus('saving');
    setError('');
    try {
      await apiFetch(`/conversation-drafts/${encodeURIComponent(conversationId)}`, {
        method: 'DELETE'
      });
      setContent('');
      setVersion(0);
      onDraftChanged?.('');
      setStatus('ready');
    } catch (cause) {
      loadedConversation.current = '';
      setError(cause instanceof Error ? cause.message : 'Suppression impossible.');
      setStatus('error');
    }
  }

  if (status === 'loading') {
    return <ActivityIndicator color={colors.accent} />;
  }

  const canMutate =
    loadedConversation.current === conversationId && (status === 'ready' || status === 'saved');

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>BROUILLON SYNCHRONISÉ</Text>
          <Text style={[styles.title, { color: colors.text }]}>Prépare ton message</Text>
        </View>
        <Text style={[styles.version, { color: colors.muted }]}>v{version}</Text>
      </View>

      <TextInput
        value={content}
        onChangeText={change}
        editable={status !== 'error' && status !== 'saving'}
        placeholder="Écris sans envoyer…"
        placeholderTextColor={colors.muted}
        multiline
        maxLength={8000}
        style={[
          styles.input,
          { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
          (status === 'error' || status === 'saving') && styles.disabled
        ]}
      />
      <Text style={[styles.counter, { color: colors.muted }]}>{content.length}/8000</Text>

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      {status === 'saved' ? (
        <Text style={[styles.saved, { color: colors.accent }]}>Brouillon synchronisé.</Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          disabled={!canMutate}
          onPress={() => void save()}
          style={[styles.primary, { backgroundColor: colors.accent }, !canMutate && styles.disabled]}
        >
          <Text style={{ color: colors.accentText, fontWeight: '900' }}>
            {status === 'saving' ? 'Synchronisation…' : 'Synchroniser'}
          </Text>
        </Pressable>
        {status === 'conflict' || status === 'error' ? (
          <Pressable
            onPress={() => void load()}
            style={[styles.secondary, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.text, fontWeight: '800' }}>Recharger</Text>
          </Pressable>
        ) : null}
        <Pressable
          disabled={!canMutate || (version === 0 && content.length === 0)}
          onPress={() => void remove()}
          style={[
            styles.secondary,
            { borderColor: colors.border },
            (!canMutate || (version === 0 && content.length === 0)) && styles.disabled
          ]}
        >
          <Text style={{ color: colors.text, fontWeight: '800' }}>Effacer</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 10 },
  headingRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  headingCopy: { flex: 1 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  title: { fontSize: 18, fontWeight: '900', marginTop: 3 },
  version: { fontSize: 12, fontWeight: '800' },
  input: { minHeight: 118, borderWidth: 1, borderRadius: 15, padding: 13, textAlignVertical: 'top' },
  counter: { fontSize: 11, textAlign: 'right' },
  error: { fontSize: 13, lineHeight: 19 },
  saved: { fontSize: 13, fontWeight: '800' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primary: { borderRadius: 13, paddingHorizontal: 14, paddingVertical: 11 },
  secondary: { borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 11 },
  disabled: { opacity: 0.45 }
});
