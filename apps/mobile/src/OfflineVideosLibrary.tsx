import {useCallback,useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Alert,FlatList,Modal,Pressable,StyleSheet,Text,View} from 'react-native';
import {useAppearance} from './AppearanceProvider';
import {useI18n} from './I18nProvider';
import {sortOfflineVideos,totalOfflineVideoBytes,offlineStorageLabel,type OfflineVideoSort} from './offline-video-library-model';
import {KnowMeIcon} from './ui/KnowMeUI';
import {PublicPostVideo} from './PublicPostVideo';
import {deleteSavedPublicVideo,listSavedPublicVideos,type SavedPublicVideo} from './offline-public-video';

const labels={
  fr:{
    back:'Retour aux vidéos téléchargées',close:'Fermer les téléchargements',title:'Vidéos enregistrées',
    viewer:'Vidéo hors ligne',device:'Lecture depuis cet appareil',available:'vidéo(s) disponibles hors connexion',
    refresh:'Actualiser les vidéos enregistrées',intro:'Tes vidéos sont stockées dans l’espace privé de l’application. Elles restent lisibles sans réseau.',
    storage:'Espace occupé',newest:'Récentes',oldest:'Anciennes',largest:'Plus volumineuses',
    remove:'Supprimer la copie',removeOne:'Retirer cette vidéo ?',removeHint:'La publication reste sur KnowMe. Seule la copie locale sera supprimée.',
    cancel:'Annuler',delete:'Supprimer',deleteAll:'Tout supprimer',deleteAllHint:'Toutes les copies locales seront supprimées de cet appareil. Les publications resteront en ligne.',
    deleteAllConfirm:'Supprimer toutes les vidéos enregistrées ?',removing:'Suppression…',
    readError:'Impossible de lire les vidéos enregistrées.',deleteError:'Impossible de supprimer certaines vidéos.',
    play:'Lire la vidéo hors ligne',removeRow:'Supprimer la vidéo hors ligne',video:'Vidéo',
    local:'Sur cet appareil',none:'Aucune vidéo enregistrée',noneHint:'Ouvre un Reel et touche « Hors ligne » pour l’enregistrer.'
  },
  en:{
    back:'Back to downloads',close:'Close downloads',title:'Saved videos',
    viewer:'Offline video',device:'Playing from this device',available:'video(s) available offline',
    refresh:'Refresh saved videos',intro:'Your videos are stored in the app’s private space and remain playable without internet.',
    storage:'Storage used',newest:'Newest',oldest:'Oldest',largest:'Largest',
    remove:'Delete copy',removeOne:'Remove this video?',removeHint:'The post remains on KnowMe. Only the copy saved on this device will be deleted.',
    cancel:'Cancel',delete:'Delete',deleteAll:'Delete all',deleteAllHint:'All local copies will be deleted from this device. Original posts remain online.',
    deleteAllConfirm:'Delete all saved videos?',removing:'Deleting…',
    readError:'Unable to read saved videos.',deleteError:'Some saved videos could not be deleted.',
    play:'Play offline video',removeRow:'Delete offline video',video:'Video',
    local:'On this device',none:'No saved videos',noneHint:'Open a Reel and tap “Offline” to save it.'
  }
} as const;

