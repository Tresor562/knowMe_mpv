import AsyncStorage from '@react-native-async-storage/async-storage';
import {KNOWME_ANIMATED_EMOJIS} from '@knowme/animation-contract';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ActivityIndicator,Image,Modal,Pressable,ScrollView,StyleSheet,Text,TextInput,
  View,useWindowDimensions} from 'react-native';
import {apiFetch} from './api';
import {AnimatedEmoji} from './AnimatedEmoji';
import {ChatMediaAttachment} from './ChatMediaAttachment';
import {useAppearance} from './AppearanceProvider';
import {KnowMeIcon} from './ui/KnowMeUI';
import {KnowMeAlert as Alert} from './ui/KnowMeFeedback';
import {KnowStickerPackCreator} from './KnowStickerPackCreator';
import {readKnowStickerPacks,deleteKnowStickerPack,renameKnowStickerPack,renameKnowStickerItem,
  sendKnowStickerImage,type KnowStickerPack} from './KnowStickerPackStore';
import {knowStickerDisplayName} from './knowsticker-naming-model';
import {UNICODE_EMOJI_CATALOG,UNICODE_EMOJI_GROUPS} from './unicode-emoji-catalog';

export type ExpressionTab='emoji'|'gifs'|'stickers';
type Sticker={key:string;version?:number;label:string;glyph:string;accessibilityLabel:string};
type Pack={key:string;name:string;description?:string;stickers:Sticker[]};
type StickerCatalog={packs:Pack[]};
type MediaAsset={id:string;detectedMime:string;status:string;originalName?:string|null;deletedAt?:string|null;
  conversationId?:string|null;purpose?:string};
type Props<T>={conversationId:string;tab:ExpressionTab;onChangeTab:(tab:ExpressionTab)=>void;
  onClose:()=>void;onInsertEmoji:(emoji:string)=>void;onSent:(message:T)=>void;
  onImportGif:()=>void;expanded:boolean;onExpandedChange:(expanded:boolean)=>void;};

const STORAGE_KEY='knowme.chat.expression.recents.v1';
const GLYPHS=KNOWME_ANIMATED_EMOJIS.map(emoji=>emoji.glyph);

const EMOJI_KEYWORDS:Record<string,string>={
  '😀':'sourire smile joyeux happy','😂':'rire laugh drôle',
  '😍':'amour love yeux coeur','🥰':'amour tendre love',
  '😘':'bisou kiss','🥹':'émotion touché','🥺':'mignon supplie cute',
  '😭':'triste pleure cry','😡':'colère rage angry',
  '😎':'cool lunettes','🤔':'pensée réflexion think',
  '😱':'surprise peur fear','🔥':'feu fire','✨':'brillant sparkles',
  '⭐':'étoile star','🎉':'fête célébration party','👍':'bravo pouce like',
  '👎':'pas bien dislike','👏':'applaudir clap',
  '🙏':'merci thanks','❤️':'amour coeur heart love',
  '💙':'bleu blue heart','💜':'violet purple heart',
  '👋':'salut bonjour hello','🫶':'coeur mains heart hands',
  '🎁':'cadeau gift','🚀':'fusée rocket','🌍':'terre monde earth'
};

const EMOJI_CATEGORIES=[
  {label:'❤️',name:'Amour',match:/[❤🧡💛💚💙💜💕💖💘😍🥰😘]/u},
  {label:'👍',name:'Gestes',match:/[👍👏🙏👋🤙👌✌🫶]/u},
  {label:'😃',name:'Visages',match:/[😀😃😄😁😆😅😂🤣😊🙂🙃😉😎🤔🥺😭😡😱]/u},
  {label:'🎉',name:'Fêtes',match:/[🎁🎉🎊✨🔥⭐⚡]/u}
] as const;

