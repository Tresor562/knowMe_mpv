import { useEffect, useRef, useState } from 'react';
import {getChatAudioState,subscribeChatAudio,toggleChatAudio,seekChatAudio} from './chat-audio-session';
import { Image, Linking, Modal, Pressable, SafeAreaView, Share, StyleSheet, Text, View } from 'react-native';
import { KnowMeIcon } from './ui/KnowMeUI';
import { useAppearance } from './AppearanceProvider';
import { getKnowMeVoicePlaybackStatus, playKnowMeVoice, seekKnowMeVoicePlayback, stopKnowMeVoicePlayback } from './native-voice';
import { buildKnowMePublicLink } from '@knowme/link-contract';
import * as FileSystem from 'expo-file-system';
import { API_URL, apiFetch, getAccessToken } from './api';

type Kind = 'GIF' | 'STICKER_IMAGE' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';

/** Inline control observes the persistent player; unmounting a message never stops audio. */
function InlineVoiceAttachment({assetId,mimeType,avatarUrl,ownerId='',origin='',sender=''}:{
 assetId:string;mimeType?:string;avatarUrl?:string|null;
 ownerId?:string;origin?:string;sender?:string;
}){
 const {colors}=useAppearance();
 const [audio,setAudio]=useState(getChatAudioState);
 const widthRef=useRef(1);
 useEffect(()=>subscribeChatAudio(setAudio),[]);
 const own=audio.assetId===assetId&&(audio.ownerId===ownerId||!ownerId);
 const phase=own?audio.phase:'idle';
 const progress=own&&audio.durationMs>0?Math.max(0,Math.min(1,audio.positionMs/audio.durationMs)):0;
 const downloaded=own&&Boolean(audio.uri)&&phase!=='downloading';
 const active=phase==='playing';
 const time=(ms:number)=>{const n=Math.floor(Math.max(0,ms)/1000);return
   `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;};
 return <View style={voiceStyles.root} accessibilityLabel="Message vocal KnowMe">
   {avatarUrl?<Image source={{uri:avatarUrl}} style={voiceStyles.avatar}/>:(
    <View style={[voiceStyles.avatar,voiceStyles.avatarFallback,{backgroundColor:colors.backgroundAccent}]}>
      <KnowMeIcon name="microphone" color={colors.accent} size={19}/>
    </View>)}
   <Pressable accessibilityRole="button"
     accessibilityLabel={phase==='downloading'?'Téléchargement du vocal':
       active?'Mettre le vocal en pause':phase==='paused'?'Reprendre le vocal':
       downloaded?'Écouter le vocal téléchargé':'Télécharger et lire le vocal'}
     disabled={phase==='downloading'}
     onPress={()=>void toggleChatAudio({assetId,ownerId,origin,sender,mimeType})}
     style={[voiceStyles.control,{backgroundColor:colors.backgroundAccent}]}>
     {phase==='downloading'?<Text style={{color:colors.accent,fontSize:11}}>
        {audio.downloadFraction!==null?Math.round(audio.downloadFraction*100)+'%':'…'}</Text>:
      <KnowMeIcon name={active?'pause':downloaded?'play':'download'} size={20} color={colors.accent}/>}
   </Pressable>
   <View style={voiceStyles.timeline}>
     <Pressable accessibilityRole="button" accessibilityLabel="Avancer dans le message vocal"
       disabled={!downloaded}
       onLayout={event=>{widthRef.current=event.nativeEvent.layout.width;}}
       onPress={event=>{if(own)void seekChatAudio(event.nativeEvent.locationX/Math.max(1,widthRef.current)*audio.durationMs);}}
       style={voiceStyles.wave}>
       {Array.from({length:30},(_,i)=>{
         const amplitude=6+((i*17+assetId.charCodeAt(i%Math.max(1,assetId.length)))%19);
         return <View key={i} style={[voiceStyles.bar,{height:amplitude,
           backgroundColor:i/30<=progress?colors.accent:colors.muted,
           opacity:i/30<=progress?1:0.48}]}/>;
       })}
     </Pressable>
     <Text style={[voiceStyles.duration,{color:colors.muted}]}>
       {phase==='downloading'?'Téléchargement…':
        downloaded?`${time(audio.positionMs)} / ${time(audio.durationMs)}`:'Appuyer pour télécharger'}
     </Text>
     {own&&audio.error?<Text style={[voiceStyles.error,{color:colors.danger}]}>{audio.error}</Text>:null}
   </View>
 </View>;
}
const voiceStyles=StyleSheet.create({
 root:{width:255,maxWidth:'100%',flexDirection:'row',alignItems:'center',gap:7,minHeight:60,paddingVertical:3},
 avatar:{width:33,height:33,borderRadius:17},
 avatarFallback:{alignItems:'center',justifyContent:'center'},
 control:{minWidth:40,width:40,height:40,borderRadius:20,alignItems:'center',justifyContent:'center'},
 timeline:{flex:1,minWidth:0,justifyContent:'center',gap:4},
 wave:{height:28,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:1},
 bar:{width:2.5,borderRadius:4},
 duration:{fontSize:10,fontWeight:'600'},
 error:{fontSize:10}
});

export function ChatMediaAttachment({ assetId, kind, fileName, mimeType, autoOpen = false, avatarUrl, thumbnailSize, ownerId, origin, sender }: { assetId: string; kind: Kind; fileName?: string; mimeType?: string; autoOpen?: boolean; avatarUrl?: string|null; thumbnailSize?:number; ownerId?:string; origin?:string; sender?:string }) {
  const [opening,setOpening]=useState(false);
  const [previewOpen,setPreviewOpen]=useState(false);
  const [stickerExpanded,setStickerExpanded]=useState(false);
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

  // A viewer who explicitly opens a direct media link sees the exact image/GIF.
  // Large files remain tap-to-open and are never auto-downloaded.
  useEffect(() => {
    if (autoOpen && source && (kind === 'IMAGE' || kind === 'GIF' || kind === 'STICKER_IMAGE')) {
      setPreviewOpen(true);
    }
  }, [autoOpen, source, kind]);

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

  if(kind==='AUDIO')return <InlineVoiceAttachment assetId={assetId} mimeType={mimeType}
    avatarUrl={avatarUrl} ownerId={ownerId} origin={origin} sender={sender}/>;

  if (kind==='VIDEO'||kind==='DOCUMENT')return <View style={styles.fileCard}>
    <Text style={styles.fileIcon}>{kind==='VIDEO'?'🎬':'📄'}</Text>
    <Text style={styles.fileTitle}>{fileName??(kind==='VIDEO'?'Vidéo MP4':'Document PDF')}</Text>
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
      style={[styles.imageTrigger,thumbnailSize?{width:thumbnailSize,height:thumbnailSize}:null]}
      accessibilityRole="button"
      accessibilityLabel={compact?'Options du sticker':`Agrandir ${mediaLabel === 'Image' ? "l'image" : mediaLabel}`}
      accessibilityHint={compact?'Appuie pour voir les options, maintiens pour agrandir.':undefined}
      onPress={()=>{setStickerExpanded(!compact);setPreviewOpen(true);}}
      onLongPress={compact?()=>{setStickerExpanded(true);setPreviewOpen(true);}:undefined}
    >
      <Image source={source} style={[compact ? styles.sticker : styles.image,
        thumbnailSize?{width:thumbnailSize,height:thumbnailSize}:null]}
        resizeMode={compact?'contain':'cover'} accessibilityLabel={mediaLabel}
        onError={()=>{setPreviewOpen(false);setFailed(true);}} />
    </Pressable>
    <Modal visible={previewOpen} animationType="fade" transparent={false}
      onRequestClose={()=>{setPreviewOpen(false);setStickerExpanded(false);}}>
      {compact&&!stickerExpanded ? (
        <SafeAreaView style={styles.stickerOptionRoot}>
          <View style={styles.stickerOptionTop}>
            <Text style={styles.stickerOptionTitle}>Sticker KnowMe</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Fermer les options du sticker"
              onPress={()=>{setPreviewOpen(false);setStickerExpanded(false);}}
              style={styles.viewerClose}>
              <KnowMeIcon name="close" size={21} color="#fff"/>
            </Pressable>
          </View>
          <Image source={source} style={styles.stickerOptionImage} resizeMode="contain"
            accessibilityLabel={fileName||'Sticker'}/>
          <View style={styles.stickerOptions}>
            <Pressable accessibilityRole="button" style={styles.stickerOptionAction}
              onPress={()=>setStickerExpanded(true)}>
              <Text style={styles.stickerOptionActionText}>Agrandir le sticker</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.stickerOptionAction}
              onPress={()=>{void Share.share({message:buildKnowMePublicLink({kind:'media',id:assetId})});}}>
              <Text style={styles.stickerOptionActionText}>Partager le lien</Text>
            </Pressable>
            <Text style={styles.stickerMetadata}>
              {fileName||'Sticker'} · {mimeType||'Image'}
            </Text>
          </View>
        </SafeAreaView>
      ) : (
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
      )}
    </Modal>
  </>;
}

const styles=StyleSheet.create({
  imageTrigger:{alignSelf:'flex-start',borderRadius:5,overflow:'hidden'},
  stickerOptionRoot:{flex:1,backgroundColor:'#05080f',paddingHorizontal:18},
  stickerOptionTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:66},
  stickerOptionTitle:{fontSize:19,fontWeight:'800',color:'#fff'},
  stickerOptionImage:{height:220,width:'100%',marginTop:10},
  stickerOptions:{gap:9,paddingTop:15},
  stickerOptionAction:{minHeight:50,borderRadius:17,justifyContent:'center',
    backgroundColor:'rgba(255,255,255,.1)',paddingHorizontal:17},
  stickerOptionActionText:{fontSize:15,fontWeight:'700',color:'#fff'},
  stickerMetadata:{fontSize:12,color:'#aab2c7',marginTop:8},
  viewerRoot:{flex:1,backgroundColor:'#05080f',justifyContent:'space-between'},
  viewerToolbar:{height:62,paddingHorizontal:16,flexDirection:'row',alignItems:'center',
    justifyContent:'space-between',gap:12,borderBottomWidth:StyleSheet.hairlineWidth,
    borderBottomColor:'rgba(255,255,255,.18)'},
  viewerTitle:{color:'#fff',fontSize:15,fontWeight:'600',flex:1},
  viewerClose:{width:48,height:48,justifyContent:'center',alignItems:'center',
    borderRadius:24,backgroundColor:'rgba(255,255,255,.12)'},
  viewerImage:{flex:1,width:'100%',alignSelf:'center'},
  viewerCaption:{color:'#aab2c7',fontSize:12,textAlign:'center',paddingVertical:12},
  image:{width:245,height:245,maxWidth:'100%',borderRadius:5},
  sticker:{width:126,height:126,maxWidth:'100%'},
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
