import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Share, ScrollView, Text, View } from 'react-native';
import { buildKnowMePublicLink } from '@knowme/link-contract';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';
import { GlassSurface } from './ui/KnowMeUI';
import { MobileSocialGiftInboxItem, MobileSocialGiftPage, markMobileSocialGiftViewed } from './social-gifts';

/** A direct link never reveals another user's gift; each page uses the authenticated inbox. */
export function LinkedGiftExperience({giftId,onBack}:{giftId:string;onBack:()=>void}) {
  const {colors}=useAppearance();
  const [gift,setGift]=useState<MobileSocialGiftInboxItem|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [marking,setMarking]=useState(false);

  useEffect(() => {
    let active = true;
    setGift(null);
    setError('');
    setLoading(true);
    void (async () => {
      try {
        let cursor:string|null=null;
        const seen=new Set<string>();
        for(let pageIndex=0;pageIndex<100;pageIndex++) {
          const query=new URLSearchParams({limit:'30'});
          if(cursor)query.set('cursor',cursor);
          const result=await apiFetch<MobileSocialGiftPage<MobileSocialGiftInboxItem>>(
            `/social/gifts/inbox?${query.toString()}`
          );
          if(!active)return;
          const found=result.items.find(item=>item.id===giftId);
          if(found){setGift(found);return;}
          if(!result.nextCursor||seen.has(result.nextCursor))break;
          seen.add(result.nextCursor);
          cursor=result.nextCursor;
        }
        if(active)setError('Cadeau introuvable ou inaccessible.');
      } catch {
        if(active)setError('Impossible d’ouvrir ce cadeau.');
      } finally {
        if(active)setLoading(false);
      }
    })();
    return () => {active=false;};
  },[giftId]);

  async function markViewed(){
    if(!gift||gift.viewedAt||marking)return;
    setMarking(true);
    try {
      const result=await markMobileSocialGiftViewed(gift.id);
      setGift(current=>current?{...current,viewedAt:result.viewedAt}:current);
    } catch {setError('Impossible de marquer le cadeau comme vu.');}
    finally {setMarking(false);}
  }

  return <View style={{flex:1,backgroundColor:colors.background,padding:16}}>
    <Pressable accessibilityRole="button" onPress={onBack} style={{paddingVertical:10}}>
      <Text style={{color:colors.accent,fontSize:16}}>‹ Retour</Text>
    </Pressable>
    {loading?<ActivityIndicator color={colors.accent}/>:null}
    {error?<Text accessibilityRole="alert" style={{color:colors.danger}}>{error}</Text>:null}
    {gift&&!loading?<ScrollView contentContainerStyle={{gap:14,paddingBottom:28}}>
      <GlassSurface strength="medium" borderRadius={26} style={{padding:20,gap:13}}>
        <Text style={{fontSize:72,textAlign:'center'}}>{gift.gift.emoji}</Text>
        <Text style={{fontSize:24,fontWeight:'800',textAlign:'center',color:colors.text}}>{gift.gift.name}</Text>
        <Text style={{color:colors.muted,textAlign:'center'}}>Offert par {gift.sender?.displayName??'un utilisateur KnowMe'}</Text>
        {gift.message?<Text style={{color:colors.text,fontSize:16,textAlign:'center'}}>{gift.message}</Text>:null}
        <Text style={{color:colors.muted,textAlign:'center'}}>{new Date(gift.sentAt).toLocaleString()}</Text>
        <Pressable accessibilityRole="button" onPress={()=>{void Share.share({message:buildKnowMePublicLink({kind:'gift',id:gift.id})});}}
          style={{borderRadius:16,backgroundColor:colors.backgroundAccent,padding:14}}>
          <Text style={{color:colors.accent,textAlign:'center'}}>↗ Partager le lien privé</Text>
        </Pressable>
        {!gift.viewedAt?<Pressable accessibilityRole="button" disabled={marking} onPress={()=>void markViewed()}
          style={{borderRadius:16,backgroundColor:colors.backgroundAccent,padding:14}}>
          <Text style={{color:colors.text,textAlign:'center'}}>{marking?'Ouverture…':'Marquer comme vu'}</Text>
        </Pressable>:null}
      </GlassSurface>
    </ScrollView>:null}
  </View>;
}
