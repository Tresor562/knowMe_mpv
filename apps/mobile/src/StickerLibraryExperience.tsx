import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import {
  getMobileStickerCatalog,
  MobileSticker,
  MobileStickerCatalog,
  MobileStickerPack,
  sendMobileSticker
} from './stickers';

function message(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

export function StickerLibraryExperience({
  conversationId,
  onSent
}: {
  conversationId: string;
  onSent?: () => void | Promise<void>;
}) {
  const [catalog, setCatalog] = useState<MobileStickerCatalog | null>(null);
  const [activePackKey, setActivePackKey] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    getMobileStickerCatalog()
      .then((result) => {
        setCatalog(result);
        setActivePackKey(result.packs[0]?.key ?? '');
      })
      .catch((cause) => setStatus(message(cause, 'Catalogue indisponible.')));
  }, []);

  async function send(pack: MobileStickerPack, sticker: MobileSticker) {
    if (!conversationId || busyKey) return;
    const key = `${pack.key}:${sticker.key}`;
    setBusyKey(key);
    setStatus('');
    try {
      await sendMobileSticker({
        packKey: pack.key,
        stickerKey: sticker.key,
        conversationId
      });
      await onSent?.();
      setStatus(`${sticker.emoji} ${sticker.name} envoyé.`);
    } catch (cause) {
      const text = message(cause, 'Envoi du sticker impossible.');
      setStatus(text);
      Alert.alert('Sticker impossible', text);
    } finally {
      setBusyKey('');
    }
  }

  if (!catalog) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color="#45e6bd" />
        <Text style={styles.muted}>{status || 'Chargement des stickers…'}</Text>
      </View>
    );
  }

  const activePack = catalog.packs.find((pack) => pack.key === activePackKey) ?? null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Stickers KnowMe</Text>
      <Text style={styles.description}>
        Bibliothèque gratuite, signée par le serveur et limitée aux assets du catalogue.
      </Text>

      {status ? <Text style={styles.status}>{status}</Text> : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.packStrip}>
        {catalog.packs.map((pack) => (
          <Pressable
            key={pack.key}
            onPress={() => setActivePackKey(pack.key)}
            style={({ pressed }) => [
              styles.packButton,
              pack.key === activePackKey && styles.packButtonActive,
              pressed && styles.mutedButton
            ]}
          >
            <Text style={styles.packEmoji}>{pack.coverEmoji}</Text>
            <Text style={styles.packName}>{pack.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {activePack ? (
        <View style={styles.stickerGrid}>
          {activePack.stickers.map((sticker) => {
            const key = `${activePack.key}:${sticker.key}`;
            return (
              <Pressable
                key={sticker.key}
                disabled={!conversationId || Boolean(busyKey)}
                accessibilityLabel={`Envoyer ${sticker.altText}`}
                onPress={() => void send(activePack, sticker)}
                style={({ pressed }) => [
                  styles.stickerButton,
                  (pressed || Boolean(busyKey)) && styles.mutedButton
                ]}
              >
                <Text style={styles.stickerEmoji}>{sticker.emoji}</Text>
                <Text style={styles.stickerName} numberOfLines={1}>
                  {busyKey === key ? 'Envoi…' : sticker.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Text style={styles.policy}>
        Aucun HTML · aucune URL cliente · aucun effet de jeu · anti-spam géré par la messagerie.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#10231d',
    borderColor: '#1c3a31',
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    gap: 12
  },
  title: { color: '#f4fff9', fontSize: 18, fontWeight: '900' },
  description: { color: '#b6c8c0', fontSize: 13, lineHeight: 19 },
  muted: { color: '#91a79e', fontSize: 12 },
  status: { color: '#45e6bd', fontSize: 12 },
  packStrip: { gap: 9 },
  packButton: {
    minWidth: 116,
    backgroundColor: '#091914',
    borderColor: '#25473b',
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
    gap: 5
  },
  packButtonActive: { borderColor: '#45e6bd' },
  packEmoji: { fontSize: 27 },
  packName: { color: '#f4fff9', fontSize: 11, fontWeight: '800' },
  stickerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  stickerButton: {
    width: '30%',
    minWidth: 88,
    flexGrow: 1,
    backgroundColor: '#091914',
    borderColor: '#25473b',
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
    gap: 6
  },
  stickerEmoji: { fontSize: 34 },
  stickerName: { color: '#f4fff9', fontSize: 10, fontWeight: '800' },
  mutedButton: { opacity: 0.45 },
  policy: { color: '#789187', fontSize: 10, lineHeight: 16 }
});
