import { KNOWME_EXPERIENCE_REVISION, KNOWME_PRODUCT_VERSION } from '@knowme/link-contract';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';
import { checkKnowMeUpdateNow, type MobileUpdateCheckResult } from './updates/MobileUpdateNotice';

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
  const [updateChecking,setUpdateChecking]=useState(false);
  const [updateMessage,setUpdateMessage]=useState('');

  async function checkUpdate() {
    if (updateChecking) return;
    setUpdateChecking(true);
    setUpdateMessage('');
    try {
      const result: MobileUpdateCheckResult=await checkKnowMeUpdateNow();
      setUpdateMessage(result==='available'
        ? 'Une nouvelle version est disponible : confirme depuis la fenêtre KnowMe.'
        : result==='current'
          ? 'Aucune mise à jour Android officielle n’est publiée pour le moment.'
          : result==='unsupported'
            ? 'La version installée ne contient pas le module de mise à jour compatible.'
            : 'Vérification impossible : le serveur de mises à jour ne répond pas.');
    } finally {
      setUpdateChecking(false);
    }
  }

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
      {synchronized?'Les trois builds correspondent.':sameVersion ? 'Versions identiques, mais builds différents.' : 'Web, API et APK ne sont pas encore sur la même version.'}
    </Text>
    {error?<Text style={{color:colors.muted}}>{error}</Text>:null}
    <Pressable onPress={()=>void check()} disabled={loading} accessibilityRole="button"
      style={[styles.button,{backgroundColor:colors.backgroundAccent,borderColor:colors.border}]}>
      <Text style={{color:colors.accent,fontWeight:'700'}}>Revérifier</Text>
    </Pressable>
    <Pressable onPress={()=>void checkUpdate()} disabled={updateChecking} accessibilityRole="button"
      accessibilityLabel="Rechercher une mise à jour Android"
      style={[styles.button,{backgroundColor:colors.accent,borderColor:colors.accent}]}>
      <Text style={{color:colors.accentText,fontWeight:'800'}}>{updateChecking?'Recherche en cours…':'Rechercher une mise à jour Android'}</Text>
    </Pressable>
    {updateMessage ? <Text accessibilityRole="text" style={{color:colors.muted,fontSize:13}}>{updateMessage}</Text> : null}
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
