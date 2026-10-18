import {useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Alert,FlatList,Modal,Pressable,StyleSheet,Text,View} from 'react-native';
import {useAppearance} from './AppearanceProvider';
import {KnowMeIcon} from './ui/KnowMeUI';
import {PublicPostVideo} from './PublicPostVideo';
import {deleteSavedPublicVideo,listSavedPublicVideos,type SavedPublicVideo} from './offline-public-video';

const mb=(size:number)=>(size/(1024*1024)).toFixed(1)+' Mo';

/** Local-only collection; remains accessible when the remote feed is offline. */
export function OfflineVideosLibrary({visible,onClose}:{
  visible:boolean;onClose:()=>void
}){
  const {colors}=useAppearance();
  const [items,setItems]=useState<SavedPublicVideo[]>([]);
  const [chosen,setChosen]=useState<SavedPublicVideo|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [refreshId,setRefreshId]=useState(0);
  const refresh=useCallback(async()=>{
    setLoading(true);setError('');
    try{setItems(await listSavedPublicVideos());}
    catch{setError('Impossible de lire les vidéos enregistrées.');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{
    if(visible){void refresh();}
    else setChosen(null);
  },[visible,refreshId,refresh]);
  function remove(item:SavedPublicVideo){
    Alert.alert('Retirer cette vidéo ?', 'La publication reste sur KnowMe. Seule la copie locale sera supprimée.',[
      {text:'Annuler',style:'cancel'},
      {text:'Supprimer',style:'destructive',onPress:()=>{void (async()=>{
        await deleteSavedPublicVideo(item.url);
        if(chosen?.url===item.url)setChosen(null);
        setRefreshId(n=>n+1);
      })().catch(()=>setError('Suppression impossible.'));}}
    ]);
  }
  return <Modal visible={visible} animationType="slide" onRequestClose={()=>{
    if(chosen){setChosen(null);return;}
    onClose();
  }}>
    <View style={[styles.root,{backgroundColor:colors.background}]}>
      <View style={[styles.header,{borderBottomColor:colors.border}]}>
        <Pressable accessibilityRole="button" accessibilityLabel={chosen?'Retour aux vidéos téléchargées':'Fermer les téléchargements'}
          onPress={()=>chosen?setChosen(null):onClose()} style={styles.tap}>
          <KnowMeIcon name="back" size={23} color={colors.text}/>
        </Pressable>
        <View style={{flex:1}}>
          <Text style={[styles.title,{color:colors.text}]} numberOfLines={1}>
            {chosen?'Vidéo hors ligne':'Vidéos enregistrées'}
          </Text>
          <Text style={{color:colors.muted,fontSize:12}}>
            {chosen?'Lecture depuis cet appareil':items.length+' vidéo(s) disponibles hors connexion'}
          </Text>
        </View>
        {!chosen&&<Pressable accessibilityRole="button" accessibilityLabel="Actualiser les vidéos enregistrées"
          onPress={()=>setRefreshId(n=>n+1)} style={styles.tap}>
          <KnowMeIcon name="refresh" size={21} color={colors.text}/>
        </Pressable>}
      </View>
      {chosen?
        <View style={styles.viewer}>
          <PublicPostVideo key={chosen.url} url={chosen.url}/>
          <View style={styles.viewerBottom}>
            <Text style={styles.viewerInfo}>Vidéo enregistrée · {mb(chosen.bytes)}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Supprimer cette vidéo téléchargée"
              onPress={()=>remove(chosen)} style={styles.removeLarge}>
              <KnowMeIcon name="close" color="#fff" size={19}/>
              <Text style={{color:'#fff',fontWeight:'800'}}>Supprimer la copie</Text>
            </Pressable>
          </View>
        </View>
      :<FlatList data={items} keyExtractor={item=>item.url}
        refreshing={loading} onRefresh={()=>setRefreshId(n=>n+1)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<Text style={{color:colors.muted,fontSize:13,lineHeight:19}}>
          Tes vidéos sont stockées dans l’espace privé de l’application. Elles ne nécessitent ni compte connecté ni réseau pour être lues.
        </Text>}
        renderItem={({item,index})=><View style={[styles.entry,{backgroundColor:colors.surface,borderColor:colors.border}]}>
          <Pressable accessibilityRole="button"
            accessibilityLabel={'Lire la vidéo hors ligne '+(index+1)}
            onPress={()=>setChosen(item)} style={styles.entryMain}>
            <View style={[styles.play,{backgroundColor:colors.backgroundAccent}]}>
              <KnowMeIcon name="play" size={24} color={colors.accent}/>
            </View>
            <View style={{flex:1,gap:5}}>
              <Text style={{fontWeight:'800',color:colors.text}}>Vidéo {index+1}</Text>
              <Text style={{color:colors.muted,fontSize:12}}>{mb(item.bytes)} · Sur cet appareil</Text>
            </View>
          </Pressable>
          <Pressable accessibilityRole="button"
            accessibilityLabel={'Supprimer la vidéo hors ligne '+(index+1)}
            onPress={()=>remove(item)} style={styles.tap}>
            <KnowMeIcon name="close" size={19} color={colors.muted}/>
          </Pressable>
        </View>}
        ListEmptyComponent={!loading?<View style={{alignItems:'center',gap:12,paddingVertical:56}}>
          <KnowMeIcon name="download" size={42} color={colors.muted}/>
          <Text style={{color:colors.text,fontWeight:'800'}}>Aucune vidéo enregistrée</Text>
          <Text style={{color:colors.muted,textAlign:'center',fontSize:13}}>
            Ouvre un Reel et touche « Hors ligne » pour l’enregistrer.
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