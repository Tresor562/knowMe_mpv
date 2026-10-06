import { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';
import { getRealtimeSocket } from './realtime';
import { GlassSurface, KnowMeIcon, PressScale } from './ui/KnowMeUI';

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
  const { colors, visual } = useAppearance();
  const [content, setContent] = useState(initialContent);
  const [baseContent, setBaseContent] = useState(initialContent);
  const [editedAt, setEditedAt] = useState<string | null>(initialEditedAt);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    let connectedSocket: Awaited<ReturnType<typeof getRealtimeSocket>> = null;
    const onMessageUpdated = (message: EditedMessage) => {
      if (message.id !== messageId || message.conversationId !== conversationId) return;
      setEditedAt(message.editedAt);
      setBaseContent(message.content);
      setContent((current) => {
        if (current !== baseContent && current !== message.content) {
          setConflict(true);
          setError('Ce message a été modifié ailleurs pendant ta saisie. Garde ton texte ou reprends la version serveur.');
          return current;
        }
        setConflict(false);
        setError('');
        return message.content;
      });
      onUpdated?.(message);
    };

    void getRealtimeSocket().then((socket) => {
      if (!active || !socket) return;
      connectedSocket = socket;
      socket.on('message:updated', onMessageUpdated);
    });

    return (
    <GlassSurface strength="medium" borderRadius={visual.cardRadius} style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.editMarker, { backgroundColor: colors.accent }]} />
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.text }]}>Modification du message</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Le brouillon actuel reste disponible si tu annules.
          </Text>
        </View>
        {onCancel ? (
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Annuler la modification"
            disabled={busy}
            onPress={onCancel}
            style={[
              styles.closeButton,
              {
                backgroundColor: colors.backgroundAccent,
                borderColor: colors.border,
                borderRadius: visual.controlRadius
              }
            ]}
          >
            <KnowMeIcon name="close" size={18} color={colors.text} />
          </PressScale>
        ) : null}
      </View>

      <TextInput
        value={content}
        onChangeText={setContent}
        multiline
        maxLength={4000}
        editable={!busy}
        autoFocus
        placeholder="Modifier le message…"
        placeholderTextColor={colors.muted}
        selectionColor={colors.accent}
        style={[
          styles.input,
          {
            backgroundColor: colors.backgroundAccent,
            borderColor: conflict ? colors.danger : colors.border,
            color: colors.text,
            borderRadius: visual.inputRadius
          }
        ]}
      />

      <View style={styles.metaRow}>
        {error ? (
          <Text accessibilityLiveRegion="polite" style={[styles.error, { color: colors.danger }]}>
            {error}
          </Text>
        ) : (
          <View style={styles.metaSpacer} />
        )}
        <Text style={[styles.counter, { color: colors.muted }]}>{content.length}/4000</Text>
      </View>

      <View style={styles.actions}>
        {conflict ? (
          <PressScale
            accessibilityRole="button"
            accessibilityLabel="Reprendre la version serveur"
            disabled={busy}
            onPress={resetToServer}
            style={[
              styles.secondary,
              { borderColor: colors.border, borderRadius: visual.controlRadius },
              busy && styles.disabled
            ]}
          >
            <Text style={[styles.secondaryText, { color: colors.text }]}>Version serveur</Text>
          </PressScale>
        ) : null}

        <PressScale
          accessibilityRole="button"
          accessibilityLabel="Enregistrer la modification"
          disabled={busy || conflict || !content.trim()}
          onPress={() => void save()}
          style={[
            styles.primary,
            { backgroundColor: colors.accent, borderRadius: visual.controlRadius },
            (busy || conflict || !content.trim()) && styles.disabled
          ]}
        >
          <Text style={[styles.primaryText, { color: colors.accentText }]}>
            {busy ? 'Modification…' : 'Enregistrer'}
          </Text>
        </PressScale>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 10,
    marginBottom: 8,
    padding: 10,
    gap: 8
  },
  header: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9
  },
  editMarker: {
    width: 3,
    height: 30,
    borderRadius: 3
  },
  headerCopy: { flex: 1 },
  title: { fontSize: 13.5, fontWeight: '700' },
  subtitle: { fontSize: 11, lineHeight: 15, marginTop: 1 },
  closeButton: {
    width: 44,
    height: 44,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  input: {
    minHeight: 52,
    maxHeight: 132,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 13,
    paddingVertical: 10,
    textAlignVertical: 'top',
    fontSize: 15,
    lineHeight: 20
  },
  metaRow: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8
  },
  metaSpacer: { flex: 1 },
  counter: { fontSize: 11, marginLeft: 'auto' },
  error: { flex: 1, fontSize: 12, lineHeight: 17 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8
  },
  primary: {
    minHeight: 44,
    minWidth: 112,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondary: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryText: { fontSize: 13.5, fontWeight: '700' },
  secondaryText: { fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.45 }
});
