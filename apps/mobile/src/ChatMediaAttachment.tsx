import { useEffect, useRef, useState } from 'react';
import { Image, Linking, Modal, Pressable, SafeAreaView, Share, StyleSheet, Text, View } from 'react-native';
import { KnowMeIcon } from './ui/KnowMeUI';
import { useAppearance } from './AppearanceProvider';
import { getKnowMeVoicePlaybackStatus, playKnowMeVoice, seekKnowMeVoicePlayback, stopKnowMeVoicePlayback } from './native-voice';
import { buildKnowMePublicLink } from '@knowme/link-contract';
import * as FileSystem from 'expo-file-system';
import { API_URL, apiFetch, getAccessToken } from './api';

type Kind = 'GIF' | 'STICKER_IMAGE' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT';

/** Private, authenticated inline player. Never exposes a temporary media grant in the UI. */
function InlineVoiceAttachment({assetId, mimeType, avatarUrl}: {assetId:string;mimeType?:string;avatarUrl?:string|null}) {
  const {colors}=useAppearance();
  const [loading,setLoading]=useState(false);
  const [playing,setPlaying]=useState(false);
  const [duration,setDuration]=useState(0);
  const [position,setPosition]=useState(0);
  const [error,setError]=useState<string|null>(null);
  const fileRef=useRef<string|null>(null);
  const widthRef=useRef(1);
  const busyRef=useRef(false);

  useEffect(()=>{
    if(!playing)return;
    let live=true;
    const interval=setInterval(()=>{
      void (async ()=>{
        try {
          const status=await getKnowMeVoicePlaybackStatus();
          if(!live||!status)return;
          if(status.uri!==fileRef.current) {setPlaying(false);return;}
          setDuration(status.durationMs);
          setPosition(status.positionMs);
          if(!status.playing)setPlaying(false);
        } catch {if(live)setPlaying(false);}
      })();
    },250);
    return()=>{live=false;clearInterval(interval);};
  },[playing]);

  useEffect(()=>()=>{
    const uri=fileRef.current;
    if(!uri)return;
    void (async ()=>{
      try {
        const status=await getKnowMeVoicePlaybackStatus();
        if(status?.uri===uri)await stopKnowMeVoicePlayback();
      } catch {/* Old installed builds do not expose status. */}
      await FileSystem.deleteAsync(uri,{idempotent:true}).catch(()=>undefined);
    })();
  },[]);

  async function togglePlayback() {
    if(busyRef.current)return;
    busyRef.current=true;
    setError(null);
    try {
      if(playing) {
        await stopKnowMeVoicePlayback();
        setPlaying(false);
        return;
      }
      let uri=fileRef.current;
      if(!uri) {
        setLoading(true);
        const grant=await apiFetch<{path:string}>(`/media/${encodeURIComponent(assetId)}/download-grant`,{method:'POST'});
        const expected=`/media/${encodeURIComponent(assetId)}/content?token=`;
        if(!grant.path.startsWith(expected))throw new Error('MEDIA_GRANT_PATH_INVALID');
        const accessToken=await getAccessToken();
        if(!accessToken||!FileSystem.cacheDirectory)throw new Error('SESSION_REQUIRED');
        const suffix=mimeType==='audio/mpeg'?'.mp3':mimeType==='audio/wav'?'.wav':'.ogg';
        const directory=`${FileSystem.cacheDirectory}knowme-voice/`;
        await FileSystem.makeDirectoryAsync(directory,{intermediates:true});
        const safeId=assetId.replace(/[^a-zA-Z0-9_-]/g,'');
        const target=`${directory}attachment-${safeId}${suffix}`;
        const downloaded=await FileSystem.downloadAsync(`${API_URL}${grant.path}`,target,{
          headers:{Authorization:`Bearer ${accessToken}`}
        });
        if(downloaded.status!==200) {
          await FileSystem.deleteAsync(target,{idempotent:true}).catch(()=>undefined);
          throw new Error('AUDIO_DOWNLOAD_FAILED');
        }
        uri=downloaded.uri;
        fileRef.current=uri;
      }
      await playKnowMeVoice(uri);
      setPlaying(true);
      const status=await getKnowMeVoicePlaybackStatus();
      if(status){setDuration(status.durationMs);setPosition(status.positionMs);}
    } catch {
      setPlaying(false);
      setError('Lecture impossible. Réessayer');
    } finally {
      busyRef.current=false;
      setLoading(false);
    }
  }

  async function seekAt(x:number) {
    if(!fileRef.current||duration<=0)return;
    try {
      const next=Math.round(Math.max(0,Math.min(1,x/widthRef.current))*duration);
      await seekKnowMeVoicePlayback(next);
      setPosition(next);
    } catch {setError('Avance rapide disponible après la mise à jour.');}
  }
  const time=(ms:number)=>{
    const seconds=Math.max(0,Math.floor(ms/1000));
    return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  };
  const progress=duration>0?Math.max(0,Math.min(1,position/duration)):0;
  return <View style={voiceStyles.root} accessibilityLabel="Message vocal KnowMe">
    {avatarUrl?<Image source={{uri:avatarUrl}} style={voiceStyles.avatar}/>:(
      <View style={[voiceStyles.avatar,voiceStyles.avatarFallback,{backgroundColor:colors.backgroundAccent}]}>
        <KnowMeIcon name="microphone" color={colors.accent} size={19}/>
      </View>
    )}
    <Pressable accessibilityRole="button" accessibilityLabel={playing?'Arrêter le vocal':'Écouter le vocal'}
      disabled={loading} onPress={()=>void togglePlayback()} style={[voiceStyles.control,{backgroundColor:colors.backgroundAccent}]}>
      <Text style={[voiceStyles.playIcon,{color:colors.text}]}>{loading?'…':playing?'Ⅱ':'▶'}</Text>
    </Pressable>
    <View style={voiceStyles.timeline}>
      <Pressable accessibilityRole="button" accessibilityLabel="Avancer dans le message vocal"
        onLayout={event=>{widthRef.current=event.nativeEvent.layout.width;}}
        onPress={event=>{void seekAt(event.nativeEvent.locationX);}}
        style={voiceStyles.wave}>
        {Array.from({length:32},(_,i)=>{
          const amplitude=6+((i*17+assetId.charCodeAt(i%assetId.length||0))%20);
          return <View key={i} style={[voiceStyles.bar,{
            height:amplitude,
            backgroundColor:i/32<=progress?'#d9e3e7':'#8da6af',
            opacity:i/32<=progress?1:0.62
          }]}/>;
        })}
      </Pressable>
      <Text style={[voiceStyles.duration,{color:'#c5d2d7'}]}>{time(position)}{duration>0?` / ${time(duration)}`:''}</Text>
      {error?<Text style={[voiceStyles.error,{color:colors.danger}]}>{error}</Text>:null}
    </View>
  </View>;
}

const voiceStyles=StyleSheet.create({
  root:{width:260,maxWidth:'100%',flexDirection:'row',alignItems:'center',gap:7,minHeight:65,paddingVertical:2},
  avatar:{width:35,height:35,borderRadius:18},
  avatarFallback:{alignItems:'center',justifyContent:'center'},
  control:{width:37,height:37,borderRadius:19,alignItems:'center',justifyContent:'center'},
  playIcon:{fontSize:18,fontWeight:'700'},
  timeline:{flex:1,minWidth:0,justifyContent:'center',gap:4},
  wave:{height:28,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:1},
  bar:{width:2.5,borderRadius:4},
  duration:{fontSize:11,fontWeight:'600'},
  error:{fontSize:10}
});

export function ChatMediaAttachment({ assetId, kind, fileName, mimeType, autoOpen = false, avatarUrl, thumbnailSize }: { assetId: string; kind: Kind; fileName?: string; mimeType?: string; autoOpen?: boolean; avatarUrl?: string|null; thumbnailSize?:number }) {
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

  if(kind==='AUDIO')return <InlineVoiceAttachment assetId={assetId} mimeType={mimeType} avatarUrl={avatarUrl}/>;

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
  stickerOptionImage:{height:280,width:'100%',marginTop:14},
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
