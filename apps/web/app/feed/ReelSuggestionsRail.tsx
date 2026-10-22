'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { VideoStill } from '../../components/video-still';
import { apiFetch } from '../../lib/api';
import './reel-suggestions.css';

type Media={url:string;mimeType:string;position:number};
type VideoPost={
  id:string;
  author:{displayName:string;username:string};
  media?:Media[];
};
type ReelPreview={id:string;postId:string;position:number;url:string;creator:string};

function videoSrc(value:string){
  if(/^\/media\/public\/post\/[A-Za-z0-9_-]+$/.test(value))return '/api/knowme'+value;
  return '';
}
function reelsFromPosts(posts:VideoPost[]):ReelPreview[]{
  const seen=new Set<string>();
  const result:ReelPreview[]=[];
  for(const post of posts){
    for(const media of post.media??[]){
      if(media.mimeType!=='video/mp4'||!videoSrc(media.url))continue;
      const id=post.id+':'+media.position;
      if(seen.has(id))continue;
      seen.add(id);
      result.push({id,postId:post.id,position:media.position,url:videoSrc(media.url),
        creator:post.author?.displayName||post.author?.username||'KnowMe'});
    }
  }
  return result.slice(0,12);
}

function ReelThumbnail({url}:{url:string}) {
  return <VideoStill src={url} className="km-feed-reel-still" />;
}

/** Independent recommendation unit. The host feed decides where it appears. */
export function ReelSuggestionsRail({en}:{en:boolean}){
  const [items,setItems]=useState<ReelPreview[]>([]);
  useEffect(()=>{
    let active=true;
    void apiFetch<VideoPost[]>('/posts/videos')
      .then(posts=>{if(active)setItems(Array.isArray(posts)?reelsFromPosts(posts):[]);})
      .catch(()=>{if(active)setItems([]);});
    return()=>{active=false;};
  },[]);
  if(!items.length)return null;
  return (
    <aside className="km-feed-reel-recommendations" aria-label={en?'Suggested Reels':'Suggestions de réels'}>
      <div className="km-feed-reel-heading">
        <h2><svg viewBox="0 0 24 24" aria-hidden="true" width="24" height="24" fill="none"
            stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="4"/>
          <path d="m10 8 6 4-6 4z"/>
        </svg>Reels · Vidéos</h2>
        <Link href="/reels">{en?'See all':'Voir tout'} <span aria-hidden="true">›</span></Link>
      </div>
      <div className="km-feed-reel-rail" role="list">
        {items.map(item=>(
          <div role="listitem" className="km-feed-reel-card" key={item.id}>
            <Link className="km-feed-reel-card-link"
              href={`/reels?post=${encodeURIComponent(item.postId)}&position=${encodeURIComponent(item.position)}`}
              aria-label={(en?'Watch Reel by ':'Regarder le réel de ')+item.creator}>
              <ReelThumbnail url={item.url}/>
              <span className="km-feed-reel-play" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
                  <path d="M8 5a1 1 0 0 1 1.5-.85l10 6.5a1.6 1.6 0 0 1 0 2.7l-10 6.5A1 1 0 0 1 8 19z"/>
                </svg>
              </span>
              <span className="km-feed-reel-author">{item.creator}</span>
            </Link>
          </div>
        ))}
      </div>
    </aside>
  );
}
