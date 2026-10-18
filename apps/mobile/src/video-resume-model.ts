/** Local, bounded watch-resume hints; public video IDs only. No account tokens. */
export type VideoResume = {id:string;positionMs:number;durationMs:number;updatedAt:number};
const LIMIT=80;
const VALID_ID=/^[a-zA-Z0-9_-]{1,128}$/;

/** Avoid near-start and nearly-complete prompts; accept many-hour videos. */
export function resumablePosition(positionMs:number,durationMs:number):number|null{
  if(!Number.isFinite(positionMs)||!Number.isFinite(durationMs)||durationMs<=0)return null;
  const current=Math.floor(Math.max(0,positionMs));
  const duration=Math.floor(durationMs);
  if(current<30_000||current>=duration-15_000||current>=duration*0.95)return null;
  return current;
}
export function safeVideoResumes(raw:unknown):VideoResume[]{
  if(!Array.isArray(raw))return [];
  const ids=new Set<string>();
  const cleaned:VideoResume[]=[];
  for(const row of raw){
    if(!row||typeof row!=='object')continue;
    const record=row as Partial<VideoResume>;
    if(typeof record.id!=='string'||!VALID_ID.test(record.id)||ids.has(record.id))continue;
    const position=resumablePosition(record.positionMs??NaN,record.durationMs??NaN);
    if(position===null||typeof record.updatedAt!=='number'||!Number.isSafeInteger(record.updatedAt))continue;
    ids.add(record.id);
    cleaned.push({id:record.id,positionMs:position,durationMs:record.durationMs!,updatedAt:record.updatedAt!});
  }
  return cleaned.sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,LIMIT);
}

/** Successful replay is kept only after 30 seconds; completion removes it. */
export function nextVideoResumes(
  entries:VideoResume[],id:string,positionMs:number,durationMs:number,now:number
):VideoResume[]{
  const known=safeVideoResumes(entries);
  if(!VALID_ID.test(id)||!Number.isFinite(now))return known;
  if(!Number.isFinite(durationMs)||durationMs<=0||!Number.isFinite(positionMs))return known;
  const at=Math.max(0,Math.floor(positionMs));
  const previous=known.filter(entry=>entry.id!==id);
  if(at>=durationMs-15_000||at>=durationMs*0.95)return previous;
  const resume=resumablePosition(at,durationMs);
  if(resume===null)return known;
  return safeVideoResumes([{id,positionMs:resume,durationMs,updatedAt:Math.floor(now)},...previous]);
}
