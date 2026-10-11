import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Image, Modal, Pressable, SafeAreaView,
  ScrollView, StyleSheet, Text, View
} from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';
import { normalizeProfileUsername } from './profile-navigation-model';
import { Avatar } from './ui/KnowMeUI';

type Profile = {
  header: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    joinedYear: number | null;
  };
  viewer: { owner: boolean };
  privacy: {
    lockedForViewer: boolean;
    lockMessage: string | null;
  };
  statistics: Record<string, number | string | boolean | null> | null;
  wall: Array<{ id: string; text: string | null; createdAt: string }> | null;
};

const NavigationContext = createContext<((username: string) => void) | null>(null);

/** Opens the same server-authorized public profile without unmounting the previous screen. */
export function useProfileNavigation() {
  const open = useContext(NavigationContext);
  if (!open) throw new Error('ProfileNavigationProvider is missing.');
  return open;
}

export function ProfileNavigationProvider({ children }: { children: ReactNode }) {
  const { colors } = useAppearance();
  const [username, setUsername] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const openProfile = useCallback((value: string) => {
    const normalized = normalizeProfileUsername(value);
    if (normalized) setUsername(normalized);
  }, []);
  const close = useCallback(() => setUsername(null), []);

  useEffect(() => {
    let active = true;
    setProfile(null);
    setError('');
    if (!username) {
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    void apiFetch<Profile>('/profile-experience/public/' + encodeURIComponent(username))
      .then((incoming) => { if (active) setProfile(incoming); })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Profil indisponible.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [username]);

  return (
    <NavigationContext.Provider value={openProfile}>
      {children}
      <Modal visible={username !== null} animationType="slide" onRequestClose={close}>
        <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
          <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Retour à l'écran précédent"
              onPress={close} style={styles.back}>
              <Text style={[styles.backText, { color: colors.accent }]}>‹ Retour</Text>
            </Pressable>
            <Text style={[styles.title, { color: colors.text }]}>Profil KnowMe</Text>
          </View>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.accent} />
              <Text style={{ color: colors.muted }}>Chargement du profil…</Text>
            </View>
          ) : error || !profile ? (
            <View style={styles.center}>
              <Text accessibilityRole="alert" style={{ color: colors.text }}>
                {error || 'Profil introuvable.'}
              </Text>
              <Pressable onPress={close} style={styles.back}>
                <Text style={{ color: colors.accent }}>Retour</Text>
              </Pressable>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.content}>
              <View style={[styles.cover, { backgroundColor: colors.surfaceRaised }]} />
              <View style={styles.identity}>
                <Avatar uri={profile.header.avatarUrl} name={profile.header.displayName} size={96} />
                <Text style={[styles.name, { color: colors.text }]}>{profile.header.displayName}</Text>
                <Text style={[styles.handle, { color: colors.accent }]}>@{profile.header.username}</Text>
                {profile.header.joinedYear && (
                  <Text style={{ color: colors.muted }}>Depuis {profile.header.joinedYear}</Text>
                )}
                {profile.header.bio ? (
                  <Text style={[styles.bio, { color: colors.text }]}>{profile.header.bio}</Text>
                ) : null}
              </View>
              {profile.privacy.lockedForViewer ? (
                <View style={[styles.section, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.text, textAlign: 'center' }}>🔒 Profil privé</Text>
                  {profile.privacy.lockMessage ? (
                    <Text style={{ color: colors.muted, textAlign: 'center' }}>
                      {profile.privacy.lockMessage}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <>
                  {profile.statistics && Object.keys(profile.statistics).length > 0 ? (
                    <View style={[styles.section, { borderColor: colors.border }]}>
                      <Text style={[styles.subtitle, { color: colors.text }]}>Statistiques</Text>
                      {Object.entries(profile.statistics).map(([key, value]) => (
                        <View key={key} style={styles.stat}>
                          <Text style={{ color: colors.muted }}>{key.replace(/_/g, ' ')}</Text>
                          <Text style={{ color: colors.text }}>{value === null ? '—' : String(value)}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {profile.wall && profile.wall.length > 0 ? (
                    <View style={[styles.section, { borderColor: colors.border }]}>
                      <Text style={[styles.subtitle, { color: colors.text }]}>Publications du profil</Text>
                      {profile.wall.map((entry) => (
                        <View key={entry.id} style={styles.post}>
                          <Text style={{ color: colors.text }}>{entry.text ?? ''}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </NavigationContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toolbar: { flexDirection: 'row', alignItems: 'center', minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12 },
  back: { minWidth: 80, minHeight: 48, justifyContent: 'center' },
  backText: { fontSize: 16, fontWeight: '600' },
  title: { fontWeight: '600', fontSize: 18, marginLeft: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  content: { paddingBottom: 48 },
  cover: { height: 112 },
  identity: { alignItems: 'center', padding: 20, marginTop: -56, gap: 8 },
  name: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  handle: { fontSize: 15 },
  bio: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 4 },
  section: { marginHorizontal: 16, marginTop: 12, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, gap: 10 },
  subtitle: { fontWeight: '600', fontSize: 17, marginBottom: 4 },
  stat: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 4 },
  post: { paddingVertical: 8 }
});
