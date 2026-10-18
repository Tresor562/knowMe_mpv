/** State-only assignment logic. Persist to GitHub with blob-SHA compare-and-swap. */
export const ORDER = Object.freeze(['messaging','social','reels','profiles','marketplace','infra','design']);
const allowed = new Set(['free','active','paused','completed']);
function valid(s) {
  if(s?.schemaVersion!==1 || !s.domains || ORDER.some(id=>!allowed.has(s.domains[id]?.status)))
    throw Error('Invalid workstream registry');
}
function instant(time) {
  const n = new Date(time).getTime();
  if(!Number.isFinite(n)) throw Error('Invalid timestamp');
  return new Date(n).toISOString();
}
function ownerValid(ref) {
  if(!/^session-[a-zA-Z0-9-]{8,120}$/.test(ref||'')) throw Error('Unique ownerRef required');
}
export function snapshot(s) {
  valid(s);
  return {
    active:ORDER.filter(id=>s.domains[id].status==='active'),
    paused:ORDER.filter(id=>s.domains[id].status==='paused'),
    free:ORDER.filter(id=>['free','completed'].includes(s.domains[id].status)),
  };
}
export function choose(s, ownerRef, now=new Date(), verifiedStale=[]) {
  valid(s);
  const same=ORDER.find(id=>s.domains[id].ownerRef===ownerRef &&
    ['active','paused'].includes(s.domains[id].status));
  if(same) return {id:same,reason:'same-session'};
  const unused=ORDER.find(id=>['free','completed'].includes(s.domains[id].status));
  if(unused) return {id:unused,reason:'free'};
  const paused=ORDER.filter(id=>s.domains[id].status==='paused')
    .sort((a,b)=>Date.parse(s.domains[a].updatedAt||'1970-01-01')-
                 Date.parse(s.domains[b].updatedAt||'1970-01-01'));
  if(paused.length) return {id:paused[0],reason:'resume-paused'};
  const t=Date.parse(instant(now)),threshold=24*60*60*1000;
  const stale=ORDER.find(id=>s.domains[id].status==='active' &&
    verifiedStale.includes(id) &&
    Number.isFinite(Date.parse(s.domains[id].updatedAt)) &&
    t-Date.parse(s.domains[id].updatedAt)>=threshold);
  return stale?{id:stale,reason:'verified-stale'}:null;
}
export function claim(s, ownerRef, now=new Date(), verifiedStale=[]) {
  ownerValid(ownerRef);
  const pick=choose(s,ownerRef,now,verifiedStale);
  if(!pick) throw Error('No safely available workstream');
  const next=structuredClone(s), prev=next.domains[pick.id];
  const same=pick.reason==='same-session', at=instant(now);
  next.domains[pick.id]={
    ...prev,
    status:'active',ownerRef,updatedAt:at,
    claimedAt:same?prev.claimedAt:at,
    resumeFrom:same?prev.resumeFrom:(prev.ownerRef?{
      ownerRef:prev.ownerRef,branch:prev.branch,task:prev.task,lastPr:prev.lastPr
    }:null),
    branch:same?prev.branch:null,task:same?prev.task:null,lastPr:same?prev.lastPr:null,
  };
  next.history=[...(next.history||[]),{at,event:same?'touch':'claim',domain:pick.id,ownerRef,reason:pick.reason}].slice(-40);
  return {state:next,domain:pick.id,reason:pick.reason};
}
export function transition(s,{ownerRef,action,now=new Date(),branch,task,lastPr}) {
  valid(s);ownerValid(ownerRef);
  if(!['touch','pause','complete'].includes(action)) throw Error('Invalid action');
  const id=ORDER.find(id=>s.domains[id].ownerRef===ownerRef &&
    ['active','paused'].includes(s.domains[id].status));
  if(!id) throw Error('Session does not own a workstream');
  const next=structuredClone(s), d=next.domains[id], at=instant(now);
  if(branch!==undefined) d.branch=branch;
  if(task!==undefined) d.task=task;
  if(lastPr!==undefined) d.lastPr=lastPr;
  d.updatedAt=at;
  d.status=action==='complete'?'completed':action==='pause'?'paused':'active';
  if(action==='complete')d.ownerRef=null;
  next.history=[...(next.history||[]),{at,event:action,domain:id,ownerRef}].slice(-40);
  return {state:next,domain:id,reason:action};
}
