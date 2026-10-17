import AsyncStorage from '@react-native-async-storage/async-storage';
import {KNOWME_ANIMATED_EMOJIS} from '@knowme/animation-contract';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,TextInput,
  View,useWindowDimensions} from 'react-native';
import {apiFetch} from './api';
import {AnimatedEmoji} from './AnimatedEmoji';
import {ChatMediaAttachment} from './ChatMediaAttachment';
import {useAppearance} from './AppearanceProvider';
import {KnowMeIcon} from './ui/KnowMeUI';

export type ExpressionTab='emoji'|'gifs'|'stickers';
type Sticker={key:string;version?:number;label:string;glyph:string;accessibilityLabel:string};
type Pack={key:string;name:string;description?:string;stickers:Sticker[]};
type StickerCatalog={packs:Pack[]};
type MediaAsset={id:string;detectedMime:string;status:string;deletedAt?:string|null;
  conversationId?:string|null;purpose?:string};
type Props<T>={conversationId:string;tab:ExpressionTab;onChangeTab:(tab:ExpressionTab)=>void;
  onClose:()=>void;onInsertEmoji:(emoji:string)=>void;onSent:(message:T)=>void;
  onImportGif:()=>void;};

const STORAGE_KEY='knowme.chat.expression.recents.v1';
const GLYPHS=KNOWME_ANIMATED_EMOJIS.map(emoji=>emoji.glyph);
const EMOJI_CATEGORIES=[
  {label:'❤️',name:'Amour',match:/[❤🧡💛💚💙💜💕💖💘😍🥰😘]/u},
  {label:'👍',name:'Gestes',match:/[👍👏🙏👋🤙👌✌🫶]/u},
  {label:'😃',name:'Visages',match:/[😀😃😄😁😆😅😂🤣😊🙂🙃😉😎🤔🥺😭😡😱]/u},
  {label:'🎉',name:'Fêtes',match:/[🎁🎉🎊✨🔥⭐⚡]/u}
] as const;

