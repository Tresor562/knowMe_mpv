import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { buildKnowMePublicLink } from '@knowme/link-contract';
import { apiFetch } from './api';
import { KnowMeShareIcon } from './ui/KnowMeShareIcon';
import { useAppearance } from './AppearanceProvider';
import { GlassSurface } from './ui/KnowMeUI';

type Channel = {
  id: string;
  name: string;
  description?: string | null;
  username?: string | null;
  visibility: 'PUBLIC' | 'PRIVATE';
};
type ChannelPost = {id:string;channelId:string;content:string;createdAt:string};
type ChannelPostPage = {items:ChannelPost[];nextCursor:string|null};

/** Direct channel links keep the viewer on the exact post, not a similar one. */
export function LinkedChannelExperience({channelId,postId,onBack}:{
  channelId:string;postId?:string|null;onBack:()=>void;
}) {
  const {colors} = useAppearance();
  const listRef = useRef<FlatList<ChannelPost>>(null);
  const sought = useRef(new Set<string>());
  const [channel,setChannel] = useState<Channel|null>(null);
  const [posts,setPosts] = useState<ChannelPost[]>([]);
  const [cursor,setCursor] = useState<string|null>(null);
  const [loading,setLoading] = useState(true);
  const [loadingOlder,setLoadingOlder] = useState(false);
  const [error,setError] = useState('');
  const [highlighted,setHighlighted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setPosts([]);
    setCursor(null);
    sought.current.clear();
    setHighlighted(false);
    try {
      const [detail,page] = await Promise.all([
        apiFetch<Channel>(`/channels/${encodeURIComponent(channelId)}`),
        apiFetch<ChannelPostPage>(`/channels/${encodeURIComponent(channelId)}/posts`)
      ]);
      setChannel(detail);
      setPosts(page.items);
      setCursor(page.nextCursor);
    } catch {
      setChannel(null);
      setError('Chaîne supprimée, privée ou inaccessible.');
    } finally {
      setLoading(false);
    }
  },[channelId]);

  useEffect(()=>{void load();},[load]);

  const loadMore = useCallback(async () => {
    if(!cursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const page = await apiFetch<ChannelPostPage>(
        `/channels/${encodeURIComponent(channelId)}/posts?cursor=${encodeURIComponent(cursor)}`
      );
      setPosts(current => {
        const known=new Set(current.map(p=>p.id));
        return [...current,...page.items.filter(p=>!known.has(p.id))];
      });
      setCursor(page.nextCursor);
    } catch {
      setError('Impossible de charger les publications anciennes.');
    } finally {
      setLoadingOlder(false);
    }
  },[channelId,cursor,loadingOlder]);

  useEffect(()=>{
    if(!postId||loading||loadingOlder||!channel||highlighted)return;
    const index=posts.findIndex(p=>p.id===postId);
    if(index>=0) {
      setHighlighted(true);
      listRef.current?.scrollToIndex({index,animated:true,viewPosition:0.5});
      return;
    }
    if(cursor && sought.current.size<100 && !sought.current.has(cursor)){
      sought.current.add(cursor);
      void loadMore();
    } else if(!cursor) {
      setError('Cette publication n’existe plus ou n’est pas accessible.');
    }
  },[postId,loading,loadingOlder,channel,highlighted,posts,cursor,loadMore]);

  function share(kind:'channel'|'channel-post',id:string){
    void Share.share({message:buildKnowMePublicLink({kind,id})});
  }

  return <View style={{flex:1,backgroundColor:colors.background,paddingHorizontal:14}}>
    <View style={styles.toolbar}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Retour">
        <Text style={{color:colors.accent,fontSize:16}}>‹ Retour</Text>
      </Pressable>
      <Pressable onPress={()=>void load()} accessibilityRole="button" accessibilityLabel="Actualiser">
        <Text style={{color:colors.accent,fontSize:15}}>Actualiser</Text>
      </Pressable>
    </View>
    {loading?<ActivityIndicator color={colors.accent}/>:null}
    {error?<Text accessibilityRole="alert" style={{color:colors.danger,padding:8}}>{error}</Text>:null}
    {channel && !loading ? <FlatList
      ref={listRef}
      data={posts}
      keyExtractor={p=>p.id}
      contentContainerStyle={{gap:10,paddingBottom:48}}
      onScrollToIndexFailed={info=>listRef.current?.scrollToOffset({
        offset: info.averageItemLength*info.index, animated:true
      })}
      ListHeaderComponent={<GlassSurface strength="soft" borderRadius={22} style={styles.card}>
        <Text style={{color:colors.text,fontWeight:'800',fontSize:22}}>{channel.name}</Text>
        <Text style={{color:colors.muted}}> {channel.username?`@${channel.username}`:channel.visibility==='PRIVATE'?'Chaîne privée':'Chaîne publique'}</Text>
        {channel.description?<Text style={{color:colors.text}}>{channel.description}</Text>:null}
        <Pressable onPress={()=>share('channel',channel.id)} accessibilityRole="button" style={[styles.action,styles.shareAction]}>
          <KnowMeShareIcon size={18} color={colors.accent}/>
          <Text style={{color:colors.accent}}>Partager la chaîne</Text>
        </Pressable>
      </GlassSurface>}
      ListEmptyComponent={<Text style={{color:colors.muted,padding:12}}>Aucune publication.</Text>}
      renderItem={({item})=><GlassSurface strength="soft" borderRadius={20} style={[
        styles.card, postId===item.id && {borderColor:colors.accent,borderWidth:2}
      ]}>
        <Text style={{color:colors.text,fontSize:15,lineHeight:23}}>{item.content}</Text>
        <Text style={{color:colors.muted,fontSize:12}}>{new Date(item.createdAt).toLocaleString()}</Text>
        <Pressable onPress={()=>share('channel-post',item.id)} accessibilityRole="button"
          accessibilityLabel="Partager cette publication" style={[styles.action,styles.shareAction]}>
          <KnowMeShareIcon size={18} color={colors.accent}/>
          <Text style={{color:colors.accent}}>Lien de la publication</Text>
        </Pressable>
      </GlassSurface>}
      ListFooterComponent={cursor?<Pressable onPress={()=>void loadMore()} disabled={loadingOlder} style={styles.action}>
        <Text style={{color:colors.accent}}>{loadingOlder?'Chargement…':'Publications précédentes'}</Text>
      </Pressable>:null}
    />:null}
  </View>;
}
const styles=StyleSheet.create({
 toolbar:{flexDirection:'row',justifyContent:'space-between',paddingVertical:12},
 card:{padding:16,gap:10},
 action:{paddingVertical:9,paddingHorizontal:12,alignSelf:'flex-start'},
 shareAction:{flexDirection:'row',alignItems:'center',gap:7}
});
