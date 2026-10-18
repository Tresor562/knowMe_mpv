import { buildKnowMePublicAvatarUrl } from '@knowme/link-contract';
import { useState } from 'react';
import {
  ActivityIndicator, Image, Modal, Pressable, StatusBar, StyleSheet, Text, View
} from 'react-native';
import { AndroidMediaLibraryPicker, type SelectedAndroidMedia } from './AndroidMediaLibraryPicker';
import { useAppearance } from './AppearanceProvider';
import { useI18n } from './I18nProvider';
import { apiFetch } from './api';
import { uploadKnowMeMobileMedia } from './mobile-media-upload';
import { avatarActionText, canRemoveAvatar } from './profile-avatar-actions-model';
import { removeActiveProfileAvatar } from './profile-avatar-removal';
import { KnowMeToast } from './ui/KnowMeFeedback';
import { KnowMeIcon, type KnowMeIconName } from './ui/KnowMeUI';

function AvatarActionRow({
  icon, title, description, onPress, disabled = false, danger = false
}: {
  icon: KnowMeIconName;
  title: string;
  description: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const { colors } = useAppearance();
  const tint = disabled ? colors.muted : danger ? colors.danger : colors.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row, pressed && !disabled && { backgroundColor: colors.backgroundAccent }
      ]}
    >
      <View style={[styles.actionIcon, { backgroundColor: colors.backgroundAccent }]}>
        <KnowMeIcon name={icon} color={tint} size={21} />
      </View>
      <View style={styles.actionCopy}>
        <Text style={[styles.actionTitle, { color: disabled ? colors.muted : danger ? colors.danger : colors.text }]}>
          {title}
        </Text>
        <Text style={[styles.actionDescription, { color: colors.muted }]}>
          {description}
        </Text>
      </View>
      <KnowMeIcon name="arrow" size={17} color={colors.muted} />
    </Pressable>
  );
}

