import {Modal,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {KnowMeIcon} from './ui/KnowMeUI';

/** No display/truncation limit on a Reel's full author caption. */
export function ReelCaptionSheet({clip,onClose,onProfile}:{
  clip:{id:string;author:{username:string;displayName:string};content:string}|null;
  onClose:()=>void;
  onProfile:(username:string)=>void;
}){
  return <Modal visible={Boolean(clip)} transparent animationType="slide"
    onRequestClose={onClose} statusBarTranslucent>
    <View style={styles.full}>
      <Pressable onPress={onClose} accessibilityRole="button"
        accessibilityLabel="Fermer la description" style={styles.scrim}/>
      <View style={styles.sheet}>
        <View style={styles.handle}/>
        <View style={styles.head}>
          <Text style={styles.title}>Description du Reel</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Fermer"
            onPress={onClose} style={styles.close}>
            <KnowMeIcon name="close" size={22} color="#d4e5ea"/>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button"
          accessibilityLabel={'Voir le profil de '+(clip?.author.displayName??'')}
          onPress={()=>{
            if(!clip)return;
            onClose();onProfile(clip.author.username);
          }} style={styles.author}>
          <KnowMeIcon name="profile" size={21} color="#83e9de"/>
          <Text style={{color:'#a5fff0',fontWeight:'800',fontSize:14}}>
            @{clip?.author.username}
          </Text>
        </Pressable>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}
          showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
          <Text selectable style={styles.caption}>{clip?.content}</Text>
        </ScrollView>
        <Text style={styles.hint}>Tu peux sélectionner et copier le texte.</Text>
      </View>
    </View>
  </Modal>;
}
const styles=StyleSheet.create({
  full:{flex:1,justifyContent:'flex-end'},
  scrim:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(0,0,0,.74)'},
  sheet:{maxHeight:'85%',minHeight:300,backgroundColor:'#151f2c',
    borderTopLeftRadius:27,borderTopRightRadius:27,paddingHorizontal:18,
    paddingTop:10,paddingBottom:30,borderTopWidth:1,borderTopColor:'#3e4b5c'},
  handle:{alignSelf:'center',width:37,height:4,borderRadius:2,backgroundColor:'#5d6b78',marginBottom:12},
  head:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  title:{fontSize:17,fontWeight:'800',color:'#fff'},
  close:{width:44,height:44,alignItems:'center',justifyContent:'center'},
  author:{minHeight:48,flexDirection:'row',alignItems:'center',gap:10},
  scroll:{flexShrink:1,maxHeight:480,marginTop:12},
  content:{paddingBottom:24},
  caption:{fontSize:15,lineHeight:23,color:'#f1f4f8'},
  hint:{fontSize:12,color:'#96a7b9',paddingTop:12,borderTopWidth:1,borderTopColor:'#304051'}
});