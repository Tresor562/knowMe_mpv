import * as DocumentPicker from 'expo-document-picker';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { apiFetch } from './api';

type VerificationDocument = {
  id: string;
  kind: string;
  mimeType: string;
  sizeBytes: number;
};

type VerificationRequest = {
  id: string;
  subjectType: string;
  status: string;
  countryCode: string;
  publicCategory: string;
  publicReason?: string | null;
  documents: VerificationDocument[];
  decisions: Array<{
    id: string;
    action: string;
    reasonCode: string;
    userMessage?: string | null;
    createdAt: string;
  }>;
};

type VerificationState = {
  request: VerificationRequest | null;
  badge: {
    verified: true;
    label: string;
    category: string;
    verifiedAt: string;
    expiresAt?: string | null;
  } | null;
  identityStatus: string;
  canCreateNew: boolean;
};

type ButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
};

const TYPES = ['PERSON', 'CREATOR', 'ORGANIZATION'];
const CATEGORIES = ['PERSON', 'CREATOR', 'ARTIST', 'ATHLETE', 'BUSINESS', 'ORGANIZATION', 'PUBLIC_FIGURE'];
const DOCUMENTS = ['IDENTITY_FRONT', 'IDENTITY_BACK', 'SELFIE', 'REGISTRATION', 'AUTHORIZATION', 'SUPPORTING_EVIDENCE'];

function Button({ title, onPress, disabled = false, secondary = false }: ButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondaryButton,
        (pressed || disabled) && styles.mutedButton
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{title}</Text>
    </Pressable>
  );
}

