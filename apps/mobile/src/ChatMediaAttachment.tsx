import { useEffect, useState } from 'react';
import { Image, Linking, Modal, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { KnowMeIcon } from './ui/KnowMeUI';
import * as FileSystem from 'expo-file-system';
import { API_URL, apiFetch, getAccessToken } from './api';

type Kind = 'GIF' | 'STICKER_IMAGE' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';

export function ChatMediaAttachment({ assetId, kind, fileName, mimeType }: { assetId: string; kind: Kind; fileName?: string; mimeType?: string }) {
  const [opening,setOpening]=useState(false);
  const [previewOpen,setPreviewOpen]=useState(false);
  const [source, setSource] = useState<{uri:string;headers:{Authorization:string}} | null>(null);
  const [failed,setFailed] = useState(false);
  const [attempt,setAttempt] = useState(0);

  useEffect(()=>{
    // Large non-image attachments are fetched only after the user taps Open.
    // Never mint a private download token just by scrolling through the chat.
    if(kind==='VIDEO'||kind==='AUDIO'||kind==='DOCUMENT')return;
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
  },[assetId,attempt,kind]);

  async function openFile() {
    if(opening)return;
    setOpening(true);
    setFailed(false);
    try {
      const grant=await apiFetch<{path:string}>(`/media/${encodeURIComponent(assetId)}/download-grant`,
        {method:'POST'});
      const expected=`/media/${encodeURIComponent(assetId)}/content?token=`;
      if(!grant.path.startsWith(expected))throw new Error('MEDIA_GRANT_PATH_INVALID');
      const accessToken=await getAccessToken();
      if(!accessToken||!FileSystem.cacheDirectory)throw new Error('CACHE_OR_SESSION_MISSING');
      const suffix=kind==='VIDEO'?'.mp4':kind==='AUDIO'?(mimeType==='audio/ogg'?'.ogg':mimeType==='audio/wav'?'.wav':'.mp3'):'.pdf';
      const target=`${FileSystem.cacheDirectory}knowme-attachment-${assetId}-${Date.now()}${suffix}`;
      const downloaded=await FileSystem.downloadAsync(`${API_URL}${grant.path}`,target,
        {headers:{Authorization:`Bearer ${accessToken}`}});
      if(downloaded.status!==200){
        await FileSystem.deleteAsync(target,{idempotent:true}).catch(()=>undefined);
        throw new Error('ATTACHMENT_DOWNLOAD_FAILED');
      }
      // Android exposes only this downloaded copy to a system viewer.
      const uri=await FileSystem.getContentUriAsync(target);
      // If the phone has no compatible external viewer, report failure.
      // Never pretend that sharing only a URI string delivered the actual file.
      await Linking.openURL(uri);
    }catch{
      setFailed(true);
    }finally{setOpening(false);}
  }

  if (kind==='VIDEO'||kind==='AUDIO'||kind==='DOCUMENT')return <View style={styles.fileCard}>
    <Text style={styles.fileIcon}>{kind==='VIDEO'?'🎬':kind==='AUDIO'?'🎵':'📄'}</Text>
    <Text style={styles.fileTitle}>{fileName??(kind==='VIDEO'?'Vidéo MP4':kind==='AUDIO'?'Fichier audio':'Document PDF')}</Text>
    <Pressable accessibilityRole="button" onPress={()=>void openFile()} disabled={opening}
      style={styles.fileAction}>
      <Text style={styles.retryText}>{opening?'Téléchargement…':failed?'Réessayer':'Ouvrir le fichier'}</Text>
    </Pressable>
    {failed&&<Text style={styles.caption}>Ouverture impossible. Vérifie la connexion et une application compatible.</Text>}
  </View>;

  if (failed) return <View style={styles.placeholder}>
    <Text style={styles.caption}>Média indisponible</Text>
    <Pressable accessibilityRole="button" onPress={()=>setAttempt(value=>value+1)} style={styles.retry}>
      <Text style={styles.retryText}>Réessayer</Text>
    </Pressable>
  </View>;
  if (!source) return <Text style={styles.caption}>Chargement du média…</Text>;
  const compact = kind === 'STICKER_IMAGE';
  const mediaLabel = kind==='GIF'?'GIF':compact?'Sticker':'Image';
  return <>
    <Pressable
      style={styles.imageTrigger}
      accessibilityRole="button"
      accessibilityLabel={`Agrandir ${mediaLabel === 'Image' ? "l'image" : mediaLabel}`}
      onPress={()=>setPreviewOpen(true)}
    >
      <Image source={source} style={compact ? styles.sticker : styles.image}
        resizeMode="contain" accessibilityLabel={mediaLabel}
        onError={()=>{setPreviewOpen(false);setFailed(true);}} />
    </Pressable>
    <Modal visible={previewOpen} animationType="fade" transparent={false}
      onRequestClose={()=>setPreviewOpen(false)}>
      <SafeAreaView style={styles.viewerRoot}>
        <View style={styles.viewerToolbar}>
          <Text style={styles.viewerTitle} numberOfLines={1}>
            {fileName ?? mediaLabel}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fermer la visionneuse"
            accessibilityHint="Retour à la conversation"
            hitSlop={8}
            onPress={()=>setPreviewOpen(false)}
            style={styles.viewerClose}
          >
            <KnowMeIcon name="close" color="#fff" size={23}/>
          </Pressable>
        </View>
        <Image source={source} style={styles.viewerImage}
          resizeMode="contain" accessibilityLabel={mediaLabel}
          onError={()=>{setPreviewOpen(false);setFailed(true);}}/>
        <Text style={styles.viewerCaption}>KnowMe · {mediaLabel}</Text>
      </SafeAreaView>
    </Modal>
  </>;
}

const styles=StyleSheet.create({
  imageTrigger:{alignSelf:'flex-start',borderRadius:14,overflow:'hidden'},
  viewerRoot:{flex:1,backgroundColor:'#05080f',justifyContent:'space-between'},
  viewerToolbar:{height:62,paddingHorizontal:16,flexDirection:'row',alignItems:'center',
    justifyContent:'space-between',gap:12,borderBottomWidth:StyleSheet.hairlineWidth,
    borderBottomColor:'rgba(255,255,255,.18)'},
  viewerTitle:{color:'#fff',fontSize:15,fontWeight:'600',flex:1},
  viewerClose:{width:48,height:48,justifyContent:'center',alignItems:'center',
    borderRadius:24,backgroundColor:'rgba(255,255,255,.12)'},
  viewerImage:{flex:1,width:'100%',alignSelf:'center'},
  viewerCaption:{color:'#aab2c7',fontSize:12,textAlign:'center',paddingVertical:12},
  image:{width:280,height:260,maxWidth:'100%',borderRadius:14},
  sticker:{width:190,height:190,maxWidth:'100%'},
  caption:{fontSize:12,opacity:.75},
  placeholder:{minHeight:100,minWidth:150,justifyContent:'center',gap:7},
  retry:{minHeight:44,alignSelf:'flex-start',paddingHorizontal:12,justifyContent:'center',borderRadius:12},
  retryText:{fontSize:13,fontWeight:'600'},
  fileCard:{minWidth:150,maxWidth:260,padding:12,gap:7,borderRadius:16,
    backgroundColor:'rgba(128,128,128,.1)'},
  fileIcon:{fontSize:27},
  fileTitle:{fontSize:14,fontWeight:'600'},
  fileAction:{minHeight:44,justifyContent:'center',alignSelf:'flex-start',paddingHorizontal:12,
    borderRadius:12,backgroundColor:'rgba(128,128,128,.16)'}
});
