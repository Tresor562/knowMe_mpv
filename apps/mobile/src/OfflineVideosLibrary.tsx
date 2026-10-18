import {useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Alert,FlatList,Modal,Pressable,StyleSheet,Text,View} from 'react-native';
import {useAppearance} from './AppearanceProvider';
import {useI18n} from './I18nProvider';
import {offlineVideoLabels,offlineVideoSize} from './offline-video-labels';
import {KnowMeIcon} from './ui/KnowMeUI';
import {PublicPostVideo} from './PublicPostVideo';
import {deleteSavedPublicVideo,listSavedPublicVideos,type SavedPublicVideo} from './offline-public-video';

/** Local-only collection; remains accessible when the remote feed is offline. */
export function OfflineVideosLibrary({visible,onClose}:{
  visible:boolean;onClose:()=>void
}){
  const {colors}=useAppearance();
  const {locale}=useI18n();
  const t=offlineVideoLabels(locale);
  const [items,setItems]=useState<SavedPublicVideo[]>([]);
  const storedBytes=items.reduce((sum,item)=>sum+item.bytes,0);
  const [chosen,setChosen]=useState<SavedPublicVideo|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
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
    Alert.alert(t.removeTitle,t.removeDescription,[
      {text:t.cancel,style:'cancel'},
      {text:t.delete,style:'destructive',onPress:()=>{void (async()=>{
        await deleteSavedPublicVideo(item.url);
        if(chosen?.url===item.url)setChosen(null);
        setRefreshId(n=>n+1);
      })().catch(()=>setError(t.deleteError));}}
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
            {chosen?t.viewerTitle:t.listTitle}
          </Text>
          <Text style={{color:colors.muted,fontSize:12}}>
            {chosen?t.viewerSubtitle:t.available(items.length)+' · '+t.storage+' '+offlineVideoSize(storedBytes,locale)}
          </Text>
        </View>
        {!chosen&&<Pressable accessibilityRole="button" accessibilityLabel={t.refresh}
          onPress={()=>setRefreshId(n=>n+1)} style={styles.tap}>
          <KnowMeIcon name="refresh" size={21} color={colors.text}/>
        </Pressable>}
      </View>
      {chosen?
        <View style={styles.viewer}>
          <PublicPostVideo key={chosen.url} url={chosen.url}/>
          <View style={styles.viewerBottom}>
            <Text style={styles.viewerInfo}>{t.offlineSaved} · {offlineVideoSize(chosen.bytes,locale)}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t.removeCurrent}
              onPress={()=>remove(chosen)} style={styles.removeLarge}>
              <KnowMeIcon name="close" color="#fff" size={19}/>
              <Text style={{color:'#fff',fontWeight:'800'}}>{t.removeCopy}</Text>
            </Pressable>
          </View>
        </View>
      :<FlatList data={items} keyExtractor={item=>item.url}
        refreshing={loading} onRefresh={()=>setRefreshId(n=>n+1)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<Text style={{color:colors.muted,fontSize:13,lineHeight:19}}>
          {t.privacy}
        </Text>}
        renderItem={({item,index})=><View style={[styles.entry,{backgroundColor:colors.surface,borderColor:colors.border}]}>
          <Pressable accessibilityRole="button"
            accessibilityLabel={t.play(index+1)}
            onPress={()=>setChosen(item)} style={styles.entryMain}>
            <View style={[styles.play,{backgroundColor:colors.backgroundAccent}]}>
              <KnowMeIcon name="play" size={24} color={colors.accent}/>
            </View>
            <View style={{flex:1,gap:5}}>
              <Text style={{fontWeight:'800',color:colors.text}}>{t.video(index+1)}</Text>
              <Text style={{color:colors.muted,fontSize:12}}>{offlineVideoSize(item.bytes,locale)} · {t.device}</Text>
            </View>
          </Pressable>
          <Pressable accessibilityRole="button"
            accessibilityLabel={t.remove(index+1)}
            onPress={()=>remove(item)} style={styles.tap}>
            <KnowMeIcon name="close" size={19} color={colors.muted}/>
          </Pressable>
        </View>}
        ListEmptyComponent={!loading?<View style={{alignItems:'center',gap:12,paddingVertical:56}}>
          <KnowMeIcon name="download" size={42} color={colors.muted}/>
          <Text style={{color:colors.text,fontWeight:'800'}}>{t.emptyTitle}</Text>
          <Text style={{color:colors.muted,textAlign:'center',fontSize:13}}>
            {t.emptyMessage}
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