export function ChatExpressionKeyboard<T>({conversationId,tab,onChangeTab,onClose,onInsertEmoji,onSent,onImportGif,expanded,onExpandedChange}:Props<T>){
  const {colors}=useAppearance();
  const {height:screenHeight,width:screenWidth}=useWindowDimensions();
  const [search,setSearch]=useState('');
  const [searchOpen,setSearchOpen]=useState(false);
  const [category,setCategory]=useState<string|null>(null);
  const [recent,setRecent]=useState<string[]>([]);
  const [favorites,setFavorites]=useState<string[]>([]);
  const [gifFavorites,setGifFavorites]=useState<string[]>([]);
  const [packs,setPacks]=useState<Pack[]>([]);
  const [packKey,setPackKey]=useState('');
  const [savedGifs,setSavedGifs]=useState<MediaAsset[]>([]);
  const [savedStickers,setSavedStickers]=useState<MediaAsset[]>([]);
  const [ownPacks,setOwnPacks]=useState<KnowStickerPack[]>([]);
  const [packCreatorOpen,setPackCreatorOpen]=useState(false);
  const [packRevision,setPackRevision]=useState(0);
  const [renameTarget,setRenameTarget]=useState<{
    kind:'pack'|'sticker';packId:string;stickerId?:string;
  }|null>(null);
  const [renameValue,setRenameValue]=useState('');
  const [renameBusy,setRenameBusy]=useState(false);
  const [renameError,setRenameError]=useState('');
  const [stickerAssetFavorites,setStickerAssetFavorites]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(false);
  const [failure,setFailure]=useState('');
  const [retryToken,setRetryToken]=useState(0);
  const dragStartY=useRef(0);
  const [recentPage,setRecentPage]=useState(false);
  const [emojiPageSize,setEmojiPageSize]=useState(112);
  const textColor='#e4e7f1',muted='#a6a9be',panelBg='#222536',deepBg='#2b2e40';
  const activeColor=colors.accent;

  useEffect(()=>{
    let live=true;
    void AsyncStorage.getItem(STORAGE_KEY).then(raw=>{
      if(!live||!raw)return;
      try {
        const saved=JSON.parse(raw) as {recent?:string[];favorites?:string[];gifFavorites?:string[];stickerAssetFavorites?:string[]};
        setRecent(Array.isArray(saved.recent)?saved.recent.slice(0,36):[]);
        setFavorites(Array.isArray(saved.favorites)?saved.favorites.slice(0,36):[]);
        setGifFavorites(Array.isArray(saved.gifFavorites)?saved.gifFavorites.slice(0,36):[]);
        setStickerAssetFavorites(Array.isArray(saved.stickerAssetFavorites)?saved.stickerAssetFavorites.slice(0,36):[]);
      } catch { /* Discard incompatible old preferences. */ }
    }).catch(()=>undefined);
    return()=>{live=false;};
  },[]);
  function persist(nextRecent:string[],nextFavorites:string[]){
    void AsyncStorage.setItem(STORAGE_KEY,JSON.stringify({recent:nextRecent,favorites:nextFavorites,gifFavorites,stickerAssetFavorites})).catch(()=>undefined);
  }
  function chooseEmoji(glyph:string){
    const next=[glyph,...recent.filter(item=>item!==glyph)].slice(0,36);
    setRecent(next);persist(next,favorites);
    onInsertEmoji(glyph);
  }
  function toggleGifFavorite(id:string){
    const next=gifFavorites.includes(id)?gifFavorites.filter(value=>value!==id):[id,...gifFavorites].slice(0,36);
    setGifFavorites(next);
    void AsyncStorage.setItem(STORAGE_KEY,JSON.stringify({recent,favorites,gifFavorites:next,stickerAssetFavorites})).catch(()=>undefined);
  }
  function toggleAssetFavorite(id:string){
    const next=stickerAssetFavorites.includes(id)
      ?stickerAssetFavorites.filter(value=>value!==id):[id,...stickerAssetFavorites].slice(0,36);
    setStickerAssetFavorites(next);
    void AsyncStorage.setItem(STORAGE_KEY,
      JSON.stringify({recent,favorites,gifFavorites,stickerAssetFavorites:next})).catch(()=>undefined);
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
  },[tab,packs.length,retryToken]);

  useEffect(()=>{
    if(tab!=='gifs'&&tab!=='stickers')return;
    let live=true;
    setLoading(true);setFailure('');
    void apiFetch<MediaAsset[]>('/media/mine').then(items=>{
      if(!live)return;
      const available=(Array.isArray(items)?items:[]).filter(item=>
        item.status==='AVAILABLE'&&!item.deletedAt&&item.conversationId===conversationId&&item.purpose==='MESSAGE');
      setSavedGifs(available.filter(item=>item.detectedMime==='image/gif').slice(0,100));
      setSavedStickers(available.filter(item=>['image/png','image/webp'].includes(item.detectedMime)).slice(0,100));
    }).catch(error=>{if(live)setFailure(error instanceof Error?error.message:'GIF momentanément indisponibles.');})
      .finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;};
  },[conversationId,tab,retryToken]);

  useEffect(()=>{
    if(tab!=='stickers')return;
    let live=true;
    void readKnowStickerPacks().then(next=>{if(live)setOwnPacks(next);});
    return()=>{live=false;};
  },[tab,packRevision]);
  async function sendOwnSticker(item:KnowStickerPack['items'][number]){
    if(busy)return;
    setBusy(true);setFailure('');
    try{
      const result=await sendKnowStickerImage<T>(conversationId,item);
      onSent(result);
    }catch(cause){setFailure(cause instanceof Error?cause.message:'Envoi du sticker impossible.');}
    finally{setBusy(false);}
  }
  function openRename(kind:'pack'|'sticker',pack:KnowStickerPack,item?:KnowStickerPack['items'][number]){
    if(busy||renameBusy)return;
    setRenameTarget({kind,packId:pack.id,stickerId:item?.id});
    setRenameValue(kind==='pack'?pack.name:knowStickerDisplayName(item?.name??''));
    setRenameError('');
  }
  async function saveRename(){
    const target=renameTarget;
    if(!target||renameBusy)return;
    setRenameBusy(true);setRenameError('');
    try {
      if(target.kind==='pack'){
        await renameKnowStickerPack(target.packId,renameValue);
      }else if(target.stickerId){
        await renameKnowStickerItem(target.packId,target.stickerId,renameValue);
      }
      setRenameTarget(null);
      setPackRevision(value=>value+1);
    }catch(cause){
      setRenameError(cause instanceof Error?cause.message:'Modification impossible.');
    }finally{setRenameBusy(false);}
  }
  function confirmDeletePack(pack:KnowStickerPack){
    Alert.alert('Supprimer le pack ?',pack.name,[
      {text:'Annuler',style:'cancel'},
      {text:'Supprimer',style:'destructive',onPress:()=>{
        void deleteKnowStickerPack(pack.id).then(()=>setPackRevision(n=>n+1))
          .catch(()=>setFailure('Impossible de supprimer le pack.'));
      }}
    ]);
  }

  const pack=packs.find(item=>item.key===packKey)??packs[0];
  const emojiResults=useMemo(()=>{
    const query=search.trim().toLocaleLowerCase();
    const glyphFilter=category==='Favoris'?favorites:category==='Récents'?recent:null;
    const selected=EMOJI_CATEGORIES.find(item=>item.name===category);
    return UNICODE_EMOJI_CATALOG.filter(item=>
      (!glyphFilter||glyphFilter.includes(item.glyph))&&
      (!selected||selected.match.test(item.glyph))&&
      (!category||category==='Favoris'||category==='Récents'||
        !UNICODE_EMOJI_GROUPS.includes(category)||item.group===category)&&
      (!query||item.glyph.includes(query)||
        item.name.toLocaleLowerCase().includes(query)||
        (EMOJI_KEYWORDS[item.glyph]??'').includes(query)));
  },[category,favorites,recent,search]);
  useEffect(()=>{setEmojiPageSize(112);},[category,search,tab]);
  const stickerResults=useMemo(()=>{
    const query=search.trim().toLocaleLowerCase();
    return (pack?.stickers??[]).filter(item=>(category!=='Favoris'||favorites.includes(item.glyph))&&
      (category!=='Récents'||recent.includes(item.glyph))&&
      (!query||item.label.toLocaleLowerCase().includes(query)||
      item.accessibilityLabel.toLocaleLowerCase().includes(query)));
  },[search,pack,category,recent,favorites]);

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
  async function sendImageSticker(asset:MediaAsset){
    if(busy)return;
    setBusy(true);setFailure('');
    try {
      const message=await apiFetch<T>(`/conversations/${encodeURIComponent(conversationId)}/media-messages`,{
        method:'POST',body:JSON.stringify({assetId:asset.id,kind:'STICKER_IMAGE'})
      });
      onSent(message);
    } catch(error){setFailure(error instanceof Error?error.message:'Sticker indisponible.');}
    finally{setBusy(false);}
  }
  function changeTab(next:ExpressionTab){
    setSearch('');setSearchOpen(false);setCategory(null);setRecentPage(false);
    onChangeTab(next);
  }
  const minHeight=Math.min(345,screenHeight*0.42);
  const maxHeight=Math.min(screenHeight*0.77,720);
  const numberOfColumns=Math.max(4,Math.floor((screenWidth-18)/(tab==='emoji'?55:83)));
  const sectionHeading=category==='Favoris'?'Favoris':category==='Récents'?'Récemment utilisés':'Packs KnowMe';

  return <><View style={[styles.root,{height:expanded?maxHeight:minHeight,backgroundColor:panelBg}]}
      accessibilityLabel="Clavier multimédia KnowMe">
    <View style={styles.grabArea} onStartShouldSetResponder={()=>true}
      onResponderGrant={e=>{dragStartY.current=e.nativeEvent.pageY;}}
      onResponderRelease={e=>{
        const delta=e.nativeEvent.pageY-dragStartY.current;
        if(delta < -35)onExpandedChange(true);
        else if(delta > 35)onExpandedChange(false);
        else onExpandedChange(!expanded);
      }}>
      <View style={styles.grab}/>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.packStrip}
      contentContainerStyle={styles.packStripContent} keyboardShouldPersistTaps="always">
      <Pressable style={[styles.roundTab,recentPage&&styles.selectedTab]}
        onPress={()=>{setRecentPage(true);setCategory('Récents');}}
        accessibilityLabel="Récents"><Text style={[styles.categorySymbol,{color:muted}]}>◷</Text></Pressable>
      <Pressable style={[styles.roundTab,category==='Favoris'&&styles.selectedTab]}
        onPress={()=>{setRecentPage(false);setCategory('Favoris');}}
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
        {label:'🎉',name:'Tous'}
      ]).map(item=><Pressable key={item.name}
        accessibilityLabel={item.name} accessibilityState={{selected:category===item.name}}
        style={styles.filter} onPress={()=>{setCategory(current=>current===item.name?null:item.name);}}>
        <Text style={{fontSize:21,opacity:category===item.name?1:0.65}}>{item.label}</Text>
      </Pressable>)}
      {searchOpen?<Pressable onPress={()=>{setSearch('');setSearchOpen(false);}} accessibilityLabel="Effacer la recherche">
        <KnowMeIcon name="close" size={20} color={muted}/></Pressable>:null}
    </View>
    {failure?<Pressable onPress={()=>{setFailure('');setPacks([]);setRetryToken(value=>value+1);}} style={styles.status}>
      <Text style={{color:'#ffaaa9',fontSize:12}}>{failure} · Réessayer</Text>
    </Pressable>:null}
    {loading?<ActivityIndicator color={activeColor} style={{marginTop:7}}/>:null}
    <ScrollView style={styles.contentScroll} keyboardShouldPersistTaps="always"
      contentContainerStyle={styles.content}>
      {tab==='emoji'? <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{gap:7,alignItems:'center',paddingVertical:5}}>
          <Pressable onPress={()=>setCategory(null)} accessibilityRole="button"
            accessibilityState={{selected:!category}}
            style={[styles.groupChip,!category&&styles.groupSelected]}>
            <Text style={styles.groupLabel}>Tous</Text>
          </Pressable>
          {UNICODE_EMOJI_GROUPS.map(group=><Pressable key={group}
            onPress={()=>setCategory(group)} accessibilityRole="button"
            accessibilityState={{selected:category===group}}
            style={[styles.groupChip,category===group&&styles.groupSelected]}>
            <Text style={styles.groupLabel}>{group}</Text>
          </Pressable>)}
        </ScrollView>
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
          <View style={styles.grid}>{emojiResults.slice(0,emojiPageSize).map((item,i)=>
            <Pressable key={item.glyph+i} style={[styles.emojiTile,{width:(screenWidth-28)/numberOfColumns}]}
              accessibilityRole="button" accessibilityLabel={`Insérer ${item.name}`}
              onPress={()=>chooseEmoji(item.glyph)} onLongPress={()=>toggleFavorite(item.glyph)}>
              <Text style={{fontSize:32,color:textColor}}>{item.glyph}</Text>
            </Pressable>)}</View>
          {emojiResults.length>emojiPageSize?<Pressable accessibilityRole="button"
            onPress={()=>setEmojiPageSize(old=>old+112)}
            style={[styles.importGif,{borderColor:activeColor}]}>
            <Text style={{fontWeight:'700',color:activeColor}}>
              Afficher la suite · {Math.min(emojiPageSize,emojiResults.length)}/{emojiResults.length}
            </Text>
          </Pressable>:null}
        </View>
      </>:tab==='stickers'?<>
        <Pressable accessibilityRole="button" accessibilityLabel="Créer un nouveau pack KnowSticker"
          onPress={()=>setPackCreatorOpen(true)}
          style={[styles.importGif,{borderColor:activeColor,marginTop:7}]}>
          <Text style={{fontWeight:'800',color:activeColor}}>＋ Créer un pack KnowSticker</Text>
        </Pressable>
        {ownPacks.map(owned=><View key={owned.id} style={styles.section}>
          <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
            <Text style={[styles.sectionTitle,{flex:1}]} numberOfLines={1}>
              {owned.name} · {owned.items.length} stickers
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`Renommer le pack ${owned.name}`}
              onPress={()=>openRename('pack',owned)} style={styles.renameAction}>
              <KnowMeIcon name="edit" size={19} color={activeColor}/>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Supprimer le pack ${owned.name}`}
              onPress={()=>confirmDeletePack(owned)} style={styles.renameAction}>
              <KnowMeIcon name="trash" size={19} color={muted}/>
            </Pressable>
          </View>
          <View style={styles.grid}>
            {owned.items.map(item=><Pressable key={item.id}
              disabled={busy} onPress={()=>void sendOwnSticker(item)}
              onLongPress={()=>openRename('sticker',owned,item)}
              accessibilityRole="button"
              accessibilityLabel={`Envoyer ${knowStickerDisplayName(item.name)} ; appui long pour renommer`}
              style={[styles.stickerTile,{width:(screenWidth-28)/Math.max(3,Math.floor((screenWidth-28)/89)),height:96}]}>
              <Image source={{uri:item.uri}} resizeMode="contain"
                style={{width:65,height:65,maxWidth:'100%'}}/>
              <Text style={{color:muted,fontSize:10,maxWidth:'95%'}} numberOfLines={1}>
                {knowStickerDisplayName(item.name)}
              </Text>
            </Pressable>)}
          </View>
        </View>)}
        {savedStickers.length>0?<View style={styles.section}>
          <Text style={styles.sectionTitle}>Stickers récents et enregistrés</Text>
          <View style={styles.grid}>{savedStickers
            .filter(item=>category!=='Favoris'||stickerAssetFavorites.includes(item.id))
            .map(item=>{
              const tileSize=(screenWidth-28)/Math.max(3,Math.floor((screenWidth-28)/89));
              return <View key={item.id} style={[styles.stickerTile,{width:tileSize}]}>
                <ChatMediaAttachment assetId={item.id} kind="STICKER_IMAGE" thumbnailSize={tileSize-8}/>
                <Pressable style={StyleSheet.absoluteFill} disabled={busy}
                  accessibilityRole="button" accessibilityLabel="Envoyer ce sticker"
                  onPress={()=>void sendImageSticker(item)}
                  onLongPress={()=>toggleAssetFavorite(item.id)}/>
                {stickerAssetFavorites.includes(item.id)?<Text pointerEvents="none"
                  style={{position:'absolute',right:1,top:1,color:'#f8d37b',fontSize:11}}>★</Text>:null}
              </View>;
            })}</View>
        </View>:null}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{category||pack?.name||sectionHeading}</Text>
          <View style={styles.grid}>
            {stickerResults.map((sticker,i)=><Pressable key={sticker.key+i}
              disabled={busy} onPress={()=>void sendSticker(sticker)}
              onLongPress={()=>toggleFavorite(sticker.glyph)}
              accessibilityLabel={`Envoyer ${sticker.accessibilityLabel}`}
              style={[styles.stickerTile,{width:(screenWidth-28)/Math.max(3,Math.floor((screenWidth-28)/89))}]}>
              <Text style={{fontSize:34,textAlign:'center',lineHeight:55,color:'#e9edef'}}>{sticker.glyph}</Text>
            </Pressable>)}
          </View>
          {!pack&&!loading?<Text style={styles.hint}>Aucun pack de stickers disponible.</Text>:null}
        </View>
      </>:<>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GIF disponibles dans cette conversation</Text>
          <View style={styles.grid}>{savedGifs.filter(item=>(category!=='Favoris'||gifFavorites.includes(item.id))&&
            (!search.trim()||item.id.includes(search.trim())||
              (item.originalName??'').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))).map(item=>
            <View key={item.id} style={styles.gifTile}>
              <ChatMediaAttachment assetId={item.id} kind="GIF" thumbnailSize={Math.min(150,(screenWidth-35)/2)}/>
              <Pressable disabled={busy} onPress={()=>void sendGif(item)} accessibilityRole="button"
                accessibilityLabel="Envoyer ce GIF" style={[styles.gifSend,{backgroundColor:activeColor}]} onLongPress={()=>toggleGifFavorite(item.id)}>
                <Text style={{color:colors.accentText,fontWeight:'700'}}>Envoyer {gifFavorites.includes(item.id)?'★':''}</Text>
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
  </View>
  <KnowStickerPackCreator visible={packCreatorOpen} onClose={()=>setPackCreatorOpen(false)}
    onCreated={()=>setPackRevision(value=>value+1)}/>
  <Modal visible={Boolean(renameTarget)} transparent animationType="fade"
    onRequestClose={()=>{if(!renameBusy)setRenameTarget(null);}}>
    <View style={styles.renameOverlay}>
      <View style={styles.renameSheet}>
        <Text style={[styles.renameTitle,{color:textColor}]}>
          {renameTarget?.kind==='pack'?'Renommer le pack':'Renommer le sticker'}
        </Text>
        <TextInput value={renameValue} onChangeText={setRenameValue}
          autoFocus maxLength={80} selectTextOnFocus
          accessibilityLabel="Nouveau nom"
          placeholder="Nouveau nom" placeholderTextColor={muted}
          style={[styles.renameInput,{color:textColor,borderColor:muted}]}/>
        {renameError?<Text accessibilityRole="alert" style={{color:'#ff9a9a',fontSize:12}}>{renameError}</Text>:null}
        <View style={styles.renameButtons}>
          <Pressable accessibilityRole="button" disabled={renameBusy}
            onPress={()=>setRenameTarget(null)} style={styles.renameActionButton}>
            <Text style={{color:muted,fontWeight:'700'}}>Annuler</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={renameBusy||!renameValue.trim()}
            onPress={()=>void saveRename()} style={[styles.renameActionButton,{backgroundColor:activeColor}]}>
            <Text style={{color:colors.accentText,fontWeight:'800'}}>
              {renameBusy?'Enregistrement…':'Enregistrer'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>
  </>;
}

const styles=StyleSheet.create({
  root:{width:'100%',overflow:'hidden',borderTopLeftRadius:23,borderTopRightRadius:23},
  groupChip:{paddingHorizontal:12,minHeight:34,backgroundColor:'#33384b',borderRadius:18,
    justifyContent:'center',alignItems:'center'},
  groupSelected:{backgroundColor:'#57648a'},
  groupLabel:{color:'#e4e7f1',fontWeight:'700',fontSize:12},
  grabArea:{height:24,alignItems:'center',justifyContent:'center'},
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
    alignItems:'center',justifyContent:'center'},
  renameAction:{minHeight:44,minWidth:44,alignItems:'center',justifyContent:'center'},
  renameOverlay:{flex:1,backgroundColor:'rgba(0,0,0,.65)',justifyContent:'center',padding:18},
  renameSheet:{backgroundColor:'#242839',padding:20,borderRadius:23,gap:14},
  renameTitle:{fontSize:18,fontWeight:'800'},
  renameInput:{borderWidth:1,borderRadius:13,minHeight:50,paddingHorizontal:13,fontSize:16},
  renameButtons:{flexDirection:'row',gap:10},
  renameActionButton:{minHeight:48,flex:1,alignItems:'center',justifyContent:'center',
    paddingHorizontal:10,borderRadius:14,backgroundColor:'#363b50'}
});
