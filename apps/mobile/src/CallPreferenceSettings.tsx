import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from 'react-native';
import { apiFetch, type ApiError } from './api';
import { useAppearance } from './AppearanceProvider';
import {
  buildCallPreferenceUpdate,
  minuteToTime,
  parseTimeToMinute,
  type CallPreferenceFields,
  type CallPreferenceView
} from './call-preparation';

function SettingSwitch({
  label,
  value,
  disabled,
  onValueChange
}: {
  label: string;
  value: boolean;
  disabled: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { colors } = useAppearance();
  return (
    <View
      style={[
        styles.settingRow,
        { backgroundColor: colors.surfaceRaised, borderColor: colors.border }
      ]}
    >
      <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
      <Switch
        accessibilityLabel={label}
        disabled={disabled}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.accent }}
        thumbColor={value ? colors.accentText : colors.muted}
      />
    </View>
  );
}

export function CallPreferenceSettings() {
  const { colors } = useAppearance();
  const [preference, setPreference] = useState<CallPreferenceView | null>(null);
  const [quietStart, setQuietStart] = useState('22:00');
  const [quietEnd, setQuietEnd] = useState('07:00');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const applyPreference = useCallback((next: CallPreferenceView) => {
    setPreference(next);
    setQuietStart(minuteToTime(next.quietStartMinute));
    setQuietEnd(minuteToTime(next.quietEndMinute));
  }, []);

  useEffect(() => {
    let active = true;
    void apiFetch<CallPreferenceView>('/calls/preferences')
      .then((next) => {
        if (active) applyPreference(next);
      })
      .catch((cause) => {
        if (active) {
          setMessage(
            cause instanceof Error
              ? cause.message
              : 'Impossible de charger les préférences d’appel.'
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applyPreference]);

  function patchPreference(patch: Partial<CallPreferenceFields>) {
    setPreference((current) => (current ? { ...current, ...patch } : current));
  }

  async function reloadPreference() {
    const next = await apiFetch<CallPreferenceView>('/calls/preferences');
    applyPreference(next);
  }

  async function savePreference() {
    if (!preference || saving) return;
    const quietStartMinute = parseTimeToMinute(quietStart);
    const quietEndMinute = parseTimeToMinute(quietEnd);
    const timezone = preference.timezone.trim();
    if (quietStartMinute === null || quietEndMinute === null) {
      setMessage('Utilise le format HH:MM entre 00:00 et 23:59.');
      return;
    }
    if (!timezone) {
      setMessage('Le fuseau horaire IANA est obligatoire.');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const fields: CallPreferenceFields = {
        ...preference,
        timezone,
        quietStartMinute,
        quietEndMinute
      };
      const saved = await apiFetch<CallPreferenceView>('/calls/preferences', {
        method: 'PUT',
        body: JSON.stringify(
          buildCallPreferenceUpdate(fields, preference.version)
        )
      });
      applyPreference(saved);
      setMessage('Préférences d’appel enregistrées.');
    } catch (cause) {
      if ((cause as ApiError).code === 'CALL_PREFERENCE_VERSION_CONFLICT') {
        try {
          await reloadPreference();
          setMessage(
            'Les préférences avaient changé ailleurs. La version récente a été rechargée.'
          );
        } catch {
          setMessage(
            'Les préférences ont changé ailleurs, mais leur version récente est indisponible.'
          );
        }
      } else {
        setMessage(
          cause instanceof Error
            ? cause.message
            : 'Impossible d’enregistrer les préférences.'
        );
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border }
      ]}
    >
      <Text style={[styles.cardTitle, { color: colors.text }]}>
        Ma disponibilité
      </Text>
      <Text style={[styles.cardText, { color: colors.muted }]}>
        Le serveur applique ces règles sans révéler à l’appelant la raison
        précise d’une indisponibilité.
      </Text>
      {loading ? (
        <ActivityIndicator color={colors.accent} />
      ) : preference ? (
        <>
          <SettingSwitch
            label="Recevoir des appels"
            value={preference.incomingCallsEnabled}
            disabled={saving}
            onValueChange={(value) =>
              patchPreference({ incomingCallsEnabled: value })
            }
          />
          <SettingSwitch
            label="Autoriser les appels audio"
            value={preference.allowAudioCalls}
            disabled={saving}
            onValueChange={(value) =>
              patchPreference({ allowAudioCalls: value })
            }
          />
          <SettingSwitch
            label="Autoriser les appels vidéo"
            value={preference.allowVideoCalls}
            disabled={saving}
            onValueChange={(value) =>
              patchPreference({ allowVideoCalls: value })
            }
          />
          <SettingSwitch
            label="Activer les heures calmes"
            value={preference.quietHoursEnabled}
            disabled={saving}
            onValueChange={(value) =>
              patchPreference({ quietHoursEnabled: value })
            }
          />
          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>
                Début
              </Text>
              <TextInput
                accessibilityLabel="Début des heures calmes"
                editable={!saving && preference.quietHoursEnabled}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                onChangeText={setQuietStart}
                placeholder="22:00"
                placeholderTextColor={colors.muted}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceRaised,
                    borderColor: colors.border,
                    color: colors.text
                  },
                  !preference.quietHoursEnabled && styles.disabled
                ]}
                value={quietStart}
              />
            </View>
            <View style={styles.timeField}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>
                Fin
              </Text>
              <TextInput
                accessibilityLabel="Fin des heures calmes"
                editable={!saving && preference.quietHoursEnabled}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                onChangeText={setQuietEnd}
                placeholder="07:00"
                placeholderTextColor={colors.muted}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceRaised,
                    borderColor: colors.border,
                    color: colors.text
                  },
                  !preference.quietHoursEnabled && styles.disabled
                ]}
                value={quietEnd}
              />
            </View>
          </View>
          <Text style={[styles.fieldLabel, { color: colors.text }]}>
            Fuseau horaire IANA
          </Text>
          <TextInput
            accessibilityLabel="Fuseau horaire IANA"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!saving}
            onChangeText={(value) => patchPreference({ timezone: value })}
            placeholder="Africa/Porto-Novo"
            placeholderTextColor={colors.muted}
            style={[
              styles.input,
              {
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.border,
                color: colors.text
              }
            ]}
            value={preference.timezone}
          />
          <SettingSwitch
            label="Micro actif au début"
            value={preference.microphoneEnabledByDefault}
            disabled={saving}
            onValueChange={(value) =>
              patchPreference({ microphoneEnabledByDefault: value })
            }
          />
          <SettingSwitch
            label="Caméra active au début"
            value={preference.cameraEnabledByDefault}
            disabled={saving}
            onValueChange={(value) =>
              patchPreference({ cameraEnabledByDefault: value })
            }
          />
          <SettingSwitch
            label="Test obligatoire avant l’appel"
            value={preference.devicePreviewRequired}
            disabled={saving}
            onValueChange={(value) =>
              patchPreference({ devicePreviewRequired: value })
            }
          />
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={() => void savePreference()}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: colors.accent },
              (pressed || saving) && styles.disabled
            ]}
          >
            <Text
              style={[styles.primaryButtonText, { color: colors.accentText }]}
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Text>
          </Pressable>
          <Text style={[styles.version, { color: colors.muted }]}>
            Version {preference.version}
            {preference.persisted ? ' · enregistrée' : ' · valeurs par défaut'}
          </Text>
        </>
      ) : null}
      {message ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.status, { color: colors.secondary }]}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 24, padding: 18, gap: 13 },
  cardTitle: { fontSize: 20, fontWeight: '900' },
  cardText: { fontSize: 15, lineHeight: 22 },
  settingRow: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  settingLabel: { flex: 1, fontWeight: '700' },
  timeRow: { flexDirection: 'row', gap: 10 },
  timeField: { flex: 1, gap: 7 },
  fieldLabel: { fontWeight: '800' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 16
  },
  primaryButton: {
    borderRadius: 16,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryButtonText: { fontWeight: '900' },
  version: { textAlign: 'center', fontSize: 12 },
  status: { lineHeight: 21 },
  disabled: { opacity: 0.45 }
});
