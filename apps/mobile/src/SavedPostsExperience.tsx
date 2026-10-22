import {useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Linking,Pressable,Text,View} from 'react-native';
import {buildKnowMeDeepLink} from '@knowme/link-contract';
import {apiFetch} from './api';
import {useAppearance} from './AppearanceProvider';
import {useI18n} from './I18nProvider';
import {KnowMeIcon} from './ui/KnowMeUI';

type SavedPost={postId:string;createdAt:string};

/** Authenticated, server-authoritative bookmarks; never fabricate a saved state. */
export function SavedPostsExperience(){
  const {colors}=useAppearance();
  const {locale}=useI18n();
  const en=locale==='en';
  const [items,setItems]=useState<SavedPost[]>([]);
  const [loading,setLoading]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [error,setError]=useState('');
  const [removing,setRemoving]=useState<string|null>(null);

  const refresh=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const response=await apiFetch<SavedPost[]>('/posts/saved');
      if(!Array.isArray(response))throw Error('Invalid saved posts response');
      setItems(response);setLoaded(true);
    }catch(cause){
      setLoaded(false);
      setError(cause instanceof Error?cause.message:
        (en?'Could not load saved posts.':'Impossible de charger les publications enregistrées.'));
    }finally{setLoading(false);}
  },[en]);
  useEffect(()=>{void refresh();},[refresh]);

  async function openPost(postId:string){
    try{
      await Linking.openURL(buildKnowMeDeepLink({kind:'post',id:postId}));
    }catch{
      setError(en?'Unable to open this post.':'Impossible d’ouvrir cette publication.');
    }
  }

  async function remove(postId:string){
    setRemoving(postId);setError('');
    try{
      await apiFetch('/posts/'+encodeURIComponent(postId)+'/save',{method:'DELETE'});
      setItems(old=>old.filter(item=>item.postId!==postId));
    }catch(cause){
      setError(cause instanceof Error?cause.message:
        (en?'Unable to remove saved post.':'Impossible de retirer la publication.'));
    }finally{setRemoving(null);}
  }

  return <View style={{gap:12,paddingBottom:16}}>
    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10}}>
      <Text style={{color:colors.muted,flex:1,fontSize:13}}>
        {en?'Private posts saved to your account.':'Publications enregistrées en privé sur ton compte.'}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={en?'Refresh saved posts':'Actualiser les publications enregistrées'}
        onPress={()=>void refresh()} disabled={loading}
        style={{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'}}>
        <KnowMeIcon name="refresh" size={23} color={colors.accent}/>
      </Pressable>
    </View>
    {loading&&<ActivityIndicator color={colors.accent}/>}
    {Boolean(error)&&<Text accessibilityRole="alert" style={{color:colors.danger,fontSize:13}}>{error}</Text>}
    {loaded&&!loading&&items.length===0&&<Text style={{color:colors.muted,paddingVertical:24,lineHeight:20}}>
      {en?'Nothing here yet. Tap Save beneath a post.':'Rien ici pour le moment. Appuie sur Enregistrer sous une publication.'}
    </Text>}
    {items.map(item=><View key={item.postId} style={{borderRadius:18,padding:12,
      backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,gap:9}}>
      <Text style={{fontSize:15,fontWeight:'700',color:colors.text}}>
        {en?'Saved post':'Publication enregistrée'}
      </Text>
      <Text style={{color:colors.muted,fontSize:12}}>
        {new Date(item.createdAt).toLocaleDateString(en?'en-US':'fr-FR')}
      </Text>
      <View style={{flexDirection:'row',gap:10,flexWrap:'wrap'}}>
        <Pressable accessibilityRole="button" accessibilityLabel={en?'Open saved post':'Ouvrir la publication'}
          onPress={()=>void openPost(item.postId)} style={{backgroundColor:colors.backgroundAccent,
            paddingHorizontal:15,minHeight:44,justifyContent:'center',borderRadius:22}}>
          <Text style={{color:colors.accent,fontWeight:'700'}}>{en?'Open':'Ouvrir'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={removing===item.postId}
          onPress={()=>void remove(item.postId)}
          style={{paddingHorizontal:15,minHeight:44,justifyContent:'center',borderRadius:22}}>
          <Text style={{color:colors.muted,fontWeight:'700'}}>
            {removing===item.postId?(en?'Removing…':'Retrait…'):(en?'Remove':'Retirer')}
          </Text>
        </Pressable>
      </View>
    </View>)}
  </View>;
}
