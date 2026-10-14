import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { buildKnowMePublicLink } from '@knowme/link-contract';
import { apiFetch } from './api';
import { useAppearance } from './AppearanceProvider';
import { Avatar, GlassSurface } from './ui/KnowMeUI';

type PublicProfile={
 header:{username:string;displayName:string;avatarUrl:string|null;bio:string|null;joinedYear:number|null};
 privacy:{profileLocked:boolean;lockedForViewer:boolean;lockMessage:string|null};
 viewer:{relation:string;owner:boolean};
};

/** Uses the existing public-profile authority: no account secrets or hidden sections. */
export function LinkedProfileExperience({username,onBack}:{username:string;onBack:()=>void}){
 const {colors}=useAppearance();
 const [profile,setProfile]=useState<PublicProfile|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');

 useEffect(()=>{
   let live=true; setLoading(true);setError('');setProfile(null);
   void apiFetch<PublicProfile>(`/profile-experience/public/${encodeURIComponent(username)}`)
     .then(data=>{if(live)setProfile(data);})
     .catch(()=>{if(live)setError('Profil introuvable ou indisponible.');})
     .finally(()=>{if(live)setLoading(false);});
   return ()=>{live=false;};
 },[username]);

 return <View style={{flex:1,backgroundColor:colors.background,padding:16}}>
   <Pressable onPress={onBack} accessibilityRole="button" style={{paddingVertical:10}}>
     <Text style={{color:colors.accent,fontSize:16}}>‹ Retour</Text>
   </Pressable>
   {loading?<ActivityIndicator color={colors.accent}/>:null}
   {error?<Text accessibilityRole="alert" style={{color:colors.danger}}>{error}</Text>:null}
   {profile&&!loading?<ScrollView contentContainerStyle={{paddingBottom:36,gap:14}}>
     <GlassSurface strength="medium" borderRadius={26} style={{padding:20,gap:12,alignItems:'center'}}>
       <Avatar uri={profile.header.avatarUrl} name={profile.header.displayName} size={90}/>
       <Text style={{color:colors.text,fontSize:23,fontWeight:'800',textAlign:'center'}}>{profile.header.displayName}</Text>
       <Text style={{color:colors.accent,fontSize:15}}>@{profile.header.username}</Text>
       {profile.privacy.lockedForViewer
         ? <Text style={{color:colors.muted,textAlign:'center'}}>{profile.privacy.lockMessage??'Profil privé.'}</Text>
         : <>
             {profile.header.bio?<Text style={{color:colors.text,textAlign:'center'}}>{profile.header.bio}</Text>:null}
             {profile.header.joinedYear?<Text style={{color:colors.muted}}>Membre depuis {profile.header.joinedYear}</Text>:null}
           </>}
       <Pressable accessibilityRole="button" onPress={()=>{
         void Share.share({message:buildKnowMePublicLink({kind:'profile',id:profile.header.username})});
       }} style={{borderRadius:16,backgroundColor:colors.backgroundAccent,padding:14}}>
         <Text style={{color:colors.accent}}>↗ Partager le profil</Text>
       </Pressable>
     </GlassSurface>
   </ScrollView>:null}
 </View>;
}
