import {BadRequestException,Injectable} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';
import {SearchService} from './search.service';

export const DISCOVERY_KINDS=['PROFILE','CHANNEL','POST','CONVERSATION','MESSAGE','CHALLENGE'] as const;
type Kind=typeof DISCOVERY_KINDS[number];
type Item={kind:Kind;id:string;title:string|null;snippet:string;route:string;updatedAt:string};

/**
 * Bounded universal discovery. Reuse SearchService for message/conversation ACLs
 * (including encrypted-at-rest messages), never query Message.content directly.
 * All other entities are either public or explicitly visible to the viewer.
 */
@Injectable()
export class UniversalDiscoveryService {
  constructor(private readonly prisma:PrismaService,private readonly privateSearch:SearchService){}

  async discover(userId:string,rawQuery:string,rawLimit=20,rawCursor?:string,rawKinds?:string){
    const query=rawQuery.trim().slice(0,120);
    const requested=rawKinds?.trim()?Array.from(new Set(rawKinds.split(',').map(x=>x.trim().toUpperCase()))):[...DISCOVERY_KINDS];
    if(!requested.length||requested.some(x=>!DISCOVERY_KINDS.includes(x as Kind)))
      throw new BadRequestException('SEARCH_KIND_INVALID');
    const selected=DISCOVERY_KINDS.filter(k=>requested.includes(k));
    const key=selected.join(',');
    if(query.length<2)return {query,kinds:selected,items:[],nextCursor:null};
    const limit=Math.min(50,Math.max(1,Number.isFinite(rawLimit)?rawLimit:20));
    const normalized=query.toLocaleLowerCase();
    let offset=0;
    if(rawCursor){
      try{
        if(rawCursor.length>512)throw Error();
        const data=JSON.parse(Buffer.from(rawCursor,'base64url').toString('utf8'));
        if(data.v!==1||data.q!==normalized||data.k!==key||
          !Number.isInteger(data.o)||data.o<0||data.o>500)throw Error();
        offset=data.o;
      }catch{throw new BadRequestException('SEARCH_CURSOR_INVALID');}
    }
    const contains={contains:query,mode:'insensitive' as const};
    const privateKinds=selected.filter(k=>k==='MESSAGE'||k==='CONVERSATION'||k==='CHALLENGE');
    const [privatePage,posts,profiles,channels]=await Promise.all([
      privateKinds.length
        ?this.privateSearch.search(userId,query,50,undefined,privateKinds.join(','))
        :Promise.resolve({items:[] as Item[]}),
      selected.includes('POST')?this.prisma.post.findMany({
        where:{content:contains},
        select:{id:true,content:true,updatedAt:true},
        orderBy:{updatedAt:'desc'},take:120
      }):Promise.resolve([]),
      selected.includes('PROFILE')?this.prisma.user.findMany({
        where:{isSuspended:false,OR:[{username:contains},{displayName:contains}]},
        select:{id:true,username:true,displayName:true,bio:true,updatedAt:true},
        orderBy:{updatedAt:'desc'},take:120
      }):Promise.resolve([]),
      selected.includes('CHANNEL')?this.prisma.channel.findMany({
        where:{AND:[
          {OR:[{name:contains},{username:contains},{description:contains}]},
          {OR:[{visibility:'PUBLIC'},{ownerId:userId},{subscriptions:{some:{userId}}}]}
        ]},
        select:{id:true,name:true,username:true,description:true,updatedAt:true},
        orderBy:{updatedAt:'desc'},take:120
      }):Promise.resolve([])
    ]);
    const items:Item[]=[
      ...privatePage.items.map(x=>({kind:x.kind as Kind,id:x.id,title:x.title,
        snippet:x.snippet,route:x.route,updatedAt:x.updatedAt})),
      ...posts.map(x=>({kind:'POST' as const,id:x.id,title:null,
        snippet:x.content.slice(0,180),route:'/posts/'+encodeURIComponent(x.id),
        updatedAt:x.updatedAt.toISOString()})),
      ...profiles.map(x=>({kind:'PROFILE' as const,id:x.id,title:x.displayName,
        snippet:'@'+x.username+(x.bio?' · '+x.bio.slice(0,100):''),
        route:'/profile/'+encodeURIComponent(x.username),
        updatedAt:x.updatedAt.toISOString()})),
      ...channels.map(x=>({kind:'CHANNEL' as const,id:x.id,title:x.name,
        snippet:(x.username?'@'+x.username+' · ':'')+(x.description??x.name).slice(0,100),
        route:'/channels/'+encodeURIComponent(x.id),
        updatedAt:x.updatedAt.toISOString()}))
    ].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||
      (a.kind+':'+a.id).localeCompare(b.kind+':'+b.id));
    const page=items.slice(offset,offset+limit);
    const next=offset+limit<items.length&&offset+limit<=500
      ?Buffer.from(JSON.stringify({v:1,q:normalized,k:key,o:offset+limit})).toString('base64url')
      :null;
    return {query,kinds:selected,items:page,nextCursor:next};
  }
}
