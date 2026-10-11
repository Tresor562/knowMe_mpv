import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View
} from 'react-native';
import { apiFetch, type ApiError } from './api';
import { useAppearance } from './AppearanceProvider';
import { useI18n } from './I18nProvider';
import { GlassSurface } from './ui/KnowMeUI';

type PublicProfile = {
  header: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    joinedYear: number | null;
  };
  viewer: { owner: boolean };
  privacy: { lockedForViewer: boolean; lockMessage: string | null };
};

const PublicProfileContext = createContext<((username: string) => Promise<void>) | null>(null);

/**
 * A single in-app profile destination for all public @mentions.
 * The backend remains authoritative; a private/locked profile is never bypassed.
 */
export function PublicProfileProvider({ children }: { children: ReactNode }) {
  const { colors } = useAppearance();
  const { locale } = useI18n();
  const en = locale === 'en';
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);

  const close = useCallback(() => {
    generation.current += 1;
    setProfile(null);
    setLoading(false);
  }, []);

  const openProfile = useCallback(async (username: string) => {
    const requested = username.replace(/^@/, '').trim();
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(requested)) return;
    const current = ++generation.current;
    setProfile(null);
    setLoading(true);
    try {
      const incoming = await apiFetch<PublicProfile>(
        `/profile-experience/public/${encodeURIComponent(requested)}`
      );
      if (current === generation.current) setProfile(incoming);
    } catch (cause) {
      if (current !== generation.current) return;
      const status = (cause as ApiError).status;
      const title = en ? 'KnowMe profile' : 'Profil KnowMe';
      const feedback = status === 404
        ? (en ? 'This username does not exist on KnowMe.' : "Ce nom d’utilisateur n’existe pas sur KnowMe.")
        : status === 403 || status === 410
          ? (en ? 'This profile is no longer available.' : "Ce profil n’est plus disponible.")
          : (en ? 'Could not verify this profile. Try again.' : 'Impossible de vérifier ce profil. Réessayer.');
      Alert.alert(title, feedback);
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [en]);

  return (
    <PublicProfileContext.Provider value={openProfile}>
      {children}
      <Modal
        visible={loading || profile !== null}
        animationType="slide"
        onRequestClose={close}
        transparent
        statusBarTranslucent
      >
        <SafeAreaView style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0,0,0,0.45)'
        }}>
          <Pressable accessibilityRole="button" accessibilityLabel={en ? 'Close profile' : 'Fermer le profil'}
            onPress={close} style={{ flex: 1 }} />
          <GlassSurface strength="strong" borderRadius={26} style={{
            backgroundColor: colors.surface,
            padding: 20,
            minHeight: 250,
            maxHeight: '85%'
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 18, fontWeight: '600' }}>
                {en ? 'Profile' : 'Profil'}
              </Text>
              <Pressable onPress={close} accessibilityRole="button" accessibilityLabel={en ? 'Close' : 'Fermer'}
                style={{ paddingVertical: 10, paddingHorizontal: 14 }}>
                <Text style={{ color: colors.accent, fontWeight: '600' }}>✕</Text>
              </Pressable>
            </View>
            {loading ? (
              <ActivityIndicator accessibilityLabel={en ? 'Loading profile' : 'Chargement du profil'} color={colors.accent} />
            ) : profile ? (
              <ScrollView>
                <View style={{ alignItems: 'center', gap: 10, paddingVertical: 16 }}>
                  {profile.header.avatarUrl ? (
                    <Image source={{ uri: profile.header.avatarUrl }}
                      style={{ width: 86, height: 86, borderRadius: 43 }} />
                  ) : (
                    <View style={{ width: 86, height: 86, borderRadius: 43, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.backgroundAccent }}>
                      <Text style={{ color: colors.accent, fontSize: 34 }}>
                        {profile.header.displayName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={{ color: colors.text, fontSize: 23, fontWeight: '600', textAlign: 'center' }}>
                    {profile.header.displayName}
                  </Text>
                  <Text selectable style={{ color: colors.accent, fontSize: 16 }}>
                    @{profile.header.username}
                  </Text>
                  {profile.privacy.lockedForViewer ? (
                    <Text style={{ color: colors.muted, textAlign: 'center' }}>
                      {profile.privacy.lockMessage || (en ? 'This profile is locked.' : 'Ce profil est verrouillé.')}
                    </Text>
                  ) : (
                    <>
                      {profile.header.bio ? (
                        <Text style={{ color: colors.text, fontSize: 15, textAlign: 'center', lineHeight: 23 }}>
                          {profile.header.bio}
                        </Text>
                      ) : null}
                      {profile.header.joinedYear ? (
                        <Text style={{ color: colors.muted, fontSize: 13 }}>
                          {en ? 'On KnowMe since ' : 'Sur KnowMe depuis '}{profile.header.joinedYear}
                        </Text>
                      ) : null}
                    </>
                  )}
                </View>
              </ScrollView>
            ) : null}
          </GlassSurface>
        </SafeAreaView>
      </Modal>
    </PublicProfileContext.Provider>
  );
}

export function useOpenPublicProfile() {
  const open = useContext(PublicProfileContext);
  if (!open) throw new Error('PublicProfileProvider is required to open a user profile.');
  return open;
}