export function ChatExpressionKeyboard<T>({conversationId,tab,onChangeTab,onClose,onInsertEmoji,onSent,onImportGif}:Props<T>){
  const {colors}=useAppearance();
  const {height:screenHeight,width:screenWidth}=useWindowDimensions();
  const [expanded,setExpanded]=useState(false);
  const [search,setSearch]=useState('');
  const [searchOpen,setSearchOpen]=useState(false);
  const [category,setCategory]=useState<string|null>(null);
  const [recent,setRecent]=useState<string[]>([]);
  const [favorites,setFavorites]=useState<string[]>([]);
  const [packs,setPacks]=useState<Pack[]>([]);
  const [packKey,setPackKey]=useState('');
  const [savedGifs,setSavedGifs]=useState<MediaAsset[]>([]);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(false);
  const [failure,setFailure]=useState('');
  const dragStartY=useRef(0);
  const [recentPage,setRecentPage]=useState(false);
  const textColor='#e4e7f1',muted='#a6a9be',panelBg='#222536',deepBg='#2b2e40';
  const activeColor=colors.accent;

  useEffect(()=>{
    let live=true;
    void AsyncStorage.getItem(STORAGE_KEY).then(raw=>{
      if(!live||!raw)return;
      try {
        const saved=JSON.parse(raw) as {recent?:string[];favorites?:string[]};
        setRecent(Array.isArray(saved.recent)?saved.recent.slice(0,36):[]);
        setFavorites(Array.isArray(saved.favorites)?saved.favorites.slice(0,36):[]);
      } catch { /* Discard incompatible old preferences. */ }
    }).catch(()=>undefined);
    return()=>{live=false;};
  },[]);
  function persist(nextRecent:string[],nextFavorites:string[]){
    void AsyncStorage.setItem(STORAGE_KEY,JSON.stringify({recent:nextRecent,favorites:nextFavorites})).catch(()=>undefined);
  }
  function chooseEmoji(glyph:string){
    const next=[glyph,...recent.filter(item=>item!==glyph)].slice(0,36);
    setRecent(next);persist(next,favorites);
    onInsertEmoji(glyph);
  }
  function toggleFavorite(glyph:string){
    const next=favorites.includes(glyph)?favorites.filter(item=>item!==glyph):[glyph,...favorites].slice(0,36);
    setFavorites(next);persist(recent,next);
  }

  useEffect(()=>{
    if(tab!=='stickers'||packs.length)return;
    let live=true;
    setLoading(true);setFailure('');
    void apiFetch<StickerCatalog>('/stickers/catalog').then(data=>{
      if(!live)return;
      setPacks(Array.isArray(data.packs)?data.packs:[]);
      setPackKey(data.packs?.[0]?.key??'');
    }).catch(error=>{if(live)setFailure(error instanceof Error?error.message:'Packs indisponibles.');})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[tab,packs.length]);

  useEffect(()=>{
    if(tab!=='gifs')return;
    let live=true;
    setLoading(true);setFailure('');
    void apiFetch<MediaAsset[]>('/media/mine').then(items=>{
      if(live)setSavedGifs((Array.isArray(items)?items:[]).filter(item=>
        item.detectedMime==='image/gif'&&item.status==='AVAILABLE'&&
        !item.deletedAt&&item.conversationId===conversationId).slice(0,100));
    }).catch(error=>{if(live)setFailure(error instanceof Error?error.message:'GIF momentanément indisponibles.');})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[conversationId,tab]);

  const pack=packs.find(item=>item.key===packKey)??packs[0];
  const emojiResults=useMemo(()=>{
    let list=category==='Favoris'?favorites:category==='Récents'?recent:GLYPHS;
    const selected=EMOJI_CATEGORIES.find(item=>item.name===category);
    if(selected)list=list.filter(glyph=>selected.match.test(glyph));
    const query=search.trim().toLocaleLowerCase();
    return list.filter(glyph=>!query||glyph.includes(query));
  },[category,favorites,recent,search]);
  const stickerResults=useMemo(()=>{
    const query=search.trim().toLocaleLowerCase();
    return (pack?.stickers??[]).filter(item=>!query||
      item.label.toLocaleLowerCase().includes(query)||
      item.accessibilityLabel.toLocaleLowerCase().includes(query));
  },[search,pack]);

  async function sendSticker(sticker:Sticker){
    if(busy||!pack)return;
    setBusy(true);setFailure('');
    try {
      const message=await apiFetch<T>(`/conversations/${encodeURIComponent(conversationId)}/stickers`,{
        method:'POST',body:JSON.stringify({packKey:pack.key,stickerKey:sticker.key})
      });
      onSent(message);
      const next=[sticker.glyph,...recent.filter(value=>value!==sticker.glyph)].slice(0,36);
      setRecent(next);persist(next,favorites);
    } catch(error){setFailure(error instanceof Error?error.message:'Envoi impossible.');}
    finally{setBusy(false);}
  }
  async function sendGif(asset:MediaAsset){
    if(busy)return;
    setBusy(true);setFailure('');
    try{
      const message=await apiFetch<T>(`/conversations/${encodeURIComponent(conversationId)}/media-messages`,{
        method:'POST',body:JSON.stringify({assetId:asset.id,kind:'GIF'})
      });
      onSent(message);
    }catch(error){setFailure(error instanceof Error?error.message:'GIF indisponible.');}
    finally{setBusy(false);}
  }
  function changeTab(next:ExpressionTab){
    setSearch('');setSearchOpen(false);setCategory(null);setRecentPage(false);
    onChangeTab(next);
  }
  const minHeight=Math.min(345,screenHeight*0.42);
  const maxHeight=Math.min(screenHeight*0.77,720);
  const numberOfColumns=Math.max(4,Math.floor((screenWidth-18)/(tab==='emoji'?55:83)));
  const sectionHeading=category==='Favoris'?'Favoris':category==='Récents'?'Récemment utilisés':'Tendance et packs KnowMe';

  return <View style={[styles.root,{height:expanded?maxHeight:minHeight,backgroundColor:panelBg}]}
      accessibilityLabel="Clavier multimédia KnowMe">
    <View style={styles.grabArea} onStartShouldSetResponder={()=>true}
      onResponderGrant={e=>{dragStartY.current=e.nativeEvent.pageY;}}
      onResponderRelease={e=>{
        const delta=e.nativeEvent.pageY-dragStartY.current;
        if(delta < -35)setExpanded(true);
        else if(delta > 35)setExpanded(false);
        else setExpanded(value=>!value);
      }}>
      <View style={styles.grab}/>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.packStrip}
      contentContainerStyle={styles.packStripContent} keyboardShouldPersistTaps="always">
      <Pressable style={[styles.roundTab,recentPage&&styles.selectedTab]}
        onPress={()=>{if(tab==='gifs')onChangeTab('emoji');setRecentPage(true);setCategory('Récents');}}
        accessibilityLabel="Récents"><Text style={[styles.categorySymbol,{color:muted}]}>◷</Text></Pressable>
      <Pressable style={[styles.roundTab,category==='Favoris'&&styles.selectedTab]}
        onPress={()=>{if(tab!=='emoji')onChangeTab('emoji');setRecentPage(false);setCategory('Favoris');}}
        accessibilityLabel="Favoris"><Text style={[styles.categorySymbol,{color:muted}]}>☆</Text></Pressable>
      {packs.slice(0,24).map(item=><Pressable key={item.key}
          style={[styles.packCover,packKey===item.key&&tab==='stickers'&&styles.packSelected]}
          accessibilityLabel={`Pack ${item.name}`} onPress={()=>{changeTab('stickers');setPackKey(item.key);}}>
          <Text numberOfLines={1} style={styles.packCoverEmoji}>{item.stickers[0]?.glyph||'◈'}</Text>
        </Pressable>)}
      {!packs.length&&GLYPHS.slice(0,9).map((glyph,index)=>
        <Pressable key={glyph+index} onPress={()=>{onChangeTab('emoji');setCategory(null);}}
          style={styles.packCover}><AnimatedEmoji glyph={glyph} size={30} autoPlay={false}/></Pressable>)}
    </ScrollView>
    <View style={[styles.searchBar,{backgroundColor:deepBg}]}>
      <Pressable style={styles.searchTap} onPress={()=>setSearchOpen(current=>!current)}
        accessibilityLabel="Rechercher emojis GIF ou stickers">
        <KnowMeIcon name="search" color={muted} size={21}/>
      </Pressable>
      {searchOpen?<TextInput autoFocus value={search} onChangeText={setSearch}
          placeholder="Rechercher" placeholderTextColor={muted} style={[styles.searchInput,{color:textColor}]}/>:
        <Pressable style={styles.searchPlaceholder} onPress={()=>setSearchOpen(true)}>
          <Text style={{color:muted,fontSize:15}}>Rechercher</Text>
        </Pressable>}
      {(tab==='emoji'?EMOJI_CATEGORIES:[
        {label:'❤️',name:'Favoris'},
        {label:'👍',name:'Récents'},
        {label:'🎉',name:'Tendance'}
      ]).map(item=><Pressable key={item.name}
        accessibilityLabel={item.name} accessibilityState={{selected:category===item.name}}
        style={styles.filter} onPress={()=>{setCategory(current=>current===item.name?null:item.name);}}>
        <Text style={{fontSize:21,opacity:category===item.name?1:0.65}}>{item.label}</Text>
      </Pressable>)}
      {searchOpen?<Pressable onPress={()=>{setSearch('');setSearchOpen(false);}} accessibilityLabel="Effacer la recherche">
        <KnowMeIcon name="close" size={20} color={muted}/></Pressable>:null}
    </View>
    {failure?<Pressable onPress={()=>{setFailure('');setPacks([]);}} style={styles.status}>
      <Text style={{color:'#ffaaa9',fontSize:12}}>{failure} · Réessayer</Text>
    </Pressable>:null}
    {loading?<ActivityIndicator color={activeColor} style={{marginTop:7}}/>:null}
    <ScrollView style={styles.contentScroll} keyboardShouldPersistTaps="always"
      contentContainerStyle={styles.content}>
      {tab==='emoji'? <>
        {!search&&category===null&&favorites.length>0?<View style={styles.section}>
          <Text style={styles.sectionTitle}>Favoris</Text>
          <View style={styles.grid}>{favorites.slice(0,12).map((glyph,i)=>
            <Pressable key={glyph+i} onPress={()=>chooseEmoji(glyph)} onLongPress={()=>toggleFavorite(glyph)}
              style={[styles.emojiTile,{width:(screenWidth-28)/numberOfColumns}]}>
              <AnimatedEmoji glyph={glyph} size={35} autoPlay={false}/>
            </Pressable>)}</View>
        </View>:null}
        {!search&&category===null&&recent.length>0?<View style={styles.section}>
          <Text style={styles.sectionTitle}>Récemment utilisés</Text>
          <View style={styles.grid}>{recent.slice(0,16).map((glyph,i)=>
            <Pressable key={glyph+i} onPress={()=>chooseEmoji(glyph)} onLongPress={()=>toggleFavorite(glyph)}
              style={[styles.emojiTile,{width:(screenWidth-28)/numberOfColumns}]}>
              <AnimatedEmoji glyph={glyph} size={35} autoPlay={false}/>
            </Pressable>)}</View>
        </View>:null}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{category||'Expressions et emojis animés'}</Text>
          <View style={styles.grid}>{emojiResults.map((glyph,i)=>
            <Pressable key={glyph+i} style={[styles.emojiTile,{width:(screenWidth-28)/numberOfColumns}]}
              accessibilityRole="button" accessibilityLabel={`Insérer ${glyph}`}
              onPress={()=>chooseEmoji(glyph)} onLongPress={()=>toggleFavorite(glyph)}>
              <AnimatedEmoji glyph={glyph} size={34} autoPlay={false}/>
            </Pressable>)}</View>
        </View>
      </>:tab==='stickers'?<>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{category||pack?.name||sectionHeading}</Text>
          <View style={styles.grid}>
            {stickerResults.map((sticker,i)=><Pressable key={sticker.key+i}
              disabled={busy} onPress={()=>void sendSticker(sticker)}
              onLongPress={()=>toggleFavorite(sticker.glyph)}
              accessibilityLabel={`Envoyer ${sticker.accessibilityLabel}`}
              style={[styles.stickerTile,{width:(screenWidth-28)/Math.max(3,Math.floor((screenWidth-28)/89))}]}>
              <AnimatedEmoji glyph={sticker.glyph} size={63} autoPlay={false}/>
            </Pressable>)}
          </View>
          {!pack&&!loading?<Text style={styles.hint}>Aucun pack de stickers disponible.</Text>:null}
        </View>
      </>:<>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GIF disponibles dans cette conversation</Text>
          <View style={styles.grid}>{savedGifs.filter(item=>!search.trim()||item.id.includes(search.trim())).map(item=>
            <View key={item.id} style={styles.gifTile}>
              <ChatMediaAttachment assetId={item.id} kind="GIF"/>
              <Pressable disabled={busy} onPress={()=>void sendGif(item)} accessibilityRole="button"
                accessibilityLabel="Envoyer ce GIF" style={[styles.gifSend,{backgroundColor:activeColor}]}>
                <Text style={{color:colors.accentText,fontWeight:'700'}}>Envoyer</Text>
              </Pressable>
            </View>)}</View>
          {!savedGifs.length&&!loading?<Text style={styles.hint}>Aucun GIF enregistré ici pour le moment.</Text>:null}
          <Pressable style={[styles.importGif,{borderColor:activeColor}]}
            onPress={onImportGif} accessibilityRole="button" accessibilityLabel="Importer un GIF depuis la galerie">
            <Text style={{color:activeColor,fontWeight:'700'}}>＋ Choisir un GIF dans la galerie</Text>
          </Pressable>
        </View>
      </>}
    </ScrollView>
    <View style={styles.bottomRow}>
      <View style={styles.segment}>
        {(['emoji','gifs','stickers'] as const).map(item=><Pressable key={item}
          style={[styles.tabButton,tab===item&&styles.selectedTab]}
          accessibilityRole="tab" accessibilityState={{selected:tab===item}}
          onPress={()=>changeTab(item)}>
          <Text style={[styles.tabText,{color:tab===item?textColor:muted}]}>
            {item==='emoji'?'Emoji':item==='gifs'?'GIFs':'Stickers'}
          </Text>
        </Pressable>)}
      </View>
      <Pressable onPress={onClose} style={styles.closeKeyboard} accessibilityRole="button"
        accessibilityLabel="Fermer le clavier multimédia">
        <KnowMeIcon name="keyboard" size={22} color={muted}/>
      </Pressable>
    </View>
  </View>;
}

const styles=StyleSheet.create({
  root:{width:'100%',overflow:'hidden',borderTopLeftRadius:23,borderTopRightRadius:23},
  grabArea:{height:15,alignItems:'center',justifyContent:'center'},
  grab:{width:38,height:4,borderRadius:3,backgroundColor:'#596073'},
  packStrip:{maxHeight:58,flexGrow:0},
  packStripContent:{paddingHorizontal:10,alignItems:'center',gap:8,paddingBottom:7},
  roundTab:{width:42,height:42,borderRadius:23,alignItems:'center',justifyContent:'center',backgroundColor:'#2d3041'},
  categorySymbol:{fontSize:31,lineHeight:37},
  selectedTab:{backgroundColor:'#383c57'},
  packCover:{width:42,height:42,borderRadius:13,alignItems:'center',justifyContent:'center',
    overflow:'hidden',backgroundColor:'#313548'},
  packSelected:{borderColor:'#8698de',borderWidth:2},
  packCoverEmoji:{fontSize:25,textAlign:'center'},
  searchBar:{height:45,borderRadius:25,marginHorizontal:11,marginBottom:5,
    flexDirection:'row',alignItems:'center',paddingHorizontal:10,gap:7},
  searchTap:{width:25,alignItems:'center'},
  searchPlaceholder:{flex:1,justifyContent:'center',height:43},
  searchInput:{flex:1,minWidth:45,backgroundColor:'transparent',fontSize:15,paddingVertical:0},
  filter:{minWidth:27,height:36,alignItems:'center',justifyContent:'center'},
  status:{paddingHorizontal:15,minHeight:28,justifyContent:'center'},
  contentScroll:{flex:1,minHeight:0},
  content:{paddingHorizontal:11,paddingBottom:14},
  section:{marginTop:11,gap:10},
  sectionTitle:{fontSize:16,fontWeight:'700',color:'#afb2c6',marginLeft:5},
  grid:{flexDirection:'row',flexWrap:'wrap',rowGap:10,columnGap:0,justifyContent:'flex-start'},
  emojiTile:{height:47,alignItems:'center',justifyContent:'center'},
  stickerTile:{height:87,alignItems:'center',justifyContent:'center'},
  gifTile:{width:'48%',minHeight:175,marginBottom:10,borderRadius:9,overflow:'hidden'},
  gifSend:{minHeight:40,alignItems:'center',justifyContent:'center',borderRadius:9,marginTop:5},
  importGif:{minHeight:50,borderWidth:1,borderRadius:12,alignItems:'center',justifyContent:'center',marginTop:14},
  hint:{color:'#a6a9be',fontSize:13,paddingHorizontal:7,paddingVertical:8},
  bottomRow:{height:65,flexDirection:'row',alignItems:'center',justifyContent:'center',position:'relative'},
  segment:{flexDirection:'row',borderRadius:26,padding:4,backgroundColor:'#292d44'},
  tabButton:{minWidth:91,minHeight:41,paddingHorizontal:12,alignItems:'center',justifyContent:'center',borderRadius:22},
  tabText:{fontSize:16,fontWeight:'700'},
  closeKeyboard:{position:'absolute',right:12,top:10,width:42,height:42,borderRadius:22,
    alignItems:'center',justifyContent:'center'}
});
