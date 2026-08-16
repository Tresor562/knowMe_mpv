import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';

type EditedMessage = {
  id: string;
  conversationId: string;
  content: string;
  editedAt: string | null;
  presentation?: { kind: 'TEXT'; text: string };
};

export function MessageEditControl({
  conversationId,
  messageId,
  initialContent,
  initialEditedAt,
  onUpdated,
  onCancel
}: {
  conversationId: string;
  messageId: string;
  initialContent: string;
  initialEditedAt: string | null;
  onUpdated?: (message: EditedMessage) => void;
  onCancel?: () => void;
}) {
  const { colors } = useAppearance();
  const [content, setContent] = useState(initialContent);
  const [editedAt, setEditedAt] = useState<string | null>(initialEditedAt);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    const normalized = content.trim();
    if (!normalized || normalized.length > 4000 || busy || conflict) return;
    setBusy(true);
    setError('');
    try {
      const updated = await apiFetch<EditedMessage>(
        `/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            content: normalized,
            expectedEditedAt: editedAt
          })
        }
      );
      setContent(updated.content);
      setEditedAt(updated.editedAt);
      onUpdated?.(updated);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Modification impossible.';
      if (message.includes('MESSAGE_EDIT_VERSION_CONFLICT')) {
        setConflict(true);
        setError('Ce message a déjà été modifié ailleurs. Recharge la conversation avant de réessayer.');
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.eyebrow, { color: colors.accent }]}>MODIFIER TON MESSAGE</Text>
      <TextInput
        value={content}
        onChangeText={setContent}
        multiline
        maxLength={4000}
        editable={!busy && !conflict}
        placeholder="Corrige ton message…"
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            color: colors.text
          }
        ]}
      />
      <Text style={[styles.counter, { color: colors.muted }]}>{content.length}/4000</Text>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      <View style={styles.actions}>
        <Pressable
          disabled={busy || conflict || !content.trim()}
          onPress={() => void save()}
          style={[
            styles.primary,
            { backgroundColor: colors.accent },
            (busy || conflict || !content.trim()) && styles.disabled
          ]}
        >
          <Text style={{ color: colors.accentText, fontWeight: '900' }}>
            {busy ? 'Modification…' : 'Enregistrer'}
          </Text>
        </Pressable>
        {onCancel ? (
          <Pressable
            disabled={busy}
            onPress={onCancel}
            style={[styles.secondary, { borderColor: colors.border }, busy && styles.disabled]}
          >
            <Text style={{ color: colors.text, fontWeight: '800' }}>Annuler</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 10 },
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  input: { minHeight: 112, borderWidth: 1, borderRadius: 15, padding: 13, textAlignVertical: 'top' },
  counter: { fontSize: 11, textAlign: 'right' },
  error: { fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primary: { borderRadius: 13, paddingHorizontal: 14, paddingVertical: 11 },
  secondary: { borderWidth: 1, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 11 },
  disabled: { opacity: 0.45 }
});