function ChoiceRow({ values, selected, onSelect }: {
  values: string[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={styles.choiceRow}>
      {values.map((value) => (
        <Pressable
          key={value}
          onPress={() => onSelect(value)}
          style={[styles.choice, selected === value && styles.choiceActive]}
        >
          <Text style={[styles.choiceText, selected === value && styles.choiceTextActive]}>{value}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function VerificationExperience() {
  const [state, setState] = useState<VerificationState | null>(null);
  const [subjectType, setSubjectType] = useState('PERSON');
  const [countryCode, setCountryCode] = useState('BJ');
  const [category, setCategory] = useState('PERSON');
  const [reason, setReason] = useState('');
  const [documentKind, setDocumentKind] = useState('IDENTITY_FRONT');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setState(await apiFetch<VerificationState>('/verification/me'));
    } catch (cause) {
      Alert.alert('Certification indisponible', cause instanceof Error ? cause.message : 'Réessaie.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createRequest() {
    if (countryCode.trim().length !== 2 || !consentAccepted || busy) return;
    setBusy(true);
    try {
      await apiFetch('/verification/requests', {
        method: 'POST',
        body: JSON.stringify({
          subjectType,
          countryCode: countryCode.trim().toUpperCase(),
          publicCategory: category,
          publicReason: reason.trim() || undefined,
          termsVersion: '2026-08-identity-v1',
          termsAccepted: consentAccepted
        })
      });
      setConsentAccepted(false);
      setReason('');
      await load();
      Alert.alert('Demande créée', 'Ajoute les documents requis avant de l’envoyer.');
    } catch (cause) {
      Alert.alert('Création impossible', cause instanceof Error ? cause.message : 'Réessaie.');
    } finally {
      setBusy(false);
    }
  }

  async function pickAndUpload() {
    const request = state?.request;
    if (!request || busy) return;

    const picked = await DocumentPicker.getDocumentAsync({
      type: ['image/jpeg', 'image/png', 'application/pdf'],
      multiple: false,
      copyToCacheDirectory: true
    });
    if (picked.canceled || !picked.assets[0]) return;

    const asset = picked.assets[0];
    if (asset.size && asset.size > 10 * 1024 * 1024) {
      Alert.alert('Document trop volumineux', 'La taille maximale est de 10 Mo.');
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.append('kind', documentKind);
      form.append('file', {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType ?? 'application/octet-stream'
      } as unknown as Blob);
      await apiFetch(`/verification/requests/${request.id}/documents`, {
        method: 'POST',
        body: form
      });
      await load();
      Alert.alert('Document ajouté', 'Le fichier reste dans l’espace privé de vérification.');
    } catch (cause) {
      Alert.alert('Envoi impossible', cause instanceof Error ? cause.message : 'Réessaie.');
    } finally {
      setBusy(false);
    }
  }

  async function removeDocument(documentId: string) {
    const request = state?.request;
    if (!request || busy) return;
    setBusy(true);
    try {
      await apiFetch(`/verification/requests/${request.id}/documents/${documentId}`, { method: 'DELETE' });
      await load();
    } catch (cause) {
      Alert.alert('Suppression impossible', cause instanceof Error ? cause.message : 'Réessaie.');
    } finally {
      setBusy(false);
    }
  }

  function confirmSubmit() {
    const request = state?.request;
    if (!request || busy) return;
    Alert.alert('Envoyer la demande ?', 'Un examinateur autorisé pourra consulter les documents privés.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Envoyer', onPress: () => void submit() }
    ]);
  }

  async function submit() {
    const request = state?.request;
    if (!request) return;
    setBusy(true);
    try {
      await apiFetch(`/verification/requests/${request.id}/submit`, { method: 'POST' });
      await load();
      Alert.alert('Demande envoyée', 'Tu recevras une notification après l’examen.');
    } catch (cause) {
      Alert.alert('Envoi impossible', cause instanceof Error ? cause.message : 'Réessaie.');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    const request = state?.request;
    if (!request || busy) return;
    setBusy(true);
    try {
      await apiFetch(`/verification/requests/${request.id}/cancel`, { method: 'POST' });
      await load();
      Alert.alert('Demande annulée', 'Tu peux créer une nouvelle demande lorsque tu es prêt.');
    } catch (cause) {
      Alert.alert('Annulation impossible', cause instanceof Error ? cause.message : 'Réessaie.');
    } finally {
      setBusy(false);
    }
  }

  const request = state?.request;
  const canEdit = request && ['DRAFT', 'NEEDS_INFO'].includes(request.status);
  const canCancel = request && ['DRAFT', 'SUBMITTED', 'NEEDS_INFO'].includes(request.status);
  const showCreateForm = state?.canCreateNew ?? !request;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Certification</Text>
      <Text style={styles.description}>Premium et certification sont indépendants. Le badge est accordé uniquement après un examen humain.</Text>

      {state?.badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>✓ {state.badge.label} · {state.badge.category}</Text>
        </View>
      ) : null}

      {showCreateForm ? (
        <View style={styles.section}>
          <Text style={styles.label}>{request ? 'Nouvelle demande' : 'Type'}</Text>
          {request ? <Text style={styles.helper}>La dernière demande est terminée et reste affichée plus bas.</Text> : null}
          <ChoiceRow values={TYPES} selected={subjectType} onSelect={setSubjectType} />
          <Text style={styles.label}>Catégorie publique</Text>
          <ChoiceRow values={CATEGORIES} selected={category} onSelect={setCategory} />
          <TextInput
            value={countryCode}
            onChangeText={setCountryCode}
            autoCapitalize="characters"
            maxLength={2}
            placeholder="Pays, ex. BJ"
            placeholderTextColor="#789187"
            style={styles.input}
          />
          <TextInput
            value={reason}
            onChangeText={setReason}
            maxLength={500}
            multiline
            placeholder="Pourquoi ce compte doit-il être certifié ?"
            placeholderTextColor="#789187"
            style={[styles.input, styles.multiline]}
          />
          <Pressable
            onPress={() => setConsentAccepted((current) => !current)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consentAccepted }}
            style={styles.consentRow}
          >
            <View style={[styles.checkbox, consentAccepted && styles.checkboxActive]}>
              <Text style={styles.checkboxText}>{consentAccepted ? '✓' : ''}</Text>
            </View>
            <Text style={styles.consentText}>J’accepte que mes documents soient consultés uniquement par les examinateurs autorisés pour traiter cette demande.</Text>
          </Pressable>
          <Button title={busy ? 'Création…' : 'Créer ma demande'} disabled={busy || !consentAccepted || countryCode.trim().length !== 2} onPress={() => void createRequest()} />
        </View>
      ) : null}

      {request ? (
        <View style={styles.section}>
          <Text style={styles.status}>Dernière demande · {request.status}</Text>
          <Text style={styles.description}>{request.subjectType} · {request.publicCategory} · {request.countryCode}</Text>

          {canEdit ? <>
            <Text style={styles.label}>Type de document</Text>
            <ChoiceRow values={DOCUMENTS} selected={documentKind} onSelect={setDocumentKind} />
            <Button title={busy ? 'Traitement…' : 'Choisir et envoyer un document'} disabled={busy} onPress={() => void pickAndUpload()} />
          </> : null}

          <View style={styles.documentList}>
            {request.documents.map((document) => (
              <View key={document.id} style={styles.documentRow}>
                <View style={styles.documentText}>
                  <Text style={styles.documentTitle}>{document.kind}</Text>
                  <Text style={styles.helper}>{document.mimeType} · {Math.ceil(document.sizeBytes / 1024)} Ko</Text>
                </View>
                {canEdit ? <Pressable onPress={() => void removeDocument(document.id)}><Text style={styles.remove}>Retirer</Text></Pressable> : null}
              </View>
            ))}
            {!request.documents.length ? <Text style={styles.helper}>Aucun document ajouté.</Text> : null}
          </View>

          {request.decisions.map((decision) => (
            <View key={decision.id} style={styles.decision}>
              <Text style={styles.documentTitle}>{decision.action} · {decision.reasonCode}</Text>
              {decision.userMessage ? <Text style={styles.description}>{decision.userMessage}</Text> : null}
            </View>
          ))}

          {canEdit ? <Button title="Envoyer pour examen" disabled={busy} onPress={confirmSubmit} /> : null}
          {canCancel ? <Button title="Annuler la demande" disabled={busy} secondary onPress={() => void cancel()} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#10231d', borderColor: '#1c3a31', borderWidth: 1, borderRadius: 24, padding: 18, gap: 12 },
  title: { color: '#f4fff9', fontSize: 19, fontWeight: '900' },
  description: { color: '#b6c8c0', fontSize: 14, lineHeight: 21 },
  section: { gap: 12 },
  label: { color: '#91a79e', fontWeight: '800' },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  choice: { borderWidth: 1, borderColor: '#25473b', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  choiceActive: { backgroundColor: '#45e6bd', borderColor: '#45e6bd' },
  choiceText: { color: '#91a79e', fontSize: 11, fontWeight: '800' },
  choiceTextActive: { color: '#052017' },
  input: { minHeight: 50, backgroundColor: '#091914', borderColor: '#25473b', borderWidth: 1, borderRadius: 16, color: '#f4fff9', paddingHorizontal: 15, paddingVertical: 12, fontSize: 15, textAlignVertical: 'top' },
  multiline: { minHeight: 90 },
  button: { backgroundColor: '#45e6bd', borderRadius: 15, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center' },
  secondaryButton: { backgroundColor: 'transparent', borderColor: '#45e6bd', borderWidth: 1 },
  buttonText: { color: '#052017', fontWeight: '900' },
  secondaryButtonText: { color: '#45e6bd' },
  mutedButton: { opacity: 0.45 },
  badge: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#6cb8ff', backgroundColor: 'rgba(108,184,255,0.09)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  badgeText: { color: '#9fd0ff', fontWeight: '900' },
  status: { color: '#45e6bd', fontWeight: '900' },
  documentList: { gap: 9 },
  documentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: '#1c3a31', paddingTop: 9 },
  documentText: { flex: 1 },
  documentTitle: { color: '#f4fff9', fontWeight: '800' },
  helper: { color: '#789187', fontSize: 12 },
  remove: { color: '#ff9d66', fontWeight: '800' },
  decision: { borderLeftWidth: 2, borderLeftColor: '#45e6bd', paddingLeft: 10, gap: 4 },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: '#45e6bd', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxActive: { backgroundColor: '#45e6bd' },
  checkboxText: { color: '#052017', fontWeight: '900' },
  consentText: { flex: 1, color: '#b6c8c0', fontSize: 13, lineHeight: 19 }
});
