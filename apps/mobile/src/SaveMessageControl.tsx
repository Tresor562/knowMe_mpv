import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';

type SavedMessagesResponse = {
  items: Array<{ messageId: string }>;
};

export function SaveMessageControl({ messageId }: { messageId: string }) {
  const { colors } = useAppearance();
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiFetch<SavedMessagesResponse>('/saved-messages?limit=100');
      setSaved(response.items.some((item) => item.messageId === messageId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'État indisponible.');
    } finally {
      setLoading(false);
    }
  }, [messageId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle() {
    if (busy || loading) return;
    setBusy(true);
    setError('');
    try {
      if (saved) {
        await apiFetch(`/saved-messages/${encodeURIComponent(messageId)}`, {
          method: 'DELETE'
        });
        setSaved(false);
      } else {
        await apiFetch('/saved-messages', {
          method: 'POST',
          body: JSON.stringify({ messageId })
        });
        setSaved(true);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Action impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.wrapper}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: saved, disabled: busy || loading }}
        disabled={busy || loading}
        onPress={() => void toggle()}
        style={[
          styles.button,
          { borderColor: saved ? colors.accent : colors.border },
          saved && { backgroundColor: colors.surfaceRaised },
          (busy || loading) && styles.disabled
        ]}
      >
        <Text style={{ color: saved ? colors.accent : colors.text, fontWeight: '800' }}>
          {loading ? '…' : saved ? '🔖 Enregistré' : '🔖 Enregistrer'}
        </Text>
      </Pressable>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 5 },
  button: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8 },
  disabled: { opacity: 0.5 },
  error: { fontSize: 12, lineHeight: 17 }
});
