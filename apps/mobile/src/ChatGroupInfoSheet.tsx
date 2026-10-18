import {useEffect,useState} from 'react';
import {ActivityIndicator,Image,Modal,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {apiFetch} from './api';
import {useAppearance} from './AppearanceProvider';
import {KnowMeIcon} from './ui/KnowMeUI';
import {KnowMeAlert as Alert} from './ui/KnowMeFeedback';

type Role='OWNER'|'ADMIN'|'MEMBER';
type Member={userId:string;role:Role;user:{id:string;username:string;displayName:string;avatarUrl?:string|null}};
type Group={id:string;title:string|null;description:string|null;viewerRole:Role;members:Member[];memberCount:number};
type Friend={user:{id:string;username:string;displayName:string}};
export function ChatGroupInfoSheet({conversationId,visible,viewerId,onClose,onChanged,onLeft}:{
 conversationId:string;visible:boolean;viewerId:string;onClose:()=>void;onChanged?:()=>void;onLeft?:()=>void;
}){
 const {colors}=useAppearance();
 const [group,setGroup]=useState<Group|null>(null);
 const [friends,setFriends]=useState<Friend[]>([]);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 const [editing,setEditing]=useState(false);
 const [adding,setAdding]=useState(false);
 const [title,setTitle]=useState('');
 const [description,setDescription]=useState('');
 const [search,setSearch]=useState('');
 async function load(){
   setLoading(true);setError('');
   try{
     const data=await apiFetch<Group>(`/conversations/${encodeURIComponent(conversationId)}/group`);
     setGroup(data);setTitle(data.title??'');setDescription(data.description??'');
     if(data.viewerRole!=='MEMBER'){
       const list=await apiFetch<Friend[]>('/social/friends');
       setFriends(Array.isArray(list)?list:[]);
     }
   }catch(cause){setError(cause instanceof Error?cause.message:'Groupe inaccessible.');}
   finally{setLoading(false);}
 }
 useEffect(()=>{if(visible)void load();else{setGroup(null);setEditing(false);setAdding(false);}},[visible,conversationId]);
 async function modify(task:()=>Promise<unknown>,leave=false){
   if(busy)return;
   setBusy(true);setError('');
   try{
     await task();
     if(leave){onLeft?.();onClose();}
     else {await load();onChanged?.();}
   }catch(cause){setError(cause instanceof Error?cause.message:'Action impossible.');}
   finally{setBusy(false);}
 }
 const canManage=group?.viewerRole==='OWNER'||group?.viewerRole==='ADMIN';
 const eligible=friends.filter(({user})=>!group?.members.some(member=>member.userId===user.id)&&
   (user.displayName+' '+user.username).toLowerCase().includes(search.toLowerCase()));
 function confirmMember(member:Member){
   if(!group||member.role==='OWNER')return;
   const own=member.userId===viewerId;
   const canRemove=own||group.viewerRole==='OWNER'||(group.viewerRole==='ADMIN'&&member.role==='MEMBER');
   const actions=[
     ...(group.viewerRole==='OWNER'&&!own?[{text:member.role==='ADMIN'?'Retirer admin':'Nommer admin',
       onPress:()=>void modify(()=>apiFetch(`/conversations/${conversationId}/group/members/${encodeURIComponent(member.userId)}/role`,
         {method:'PATCH',body:JSON.stringify({role:member.role==='ADMIN'?'MEMBER':'ADMIN'})}))}]:[]),
     ...(canRemove?[{text:own?'Quitter':'Retirer',style:'destructive' as const,
       onPress:()=>void modify(()=>apiFetch(`/conversations/${conversationId}/group/members/${encodeURIComponent(member.userId)}`,
         {method:'DELETE'}),own)}]:[]),
     {text:'Annuler',style:'cancel' as const}
   ];
   Alert.alert(member.user.displayName,'Actions sur le membre',actions);
 }
 return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
   <View style={styles.backdrop}>
     <View style={[styles.sheet,{backgroundColor:colors.surface}]}>
       <View style={styles.heading}>
         <Pressable accessibilityRole="button" accessibilityLabel="Retour à la conversation"
           onPress={onClose} style={styles.hit}><KnowMeIcon name="back" size={23} color={colors.text}/></Pressable>
         <Text style={[styles.title,{color:colors.text}]}>Informations du groupe</Text>
         <Pressable accessibilityRole="button" accessibilityLabel="Actualiser les informations"
           onPress={()=>void load()} style={styles.hit}><KnowMeIcon name="refresh" size={22} color={colors.text}/></Pressable>
       </View>
       {loading&&<ActivityIndicator color={colors.accent}/>}
       {error?<Text accessibilityRole="alert" style={{color:colors.danger,fontSize:12}}>{error}</Text>:null}
       {group&&<ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
         <View style={[styles.groupAvatar,{backgroundColor:colors.backgroundAccent}]}>
           <Text style={{fontSize:35,color:colors.accent,fontWeight:'700'}}>{(group.title||'G')[0]?.toUpperCase()}</Text>
         </View>
         <Text style={[styles.groupName,{color:colors.text}]}>{group.title||'Groupe sans nom'}</Text>
         <Text style={[styles.details,{color:colors.muted}]}>{group.memberCount} membres · {
           group.viewerRole==='OWNER'?'Propriétaire':group.viewerRole==='ADMIN'?'Administrateur':'Membre'}</Text>
         {group.description?<Text style={{color:colors.muted,textAlign:'center'}}>{group.description}</Text>:null}
         {canManage&&<View style={styles.actions}>
           <Pressable accessibilityRole="button" style={styles.action} onPress={()=>setEditing(v=>!v)}>
             <Text style={{color:colors.accent,fontWeight:'700'}}>Modifier nom et description</Text>
           </Pressable>
           <Pressable accessibilityRole="button" style={styles.action} onPress={()=>setAdding(v=>!v)}>
             <Text style={{color:colors.accent,fontWeight:'700'}}>Ajouter des membres</Text>
           </Pressable>
         </View>}
         {editing&&canManage&&<View style={styles.form}>
           <TextInput value={title} onChangeText={setTitle} maxLength={90}
             placeholder="Nom du groupe" placeholderTextColor={colors.muted}
             accessibilityLabel="Nom du groupe" style={[styles.input,{borderColor:colors.border,color:colors.text}]}/>
           <TextInput value={description} onChangeText={setDescription} multiline maxLength={512}
             placeholder="Description du groupe" placeholderTextColor={colors.muted}
             accessibilityLabel="Description du groupe" style={[styles.input,{borderColor:colors.border,color:colors.text}]}/>
           <Pressable accessibilityRole="button" disabled={busy||!title.trim()}
             onPress={()=>void modify(()=>apiFetch(`/conversations/${conversationId}/group`,
               {method:'PATCH',body:JSON.stringify({title:title.trim(),description:description.trim()})}))
               .then(()=>setEditing(false))}
             style={[styles.action,{backgroundColor:colors.backgroundAccent}]}>
             <Text style={{color:colors.accent,fontWeight:'800'}}>Enregistrer</Text>
           </Pressable>
         </View>}
         {adding&&canManage&&<View style={styles.form}>
           <TextInput value={search} onChangeText={setSearch}
             placeholder="Rechercher un ami" placeholderTextColor={colors.muted}
             style={[styles.input,{borderColor:colors.border,color:colors.text}]}/>
           {eligible.map(friend=><Pressable accessibilityRole="button" key={friend.user.id}
             disabled={busy} style={styles.member}
             onPress={()=>void modify(()=>apiFetch(`/conversations/${conversationId}/group/members`,
               {method:'POST',body:JSON.stringify({userIds:[friend.user.id]})}))}>
             <Text style={{color:colors.text,flex:1}}>{friend.user.displayName}</Text>
             <Text style={{color:colors.accent}}>Ajouter</Text>
           </Pressable>)}
         </View>}
         <Text style={[styles.sectionTitle,{color:colors.text}]}>Membres · {group.memberCount}</Text>
         {group.members.map(member=><Pressable key={member.userId}
           accessibilityRole="button"
           accessibilityLabel={`${member.user.displayName}, ${member.role}; gérer le membre`}
           onPress={()=>confirmMember(member)} style={styles.member}>
           {member.user.avatarUrl?<Image source={{uri:member.user.avatarUrl}} style={styles.memberAvatar}/>:
            <View style={[styles.memberAvatar,{backgroundColor:colors.backgroundAccent,justifyContent:'center',alignItems:'center'}]}>
              <Text style={{color:colors.accent}}>{member.user.displayName[0]?.toUpperCase()}</Text>
            </View>}
           <View style={{flex:1}}>
             <Text style={{color:colors.text,fontWeight:'700'}}>{member.user.displayName}</Text>
             <Text style={{color:colors.muted,fontSize:11}}>@{member.user.username} · {
               member.role==='OWNER'?'Propriétaire':member.role==='ADMIN'?'Admin':'Membre'}</Text>
           </View>
           <KnowMeIcon name="more-vertical" color={colors.muted} size={20}/>
         </Pressable>)}
         {group.viewerRole==='MEMBER'&&<Pressable style={styles.action}
           onPress={()=>Alert.alert('Quitter le groupe ?','Tu ne recevras plus les messages.',[
             {text:'Annuler',style:'cancel'},
             {text:'Quitter',style:'destructive',onPress:()=>void modify(()=>apiFetch(
               `/conversations/${conversationId}/group/members/${encodeURIComponent(viewerId)}`,
               {method:'DELETE'}),true)}
           ])}>
           <Text style={{color:colors.danger}}>Quitter le groupe</Text>
         </Pressable>}
       </ScrollView>}
     </View>
   </View>
 </Modal>;
}
const styles=StyleSheet.create({
 backdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.55)'},
 sheet:{maxHeight:'94%',minHeight:'60%',borderTopLeftRadius:25,borderTopRightRadius:25,
   paddingHorizontal:14,paddingTop:10,paddingBottom:28},
 heading:{flexDirection:'row',alignItems:'center',gap:9,minHeight:52},
 title:{fontSize:17,fontWeight:'800',flex:1},
 hit:{width:44,height:44,alignItems:'center',justifyContent:'center'},
 content:{alignItems:'stretch',gap:9,paddingBottom:36},
 groupAvatar:{width:76,height:76,borderRadius:38,alignSelf:'center',alignItems:'center',justifyContent:'center'},
 groupName:{textAlign:'center',fontSize:22,fontWeight:'800'},
 details:{fontSize:12,textAlign:'center'},
 actions:{flexDirection:'row',gap:8,flexWrap:'wrap'},
 action:{minHeight:46,justifyContent:'center',alignItems:'center',paddingHorizontal:12},
 form:{gap:10},
 input:{borderWidth:1,minHeight:48,borderRadius:13,paddingHorizontal:12,paddingVertical:9},
 sectionTitle:{fontWeight:'800',fontSize:16,marginTop:12},
 member:{flexDirection:'row',alignItems:'center',minHeight:52,gap:10,paddingHorizontal:4},
 memberAvatar:{width:42,height:42,borderRadius:21}
});