/** Native first: one sheet, meaningful iconography and server-authoritative writes. */
export function MobileAvatarQuickActions({
  avatarUrl, displayName, onCreateStory, onUpdated
}: {
  avatarUrl?: string | null;
  displayName: string;
  onCreateStory: () => void;
  onUpdated: () => Promise<void>;
}) {
  const { colors } = useAppearance();
  const { locale } = useI18n();
  const copy = avatarActionText(locale === 'en' ? 'en' : 'fr');
  const [menu, setMenu] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const [preview, setPreview] = useState(false);
  const [chooseFile, setChooseFile] = useState(false);
  const [busy, setBusy] = useState(false);

  function closeMenu() {
    if (busy) return;
    setMenu(false);
    setConfirming(false);
    setRemoveError('');
  }

  async function changeAvatar(media: SelectedAndroidMedia) {
    if (busy) return;
    setChooseFile(false);
    setBusy(true);
    try {
      const capability = await apiFetch<{ upload: boolean; publicAvatar: boolean }>(
        '/media/public/avatar-capabilities'
      );
      if (!capability.upload || !capability.publicAvatar) {
        throw new Error(copy.serverMissing);
      }
      const assetId = await uploadKnowMeMobileMedia(media, 'AVATAR');
      await apiFetch('/account/profile', {
        method: 'PATCH',
        body: JSON.stringify({ avatarUrl: buildKnowMePublicAvatarUrl(assetId) })
      });
      await onUpdated();
      KnowMeToast.show(copy.pictureChanged, 'success');
    } catch (cause) {
      KnowMeToast.show(cause instanceof Error ? cause.message : copy.uploadFailed, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function removeAvatar() {
    if (!canRemoveAvatar(avatarUrl, busy)) return;
    setBusy(true);
    setRemoveError('');
    try {
      const result = await removeActiveProfileAvatar(
        payload => apiFetch('/account/profile', {
          method: 'PATCH',
          body: JSON.stringify(payload)
        }),
        onUpdated
      );
      setPreview(false);
      setConfirming(false);
      setMenu(false);
      KnowMeToast.show(result.profileSynced ? copy.removed : copy.pendingSync,
        result.profileSynced ? 'success' : 'info');
    } catch (cause) {
      // Keep the photo and the confirmation view visible for a deliberate retry.
      setRemoveError(cause instanceof Error ? cause.message : copy.removeFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.openActions}
        accessibilityHint={copy.hint}
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={() => { setConfirming(false); setRemoveError(''); setMenu(true); }}
        style={[styles.plus, { backgroundColor: colors.accent, borderColor: colors.background }]}
      >
        {busy ? <ActivityIndicator color={colors.accentText} size="small" /> :
          <Text style={[styles.plusLabel, { color: colors.accentText }]}>+</Text>}
      </Pressable>

      <Modal visible={menu} transparent animationType="slide"
        statusBarTranslucent onRequestClose={closeMenu}>
        <View style={styles.scrim}>
          <Pressable style={StyleSheet.absoluteFillObject}
            accessibilityLabel={copy.close} onPress={closeMenu} />
          <View
            accessibilityViewIsModal
            style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />
            {confirming ? (
              <>
                <View style={styles.sheetHeading}>
                  <View style={[styles.warningIcon, { backgroundColor: colors.backgroundAccent }]}>
                    <KnowMeIcon name="close" size={22} color={colors.danger} />
                  </View>
                  <Text style={[styles.headingText, { color: colors.text }]}>
                    {copy.confirmTitle}
                  </Text>
                  <Text style={[styles.description, { color: colors.muted }]}>
                    {copy.confirmDescription}
                  </Text>
                </View>
                {removeError ? (
                  <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>
                    {removeError}
                  </Text>
                ) : null}
                <View style={styles.confirmButtons}>
                  <Pressable accessibilityRole="button" disabled={busy}
                    style={[styles.secondaryButton, { borderColor: colors.border }]}
                    onPress={() => { setConfirming(false); setRemoveError(''); }}>
                    <Text style={[styles.buttonLabel, { color: colors.text }]}>{copy.cancel}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" disabled={busy}
                    accessibilityState={{ disabled: busy }}
                    style={[styles.dangerButton, { backgroundColor: colors.danger, opacity: busy ? .75 : 1 }]}
                    onPress={() => { void removeAvatar(); }}>
                    {busy ? <ActivityIndicator size="small" color="#fff" /> : null}
                    <Text style={[styles.buttonLabel, { color: '#fff' }]}>
                      {busy ? copy.removing : copy.remove}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <View style={styles.sheetHeading}>
                  <Text style={[styles.headingText, { color: colors.text }]}>{copy.title}</Text>
                  <Text style={[styles.description, { color: colors.muted }]}>{copy.subtitle}</Text>
                </View>
                <AvatarActionRow icon="create" title={copy.addStory}
                  description={copy.addStoryHint} onPress={() => {
                    closeMenu(); onCreateStory();
                  }} />
                <AvatarActionRow icon="search" title={copy.view}
                  description={avatarUrl ? copy.viewHint : copy.noPicture}
                  disabled={!avatarUrl}
                  onPress={() => { closeMenu(); setPreview(true); }} />
                <AvatarActionRow icon="camera" title={copy.change}
                  description={copy.changeHint} onPress={() => {
                    closeMenu(); setChooseFile(true);
                  }} />
                {avatarUrl ? <AvatarActionRow icon="close" title={copy.remove}
                  description={copy.removeHint} danger
                  onPress={() => { setRemoveError(''); setConfirming(true); }} /> : null}
                <Pressable accessibilityRole="button" style={styles.dismiss} onPress={closeMenu}>
                  <Text style={{ color: colors.accent, fontWeight: '800' }}>{copy.close}</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={preview && Boolean(avatarUrl)} animationType="fade"
        statusBarTranslucent onRequestClose={() => setPreview(false)}>
        <View style={[styles.preview, { backgroundColor: colors.background }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={copy.back}
            onPress={() => setPreview(false)}
            style={[styles.previewClose, { top: (StatusBar.currentHeight ?? 24) + 14 }]}>
            <KnowMeIcon name="back" size={20} color={colors.text} />
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
              {copy.back}
            </Text>
          </Pressable>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} accessibilityLabel={displayName}
              style={styles.photo} resizeMode="contain" />
          ) : null}
          <Text style={[styles.previewName, { color: colors.text }]}>{displayName}</Text>
        </View>
      </Modal>

      <AndroidMediaLibraryPicker
        visible={chooseFile} purpose="profile" allowVideo={false}
        mediaFilter="photo" lockFilter
        onClose={() => setChooseFile(false)}
        onPicked={media => { void changeAvatar(media); }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  plus: {
    position: 'absolute', bottom: -4, right: -7,
    minWidth: 44, minHeight: 44, borderWidth: 3, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', zIndex: 3
  },
  plusLabel: { fontSize: 24, lineHeight: 28, fontWeight: '700' },
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(3, 8, 18, .68)' },
  sheet: {
    borderWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28
  },
  grabber: { width: 36, height: 4, borderRadius: 5, alignSelf: 'center', marginBottom: 20 },
  sheetHeading: { paddingHorizontal: 8, marginBottom: 13, gap: 7 },
  headingText: { fontSize: 20, fontWeight: '800', letterSpacing: -.3 },
  description: { fontSize: 13, lineHeight: 19 },
  row: {
    minHeight: 65, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 15,
    flexDirection: 'row', alignItems: 'center', gap: 13
  },
  actionIcon: {
    width: 42, height: 42, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center'
  },
  actionCopy: { flex: 1, gap: 3 },
  actionTitle: { fontSize: 15, fontWeight: '700' },
  actionDescription: { fontSize: 12, lineHeight: 16 },
  dismiss: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  warningIcon: {
    height: 48, width: 48, borderRadius: 19, alignItems: 'center',
    justifyContent: 'center', marginBottom: 6
  },
  error: { paddingHorizontal: 10, paddingVertical: 10, fontSize: 13, lineHeight: 19 },
  confirmButtons: { flexDirection: 'row', gap: 10, paddingHorizontal: 5, marginTop: 12 },
  secondaryButton: {
    flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderRadius: 16, paddingHorizontal: 8
  },
  dangerButton: {
    flex: 1, minHeight: 50, borderRadius: 16, alignItems: 'center',
    justifyContent: 'center', flexDirection: 'row', gap: 7, paddingHorizontal: 8
  },
  buttonLabel: { fontWeight: '800', fontSize: 14 },
  preview: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  previewClose: {
    position: 'absolute', left: 20, zIndex: 2, minHeight: 48,
    flexDirection: 'row', gap: 9, alignItems: 'center', paddingHorizontal: 4
  },
  photo: { width: '100%', height: '78%' },
  previewName: { fontSize: 15, fontWeight: '700', marginTop: 10 }
});
