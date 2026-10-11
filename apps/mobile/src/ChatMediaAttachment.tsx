import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { API_URL, apiFetch, getAccessToken } from './api';

type Kind = 'GIF' | 'STICKER_IMAGE' | 'IMAGE';

export function ChatMediaAttachment({ assetId, kind }: { assetId: string; kind: Kind }) {
  const [source, setSource] = useState<{uri:string;headers:{Authorization:string}} | null>(null);
  const [failed,setFailed] = useState(false);
  const [attempt,setAttempt] = useState(0);

  useEffect(()=>{
    let mounted = true;
    setSource(null);
    setFailed(false);
    void (async ()=>{
      try {
        const grant = await apiFetch<{ path:string }>(
          `/media/${encodeURIComponent(assetId)}/download-grant`,
          { method:'POST' }
        );
        const expected = `/media/${encodeURIComponent(assetId)}/content?token=`;
        if (!grant.path.startsWith(expected)) throw new Error('MEDIA_GRANT_PATH_INVALID');
        const accessToken = await getAccessToken();
        if (!accessToken) throw new Error('SESSION_REQUIRED');
        if (mounted) setSource({
          uri: `${API_URL}${grant.path}`,
          headers: { Authorization: `Bearer ${accessToken}` }
        });
      } catch {
        if (mounted) setFailed(true);
      }
    })();
    return ()=>{ mounted=false; };
  },[assetId,attempt]);

  if (failed) return <View style={styles.placeholder}>
    <Text style={styles.caption}>Média indisponible</Text>
    <Pressable accessibilityRole="button" onPress={()=>setAttempt(value=>value+1)} style={styles.retry}>
      <Text style={styles.retryText}>Réessayer</Text>
    </Pressable>
  </View>;
  if (!source) return <Text style={styles.caption}>Chargement du média…</Text>;
  const compact = kind === 'STICKER_IMAGE';
  return <Image source={source} style={compact ? styles.sticker : styles.image}
    resizeMode="contain"
    accessibilityLabel={kind==='GIF'?'GIF':kind==='STICKER_IMAGE'?'Sticker':'Image'}
    onError={()=>setFailed(true)} />;
}

const styles=StyleSheet.create({
  image:{width:280,height:260,maxWidth:'100%',borderRadius:14},
  sticker:{width:190,height:190,maxWidth:'100%'},
  caption:{fontSize:12,opacity:.75},
  placeholder:{minHeight:100,minWidth:150,justifyContent:'center',gap:7},
  retry:{minHeight:44,alignSelf:'flex-start',paddingHorizontal:12,justifyContent:'center',borderRadius:12},
  retryText:{fontSize:13,fontWeight:'600'}
});
