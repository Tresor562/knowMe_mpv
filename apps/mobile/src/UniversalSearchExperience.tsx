import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';
import {useI18n} from './I18nProvider';
import {KnowMeIcon} from './ui/KnowMeUI';

type SearchKind = 'MESSAGE' | 'POST' | 'CHALLENGE' | 'CONVERSATION' | 'PROFILE' | 'CHANNEL';

type SearchItem = {
  kind: SearchKind;
  id: string;
  title: string | null;
  snippet: string;
  route: string;
  updatedAt: string;
};

type SearchResponse = {
  query: string;
  kinds: SearchKind[];
  items: SearchItem[];
  nextCursor: string | null;
};

const SEARCH_KINDS: SearchKind[] = ['PROFILE','CHANNEL','POST','CONVERSATION','MESSAGE','CHALLENGE'];
const labels: Record<SearchKind, string> = {
  MESSAGE: 'Messages',
  POST: 'Publications',
  CHALLENGE: 'Défis',
  CONVERSATION: 'Groupes et discussions',
  PROFILE: 'Profils',
  CHANNEL: 'Chaînes'
};

export function UniversalSearchExperience({
  initialQuery = '',
  onBack,
  onQueryChange,
  onOpenResult
}: {
  initialQuery?:string;
  onBack?:()=>void;
  onQueryChange?:(query:string)=>void;
  onOpenResult?: (item: SearchItem) => void;
}) {
  const { colors, visual } = useAppearance();
  const {locale}=useI18n();
  const en=locale==='en';
  const requestEpoch=useRef(0);
  const [query, setQuery] = useState(initialQuery);
  const [activeKinds, setActiveKinds] = useState<SearchKind[]>(SEARCH_KINDS);
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [submittedKinds, setSubmittedKinds] = useState<SearchKind[]>(SEARCH_KINDS);
  const [items, setItems] = useState<SearchItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function toggleKind(kind: SearchKind) {
    setActiveKinds(current=>{
      if(current.includes(kind)&&current.length===1)return current;
      return current.includes(kind)
        ?current.filter(value=>value!==kind)
        :SEARCH_KINDS.filter(value=>current.includes(value)||value===kind);
    });
  }

  // Debounced live results: the epoch guard stops old server responses from
  // replacing a more recent query, even if the network finishes out of order.
  useEffect(()=>{
    requestEpoch.current++;
    const normalized=query.trim();
    if(normalized.length<2){
      setSubmittedQuery('');
      setItems([]);
      setNextCursor(null);
      setError('');
      setBusy(false);
      return;
    }
    const timer=setTimeout(()=>{void search(normalized,activeKinds);},270);
    return()=>{clearTimeout(timer);requestEpoch.current++;};
  // search is intentionally called only from the debounced closure.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[query,activeKinds]);

  async function search(normalized=query.trim(),kinds=activeKinds) {
    if(normalized.length<2)return;
    const epoch=++requestEpoch.current;
    setBusy(true);
    setError('');
    try {
      const response=await apiFetch<SearchResponse>(
        `/search/discover?q=${encodeURIComponent(normalized)}&limit=20&kinds=${encodeURIComponent(kinds.join(','))}`
      );
      if(epoch!==requestEpoch.current)return;
      setSubmittedQuery(response.query);
      setSubmittedKinds(response.kinds);
      setItems(response.items);
      setNextCursor(response.nextCursor);
    } catch(cause) {
      if(epoch===requestEpoch.current)
        setError(cause instanceof Error?cause.message:'Recherche impossible.');
    } finally {
      if(epoch===requestEpoch.current)setBusy(false);
    }
  }

  async function loadMore() {
    if (!nextCursor || !submittedQuery || busy) return;

    const epoch=requestEpoch.current;
    setBusy(true);
    setError('');
    try {
      const kinds = submittedKinds.join(',');
      const response = await apiFetch<SearchResponse>(
        `/search/discover?q=${encodeURIComponent(submittedQuery)}&limit=20&kinds=${encodeURIComponent(kinds)}&cursor=${encodeURIComponent(nextCursor)}`
      );
      if(epoch!==requestEpoch.current)return;
      setItems((current) => {
        const seen = new Set(current.map((item) => `${item.kind}:${item.id}`));
        return [
          ...current,
          ...response.items.filter((item) => !seen.has(`${item.kind}:${item.id}`))
        ];
      });
      setNextCursor(response.nextCursor);
    } catch (cause) {
      if(epoch===requestEpoch.current)
        setError(cause instanceof Error ? cause.message : 'Chargement impossible.');
    } finally {
      if(epoch===requestEpoch.current)setBusy(false);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.navigationRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={en?'Back':'Retour'}
          onPress={onBack} style={styles.backButton}>
          <KnowMeIcon name="back" size={24} color={colors.text}/>
        </Pressable>
        <Text style={[styles.eyebrow, { color: colors.accent }]}>{en?'UNIVERSAL SEARCH':'RECHERCHE UNIVERSELLE'}</Text>
      </View>
      <Text style={[styles.heading, { color: colors.text }]}>{en?'Search KnowMe':'Rechercher sur KnowMe'}</Text>
      <Text style={[styles.muted, { color: colors.muted }]}> 
        {en?'Suggestions appear as you type. Private content remains protected.':'Suggestions au fur et à mesure de la saisie. Les contenus privés restent protégés.'}
      </Text>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: visual.cardRadius }]}>
        <TextInput
          value={query}
          onChangeText={value=>{setQuery(value);onQueryChange?.(value);}}
          onSubmitEditing={() => void search(query.trim(),activeKinds)}
          placeholder={en?'Users, groups, channels, posts…':'Profil, groupe, chaîne, publication…'}
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={120}
          returnKeyType="search"
          style={[
            styles.input,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              color: colors.text
            }
          ]}
        />
        <View style={styles.filterRow}>
          {SEARCH_KINDS.map((kind) => {
            const selected = activeKinds.includes(kind);
            return (
              <Pressable
                key={kind}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => toggleKind(kind)}
                style={[
                  styles.filterButton,
                  { borderColor: selected ? colors.accent : colors.border },
                  selected && { backgroundColor: colors.surfaceRaised }
                ]}
              >
                <Text style={{ color: selected ? colors.accent : colors.muted, fontWeight: '800' }}>
                  {labels[kind]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.filterHelp, { color: colors.muted }]}>{en?'Live suggestions from KnowMe.':'Résultats actualisés pendant la saisie.'}</Text>
        <Pressable
          disabled={busy || query.trim().length < 2}
          onPress={() => void search(query.trim(),activeKinds)}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.accent, borderRadius: visual.controlRadius },
            (pressed || busy || query.trim().length < 2) && styles.disabled
          ]}
        >
          <Text style={[styles.primaryText, { color: colors.accentText }]}>{en?'Search':'Rechercher'}</Text>
        </Pressable>
      </View>

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      {busy && items.length === 0 ? <ActivityIndicator color={colors.accent} /> : null}

      {submittedQuery ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{en?'Suggestions for':'Suggestions pour'} « {submittedQuery} »</Text>
          <Text style={[styles.muted, { color: colors.muted }]}>
            {submittedKinds.map((kind) => labels[kind]).join(' · ')}
          </Text>
        </>
      ) : null}

      {submittedQuery && !busy && items.length === 0 && !error ? (
        <Text style={[styles.muted, { color: colors.muted }]}>Aucun résultat accessible.</Text>
      ) : null}

      {items.map((item) => (
        <Pressable
          key={`${item.kind}:${item.id}`}
          onPress={() => onOpenResult?.(item)}
          accessibilityRole="button"
          accessibilityLabel={(item.title||labels[item.kind])+' · '+labels[item.kind]}
          style={({ pressed }) => [
            styles.result,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed
          ]}
        >
          <View style={styles.resultHeader}>
            <Text style={[styles.resultTitle, { color: colors.text }]}>
              {item.title || labels[item.kind]}
            </Text>
            <Text style={[styles.kind, { color: colors.accent }]}>{labels[item.kind]}</Text>
          </View>
          <Text style={[styles.snippet, { color: colors.muted }]}>{item.snippet}</Text>
          <Text style={[styles.date, { color: colors.muted }]}>
            {new Date(item.updatedAt).toLocaleString()}
          </Text>
        </Pressable>
      ))}

      {nextCursor ? (
        <Pressable
          disabled={busy}
          onPress={() => void loadMore()}
          style={[styles.secondaryButton, { borderColor: colors.border, borderRadius: visual.controlRadius }, busy && styles.disabled]}
        >
          <Text style={[styles.secondaryText, { color: colors.text }]}>
            {busy ? 'Chargement…' : 'Charger plus'}
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

export type UniversalSearchResult = SearchItem;

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 44, gap: 12 },
  navigationRow:{flexDirection:'row',alignItems:'center',gap:8},
  backButton:{height:44,width:44,justifyContent:'center',alignItems:'center'},
  eyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  heading: { fontSize: 30, fontWeight: '900' },
  muted: { fontSize: 14, lineHeight: 20 },
  card: { borderWidth: 1, borderRadius: 22, padding: 16, gap: 10 },
  input: { borderWidth: 1, borderRadius: 15, minHeight: 48, paddingHorizontal: 14, paddingVertical: 12 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterButton: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 11 },
  filterHelp: { fontSize: 12, lineHeight: 17 },
  primaryButton: { borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  primaryText: { fontWeight: '900' },
  disabled: { opacity: 0.45 },
  error: { lineHeight: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '900', marginTop: 8 },
  result: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 8 },
  pressed: { opacity: 0.78 },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' },
  resultTitle: { flex: 1, fontSize: 16, fontWeight: '800' },
  kind: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  snippet: { lineHeight: 20 },
  date: { fontSize: 11 },
  secondaryButton: { borderWidth: 1, borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  secondaryText: { fontWeight: '800' }
});