/** Local-only collection; remains accessible when the remote feed is offline. */
export function OfflineVideosLibrary({visible,onClose}:{
  visible:boolean;onClose:()=>void
}){
  const {colors}=useAppearance();
  const {locale}=useI18n();
  const en=locale==='en';
  const t=labels[en?'en':'fr'];
  const [items,setItems]=useState<SavedPublicVideo[]>([]);
  const [chosen,setChosen]=useState<SavedPublicVideo|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [sort,setSort]=useState<OfflineVideoSort>('recent');
  const [deleting,setDeleting]=useState(false);
  const ordered=useMemo(()=>sortOfflineVideos(items,sort),[items,sort]);
  const storage=offlineStorageLabel(totalOfflineVideoBytes(items),en?'en':'fr');
  const [refreshId,setRefreshId]=useState(0);
  const refresh=useCallback(async()=>{
    setLoading(true);setError('');
    try{setItems(await listSavedPublicVideos());}
    catch{setError(t.readError);}
    finally{setLoading(false);}
  },[t.readError]);
  useEffect(()=>{
    if(visible){void refresh();}
    else setChosen(null);
  },[visible,refreshId,refresh]);
  function remove(item:SavedPublicVideo){
    Alert.alert(t.removeOne,t.removeHint,[
      {text:t.cancel,style:'cancel'},
      {text:t.delete,style:'destructive',onPress:()=>{void (async()=>{
        await deleteSavedPublicVideo(item.url);
        if(chosen?.url===item.url)setChosen(null);
        setRefreshId(n=>n+1);
      })().catch(()=>setError(t.deleteError));}}
    ]);
  }
  async function clearAll(){
    if(deleting)return;
    setDeleting(true);setError('');
    let failed=false;
    try{
      for(const item of items){
        try{await deleteSavedPublicVideo(item.url);}
        catch{failed=true;}
      }
      setChosen(null);
      await refresh();
      if(failed)setError(t.deleteError);
    }finally{setDeleting(false);}
  }
  function confirmClearAll(){
    if(deleting||items.length===0)return;
    Alert.alert(t.deleteAllConfirm,t.deleteAllHint,[
      {text:t.cancel,style:'cancel'},
      {text:t.deleteAll,style:'destructive',onPress:()=>void clearAll()}
    ]);
  }

  return <Modal visible={visible} animationType="slide" onRequestClose={()=>{
    if(chosen){setChosen(null);return;}
    onClose();
  }}>
    <View style={[styles.root,{backgroundColor:colors.background}]}>
      <View style={[styles.header,{borderBottomColor:colors.border}]}>
        <Pressable accessibilityRole="button" accessibilityLabel={chosen?t.back:t.close}
          onPress={()=>chosen?setChosen(null):onClose()} style={styles.tap}>
          <KnowMeIcon name="back" size={23} color={colors.text}/>
        </Pressable>
        <View style={{flex:1}}>
          <Text style={[styles.title,{color:colors.text}]} numberOfLines={1}>
            {chosen?t.viewer:t.title}
          </Text>
          <Text style={{color:colors.muted,fontSize:12}}>
            {chosen?t.device:items.length+' '+t.available}
          </Text>
        </View>
        {!chosen&&<View style={styles.headerActions}>
          {items.length>0&&<Pressable accessibilityRole="button"
            accessibilityLabel={t.deleteAll}
            disabled={deleting} onPress={confirmClearAll} style={styles.tap}>
            <KnowMeIcon name="close" size={21} color={colors.danger}/>
          </Pressable>}
          <Pressable accessibilityRole="button" accessibilityLabel={t.refresh}
            onPress={()=>setRefreshId(n=>n+1)} disabled={loading||deleting} style={styles.tap}>
            <KnowMeIcon name="refresh" size={21} color={colors.text}/>
          </Pressable>
        </View>}
      </View>
      {chosen?
        <View style={styles.viewer}>
          <PublicPostVideo key={chosen.url} url={chosen.url}/>
          <View style={styles.viewerBottom}>
            <Text style={styles.viewerInfo}>{t.viewer} · {offlineStorageLabel(chosen.bytes,en?'en':'fr')}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t.remove}
              onPress={()=>remove(chosen)} style={styles.removeLarge}>
              <KnowMeIcon name="close" color="#fff" size={19}/>
              <Text style={{color:'#fff',fontWeight:'800'}}>{t.remove}</Text>
            </Pressable>
          </View>
        </View>
      :<FlatList data={ordered} keyExtractor={item=>item.url}
        refreshing={loading} onRefresh={()=>setRefreshId(n=>n+1)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<View style={styles.listHeading}>
          <Text style={{color:colors.muted,fontSize:13,lineHeight:19}}>{t.intro}</Text>
          <Text style={{color:colors.text,fontSize:13,fontWeight:'700'}}>
            {t.storage} · {storage}
          </Text>
          {items.length>1&&<View style={styles.sortTabs} accessibilityRole="tablist">
            {(['recent','oldest','largest'] as OfflineVideoSort[]).map(mode=>
              <Pressable key={mode} accessibilityRole="tab"
                accessibilityState={{selected:sort===mode}}
                onPress={()=>setSort(mode)}
                style={[styles.sortTab,sort===mode?{backgroundColor:colors.backgroundAccent}:null]}>
                <Text style={{fontSize:12,fontWeight:'700',color:sort===mode?colors.text:colors.muted}}>
                  {mode==='recent'?t.newest:mode==='oldest'?t.oldest:t.largest}
                </Text>
              </Pressable>
            )}
          </View>}
          {deleting&&<Text accessibilityRole="text" style={{color:colors.muted}}>{t.removing}</Text>}
        </View>}
        renderItem={({item,index})=><View style={[styles.entry,{backgroundColor:colors.surface,borderColor:colors.border}]}>
          <Pressable accessibilityRole="button"
            accessibilityLabel={t.play+' '+(index+1)}
            onPress={()=>setChosen(item)} style={styles.entryMain}>
            <View style={[styles.play,{backgroundColor:colors.backgroundAccent}]}>
              <KnowMeIcon name="play" size={24} color={colors.accent}/>
            </View>
            <View style={{flex:1,gap:5}}>
              <Text style={{fontWeight:'800',color:colors.text}}>{t.video} {index+1}</Text>
              <Text style={{color:colors.muted,fontSize:12}}>{offlineStorageLabel(item.bytes,en?'en':'fr')} · {t.local}</Text>
            </View>
          </Pressable>
          <Pressable accessibilityRole="button"
            accessibilityLabel={t.removeRow+' '+(index+1)}
            onPress={()=>remove(item)} style={styles.tap}>
            <KnowMeIcon name="close" size={19} color={colors.muted}/>
          </Pressable>
        </View>}
        ListEmptyComponent={!loading?<View style={{alignItems:'center',gap:12,paddingVertical:56}}>
          <KnowMeIcon name="download" size={42} color={colors.muted}/>
          <Text style={{color:colors.text,fontWeight:'800'}}>{t.none}</Text>
          <Text style={{color:colors.muted,textAlign:'center',fontSize:13}}>
            {t.noneHint}
          </Text>
        </View>:<ActivityIndicator color={colors.accent}/>}
      />}
      {Boolean(error)&&<Text accessibilityRole="alert" style={{color:colors.danger,padding:12}}>{error}</Text>}
    </View>
  </Modal>;
}
const styles=StyleSheet.create({
  root:{flex:1},
  header:{height:76,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:9,borderBottomWidth:1},
  tap:{width:44,height:44,alignItems:'center',justifyContent:'center'},
  title:{fontSize:18,fontWeight:'800'},
  headerActions:{flexDirection:'row',alignItems:'center',gap:2},
  listHeading:{gap:11,marginBottom:5},
  sortTabs:{flexDirection:'row',gap:4},
  sortTab:{minHeight:44,paddingHorizontal:12,borderRadius:14,
    alignItems:'center',justifyContent:'center'},
  list:{padding:16,gap:12,flexGrow:1},
  entry:{minHeight:84,borderRadius:18,borderWidth:1,
    padding:10,flexDirection:'row',alignItems:'center'},
  entryMain:{flex:1,flexDirection:'row',alignItems:'center',gap:13,minHeight:56},
  play:{width:54,height:54,borderRadius:17,alignItems:'center',justifyContent:'center'},
  viewer:{flex:1,backgroundColor:'#050608'},
  viewerBottom:{position:'absolute',bottom:15,left:14,right:14,flexDirection:'row',
    justifyContent:'space-between',alignItems:'center',gap:10},
  viewerInfo:{color:'#fff',fontSize:12,fontWeight:'700',flex:1},
  removeLarge:{minHeight:44,paddingHorizontal:10,alignItems:'center',justifyContent:'center',
    gap:6,flexDirection:'row',borderRadius:14,backgroundColor:'rgba(0,0,0,.78)'}
});