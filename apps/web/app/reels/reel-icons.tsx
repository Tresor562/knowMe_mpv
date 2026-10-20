type Name='heart'|'comment'|'share'|'bookmark'|'search'|'profile'|'back'|'smile';
export function ReelIcon({name,filled=false,size=28}:{
  name:Name;filled?:boolean;size?:number;
}){
  let body=<path/>;
  switch(name){
    case 'heart':body=<path d="M20.7 4.5a5.4 5.4 0 0 0-7.65 0L12 5.55l-1.05-1.05a5.4 5.4 0 0 0-7.65 7.65L12 20.8l8.7-8.65a5.4 5.4 0 0 0 0-7.65Z"/>;break;
    case 'comment':body=<path d="M20.5 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-3.5-.7L3 21l1.8-5.2A8.5 8.5 0 1 1 20.5 11.5Z"/>;
      break;
    case 'share':body=<><path d="m21 3-9.6 9.6M21 3 3.8 10.7a1 1 0 0 0 .13 1.85l7.47 2.15 2.15 6.05a1 1 0 0 0 1.85.08L21 3Z"/></>;break;
    case 'bookmark':body=<path d="M6 3.5h12v17l-6-4-6 4z"/>;break;
    case 'search':body=<><circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 5 5"/></>;break;
    case 'profile':body=<><circle cx="12" cy="8" r="3.4"/><path d="M5 21c0-4 2.7-6.5 7-6.5S19 17 19 21"/><circle cx="12" cy="12" r="10"/></>;break;
    case 'back':body=<path d="m15 4-8 8 8 8"/>;break;
    case 'smile':body=<><circle cx="12" cy="12" r="9"/><path d="M8 14.5c1.6 2.3 6.4 2.3 8 0M9 9h.01M15 9h.01"/></>;break;
  }
  return <svg viewBox="0 0 24 24" width={size} height={size}
    fill={filled?'currentColor':'none'} stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {body}
  </svg>;
}
