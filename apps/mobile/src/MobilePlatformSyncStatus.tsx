import { KNOWME_EXPERIENCE_REVISION, KNOWME_PRODUCT_VERSION } from '@knowme/link-contract';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';

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
      {synchronized?'Les trois builds correspondent.':'Synchronisation non confirmée.'}
    </Text>
    {error?<Text style={{color:colors.muted}}>{error}</Text>:null}
    <Pressable onPress={()=>void check()} disabled={loading} accessibilityRole="button"
      style={[styles.button,{backgroundColor:colors.backgroundAccent,borderColor:colors.border}]}>
      <Text style={{color:colors.accent,fontWeight:'700'}}>Revérifier</Text>
    </Pressable>
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
