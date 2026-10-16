import {useEffect,useState} from 'react';
import {ActivityIndicator,Modal,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {apiFetch} from './api';
import {AnimatedEmoji} from './AnimatedEmoji';
import {useAppearance} from './AppearanceProvider';
import {KnowMeIcon, PressScale} from './ui/KnowMeUI';

type Sticker={key:string;label:string;glyph:string;accessibilityLabel:string};
type Pack={key:string;name:string;description:string;stickers:Sticker[]};
type Catalog={schemaVersion:number;packs:Pack[]};

export function KnowMeStickerPicker<T>({conversationId,onSent}:{
  conversationId:string;
  onSent:(message:T)=>void;
}) {
  const {colors}=useAppearance();
  const [open,setOpen]=useState(false);
  const [catalog,setCatalog]=useState<Pack[]>([]);
  const [selectedKey,setSelectedKey]=useState('');
  const [preview,setPreview]=useState<Sticker|null>(null);
  const [loading,setLoading]=useState(false);
  const [sending,setSending]=useState('');
  const [error,setError]=useState('');
  useEffect(()=>{
    if(!open||catalog.length>0)return;
    let active=true;
    setLoading(true);
    void apiFetch<Catalog>('/stickers/catalog').then(result=>{
      if(!active)return;
      const packs=Array.isArray(result.packs)?result.packs:[];
      setCatalog(packs);
      if(packs[0])setSelectedKey(packs[0].key);
      setError('');
    }).catch(cause=>{
      if(active)setError(cause instanceof Error?cause.message:'Catalogue indisponible.');
    }).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[open,catalog.length]);

  const pack=catalog.find(p=>p.key===selectedKey)??catalog[0];
  async function send(packKey:string,sticker:Sticker){
    if(sending)return;
    setSending(sticker.key);setError('');
    try{
      const message=await apiFetch<T>(
        `/conversations/${encodeURIComponent(conversationId)}/stickers`,{
          method:'POST',body:JSON.stringify({packKey,stickerKey:sticker.key})
        });
      onSent(message);
      setPreview(null);setOpen(false);
    }catch(cause){setError(cause instanceof Error?cause.message:'Envoi impossible.');}
    finally{setSending('');}
  }
  return <>
    <PressScale accessibilityRole="button" accessibilityLabel="Choisir un sticker KnowMe"
      onPress={()=>setOpen(true)}
      style={[styles.trigger,{backgroundColor:colors.backgroundAccent}]}>
      <KnowMeIcon name="spark" color={colors.accent} size={23}/>
    </PressScale>
    <Modal visible={open} transparent animationType="slide" onRequestClose={()=>setOpen(false)}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={()=>setOpen(false)}/>
        <View style={[styles.sheet,{backgroundColor:colors.surface,borderColor:colors.border}]}>
          <View style={styles.header}>
            <Text style={[styles.title,{color:colors.text}]}>Stickers KnowMe</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Fermer les stickers"
              style={styles.close} onPress={()=>{setOpen(false);setPreview(null);}}>
              <KnowMeIcon name="close" color={colors.text} size={21}/>
            </Pressable>
          </View>
          {loading?<ActivityIndicator color={colors.accent}/>:null}
          {error?<Text role="alert" style={{color:colors.danger,fontSize:12}}>{error}</Text>:null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={{flexGrow:0}} contentContainerStyle={styles.packTabs}>
            {catalog.map(item=><Pressable key={item.key}
              accessibilityRole="tab" accessibilityState={{selected:pack?.key===item.key}}
              style={[styles.packTab,{backgroundColor:pack?.key===item.key?
                colors.backgroundAccent:'transparent',borderColor:colors.border}]}
              onPress={()=>{setSelectedKey(item.key);setPreview(null);}}>
              <Text style={{color:pack?.key===item.key?colors.accent:colors.text,fontWeight:'700'}}>
                {item.name}
              </Text>
            </Pressable>)}
          </ScrollView>
          {preview && pack ? (
            <View style={[styles.preview,{backgroundColor:colors.backgroundAccent}]}>
              <AnimatedEmoji glyph={preview.glyph} size={62}/>
              <Text style={{color:colors.text,fontWeight:'700'}}>{preview.label}</Text>
              <PressScale accessibilityRole="button" accessibilityLabel="Envoyer ce sticker"
                disabled={!!sending} onPress={()=>void send(pack.key,preview)}
                style={[styles.send,{backgroundColor:colors.accent}]}>
                <Text style={{color:colors.accentText,fontWeight:'800'}}>Envoyer le sticker</Text>
              </PressScale>
              <Pressable accessibilityRole="button" style={styles.close}
                onPress={()=>setPreview(null)}>
                <Text style={{color:colors.accent,fontWeight:'700'}}>Retour au pack</Text>
              </Pressable>
            </View>
          ) : pack ? (
            <ScrollView style={styles.scroll} contentContainerStyle={styles.stickerGrid}>
              <Text style={[styles.description,{color:colors.muted}]}>{pack.description}</Text>
              <View style={styles.tiles}>
                {pack.stickers.map(sticker=>(
                  <Pressable key={sticker.key} accessibilityRole="button"
                    accessibilityLabel={`Envoyer sticker : ${sticker.accessibilityLabel}`}
                    disabled={!!sending}
                    onPress={()=>void send(pack.key,sticker)}
                    onLongPress={()=>setPreview(sticker)}
                    style={[styles.tile,{backgroundColor:colors.backgroundAccent}]}>
                    <AnimatedEmoji glyph={sticker.glyph} size={37} autoPlay={false}/>
                    <Text numberOfLines={1} style={{color:colors.muted,fontSize:10}}>
                      {sticker.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          ) : !loading?<Text style={{color:colors.muted}}>Aucun pack disponible.</Text>:null}
        </View>
      </View>
    </Modal>
  </>;
}
const styles=StyleSheet.create({
  trigger:{minHeight:44,width:44,borderRadius:22,alignItems:'center',justifyContent:'center'},
  backdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.6)'},
  sheet:{maxHeight:'80%',minHeight:290,borderTopLeftRadius:26,borderTopRightRadius:26,
    borderWidth:StyleSheet.hairlineWidth,paddingHorizontal:14,paddingTop:12,paddingBottom:25,gap:12},
  header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  close:{minHeight:44,paddingHorizontal:12,alignItems:'center',justifyContent:'center'},
  title:{fontSize:18,fontWeight:'800'},
  packTabs:{gap:8,paddingVertical:2},
  packTab:{borderRadius:16,minHeight:39,justifyContent:'center',
    paddingHorizontal:14,borderWidth:StyleSheet.hairlineWidth},
  scroll:{flexGrow:0},
  description:{fontSize:12,lineHeight:19},
  stickerGrid:{paddingBottom:20,gap:12},
  tiles:{flexDirection:'row',flexWrap:'wrap',gap:8},
  tile:{width:84,height:90,borderRadius:17,alignItems:'center',justifyContent:'center',gap:4},
  preview:{alignItems:'center',gap:12,padding:18,borderRadius:18},
  send:{minHeight:46,borderRadius:18,alignItems:'center',justifyContent:'center',paddingHorizontal:20}
});
