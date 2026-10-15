import { KNOWME_EXPERIENCE_REVISION, KNOWME_PRODUCT_VERSION } from '@knowme/link-contract';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';
import { checkKnowMeUpdateNow } from './updates/MobileUpdateNotice';
import { KnowMeAlert } from './ui/KnowMeFeedback';

type RuntimeVersion = {
  platform: 'web'|'api';
  version:string;
  experienceRevision:string;
  commit:string|null;
};

const webOrigin=(process.env.EXPO_PUBLIC_WEB_URL||'https://knowme-nextech.vercel.app').replace(/\/$/,'');
const androidCommit=process.env.EXPO_PUBLIC_RELEASE_COMMIT||null;

export function MobilePlatformSyncStatus() {
  const {colors}=useAppearance();
  const [web,setWeb]=useState<RuntimeVersion|null>(null);
  const [api,setApi]=useState<RuntimeVersion|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [checkingUpdate,setCheckingUpdate]=useState(false);

  async function check() {
    setLoading(true);setError('');
    try {
      const [apiVersion,webResponse]=await Promise.all([
        apiFetch<RuntimeVersion>('/platform-sync/version'),
        fetch(`${webOrigin}/api/version`,{headers:{Accept:'application/json'}})
      ]);
      if(!webResponse.ok)throw new Error('Le site ne répond pas au contrôle de version.');
      const webVersion=await webResponse.json() as RuntimeVersion;
      if(webVersion.platform!=='web'||apiVersion.platform!=='api')
        throw new Error('Réponse de version incorrecte.');
      setApi(apiVersion);setWeb(webVersion);
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Vérification impossible.');
      setApi(null);setWeb(null);
    }finally{setLoading(false);}
  }

  async function checkUpdate() {
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    try {
      const result=await checkKnowMeUpdateNow();
      // The shared updater opens its in-app installer sheet when available.
      if (result==='available') return;
      KnowMeAlert.alert(
        'Mise à jour KnowMe',
        result==='current'
          ? 'Aucune APK plus récente et publiée n’est disponible actuellement.'
          : result==='unsupported'
            ? 'Cette APK ne dispose pas du module de mise à jour. Une première installation compatible sera nécessaire.'
            : 'Impossible de contacter le service de mises à jour. Réessaie quand le réseau est disponible.'
      );
    } finally {
      setCheckingUpdate(false);
    }
  }

  useEffect(()=>{void check();},[]);
  const sameVersion=Boolean(api&&web&&api.version===KNOWME_PRODUCT_VERSION&&web.version===KNOWME_PRODUCT_VERSION);
  const sameRevision=Boolean(api&&web&&api.experienceRevision===KNOWME_EXPERIENCE_REVISION&&web.experienceRevision===KNOWME_EXPERIENCE_REVISION);
  const sameCommit=Boolean(androidCommit&&api?.commit&&web?.commit&&
    api.commit===web.commit&&web.commit===androidCommit);
  const synchronized=sameVersion&&sameRevision&&sameCommit;

  return <View style={[styles.card,{backgroundColor:colors.surface,borderColor:colors.border}]}>
    <Text style={[styles.title,{color:colors.text}]}>Versions de KnowMe</Text>
    <Text style={{color:colors.muted,lineHeight:19}}>
      Même numéro de version ne veut pas dire même code. Nous comparons aussi le contrat et le commit.
    </Text>
    <Text style={{color:colors.text}}>APK : {KNOWME_PRODUCT_VERSION} · {androidCommit?.slice(0,8)||'commit non identifiable'}</Text>
    <Text style={{color:colors.text}}>Web : {web?.version||'indisponible'} · {web?.commit?.slice(0,8)||'non vérifié'}</Text>
    <Text style={{color:colors.text}}>API : {api?.version||'indisponible'} · {api?.commit?.slice(0,8)||'non vérifié'}</Text>
    {loading?<ActivityIndicator color={colors.accent}/>:null}
    <Text style={{color:synchronized?colors.accent:colors.danger,fontWeight:'700'}}>
      {synchronized?'Les trois builds correspondent.':'Synchronisation non confirmée.'}
    </Text>
    {error?<Text style={{color:colors.muted}}>{error}</Text>:null}
    <Pressable onPress={()=>void check()} disabled={loading} accessibilityRole="button"
      style={[styles.button,{backgroundColor:colors.backgroundAccent,borderColor:colors.border}]}>
      <Text style={{color:colors.accent,fontWeight:'700'}}>Revérifier</Text>
    </Pressable>
    <Pressable onPress={()=>void checkUpdate()} disabled={checkingUpdate} accessibilityRole="button"
      accessibilityLabel="Rechercher et installer une mise à jour KnowMe"
      style={[styles.button,{backgroundColor:colors.accent,borderColor:colors.border,opacity:checkingUpdate?0.6:1}]}>
      <Text style={{color:colors.accentText,fontWeight:'700'}}>
        {checkingUpdate?'Recherche d’une mise à jour…':'Vérifier les mises à jour'}
      </Text>
    </Pressable>
    <Text style={{color:colors.muted,fontSize:12}}>
      « Revérifier » contrôle les versions. « Vérifier les mises à jour » recherche une APK signée, plus récente et publiée.
      Android demandera ton accord avant toute installation. Tes données sont conservées si la signature correspond.
    </Text>
    <Text style={{color:colors.muted,fontSize:12}}>
      Le statut du code ne garantit pas que tous les écrans aient passé les tests fonctionnels.
    </Text>
  </View>;
}

const styles=StyleSheet.create({
  card:{padding:18,borderWidth:1,borderRadius:22,gap:14},
  title:{fontSize:19,fontWeight:'800'},
  button:{minHeight:48,borderRadius:15,borderWidth:1,alignItems:'center',justifyContent:'center'}
});
