import { KNOWME_SHARE_PATH } from '../../components/KnowMeShareIcon';

type Name='heart'|'comment'|'share'|'bookmark'|'search'|'profile'|'back'|'smile';

/** Each SVG uses one path with several optional subpaths. This avoids
 * cross-version ReactElement/ReactNode inference for JSX fragment children. */
const REEL_GLYPHS:Record<Name,string>={
  heart:'M20.7 4.5a5.4 5.4 0 0 0-7.65 0L12 5.55l-1.05-1.05a5.4 5.4 0 0 0-7.65 7.65L12 20.8l8.7-8.65a5.4 5.4 0 0 0 0-7.65Z',
  comment:'M20.5 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-3.5-.7L3 21l1.8-5.2A8.5 8.5 0 1 1 20.5 11.5Z',
  share:KNOWME_SHARE_PATH,
  bookmark:'M6 3.5h12v17l-6-4-6 4z',
  search:'M17.4 10.8a6.6 6.6 0 1 1-13.2 0a6.6 6.6 0 1 1 13.2 0 M16 16l5 5',
  profile:'M15.4 8a3.4 3.4 0 1 1-6.8 0a3.4 3.4 0 1 1 6.8 0 M5 21c0-4 2.7-6.5 7-6.5S19 17 19 21 M22 12a10 10 0 1 1-20 0a10 10 0 1 1 20 0',
  back:'m15 4-8 8 8 8',
  smile:'M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0 M8 14.5c1.6 2.3 6.4 2.3 8 0 M9 9h.01 M15 9h.01'
};
export function ReelIcon({name,filled=false,size=28}:{
  name:Name;filled?:boolean;size?:number;
}){
  return <svg viewBox="0 0 24 24" width={size} height={size}
    fill={name==='share'||filled?'currentColor':'none'} stroke={name==='share'?'none':'currentColor'} strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d={REEL_GLYPHS[name]}/>
  </svg>;
}
