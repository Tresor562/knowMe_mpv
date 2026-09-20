import {createHash} from 'node:crypto';
import {HeroAndroidSourceResult} from './hero-runtime-android-source-v21.domain';

export const HERO_RUNTIME_EVIDENCE_SCHEMA='knowme.hero.runtime.evidence.v22' as const;
export type HeroRuntimeEvidenceRecord={schema:typeof HERO_RUNTIME_EVIDENCE_SCHEMA;sessionId:string;sourceEvidenceSha256:string;sessionEvidenceSha256:string;runtimeBundleSha256:string;appVersion:string;commitSha:string;acceptedAtMs:number;consumedAtMs:number|null;certificationId:string|null};
export type HeroRuntimeEvidenceStore={findBySessionId(sessionId:string):Promise<HeroRuntimeEvidenceRecord|null>;findBySourceEvidenceSha256(sha256:string):Promise<HeroRuntimeEvidenceRecord|null>;append(record:HeroRuntimeEvidenceRecord):Promise<void>;consume(sourceEvidenceSha256:string,certificationId:string,consumedAtMs:number):Promise<boolean>};
const SHA256=/^[a-f0-9]{64}$/;
const SHA1=/^[a-f0-9]{40}$/;
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value));
const canonical=(value:unknown):string=>{if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;const object=value as Record<string,unknown>;return `{${Object.keys(object).sort().map(key=>`${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;};
const assertDigest=(name:string,value:string)=>{if(!SHA256.test(value))throw new Error(`${name} must be a lowercase SHA-256 digest.`);};

export class HeroRuntimeEvidenceAuthority{
 constructor(private readonly store:HeroRuntimeEvidenceStore,private readonly clock:()=>number=Date.now){}
 async accept(result:HeroAndroidSourceResult):Promise<HeroRuntimeEvidenceRecord>{
  const identity=result.identity;const build=identity.build;
  if(identity.sessionId.trim()==='')throw new Error('Runtime evidence session id is required.');
  assertDigest('Runtime source evidence',result.sourceEvidenceSha256);assertDigest('Runtime session evidence',result.evidenceSha256);assertDigest('Runtime bundle',build.runtimeBundleSha256);
  if(!SHA1.test(build.commitSha))throw new Error('Runtime evidence commit SHA must be a lowercase 40-character git SHA.');
  const bySession=await this.store.findBySessionId(identity.sessionId);if(bySession){if(bySession.sourceEvidenceSha256===result.sourceEvidenceSha256)return clone(bySession);throw new Error('Runtime evidence session id is already bound to different evidence.');}
  const byDigest=await this.store.findBySourceEvidenceSha256(result.sourceEvidenceSha256);if(byDigest){if(byDigest.sessionId===identity.sessionId)return clone(byDigest);throw new Error('Runtime source evidence digest is already bound to another session.');}
  const acceptedAtMs=this.clock();if(!Number.isFinite(acceptedAtMs)||acceptedAtMs<result.endedAtMs)throw new Error('Runtime evidence acceptance timestamp is invalid.');
  const record:HeroRuntimeEvidenceRecord={schema:HERO_RUNTIME_EVIDENCE_SCHEMA,sessionId:identity.sessionId,sourceEvidenceSha256:result.sourceEvidenceSha256,sessionEvidenceSha256:result.evidenceSha256,runtimeBundleSha256:build.runtimeBundleSha256,appVersion:build.appVersion,commitSha:build.commitSha,acceptedAtMs,consumedAtMs:null,certificationId:null};
  await this.store.append(clone(record));return clone(record);
 }
 async consume(sourceEvidenceSha256:string,runtimeBundleSha256:string,certificationId:string):Promise<HeroRuntimeEvidenceRecord>{
  assertDigest('Runtime source evidence',sourceEvidenceSha256);assertDigest('Runtime bundle',runtimeBundleSha256);if(!certificationId.trim())throw new Error('Runtime certification id is required.');
  const record=await this.store.findBySourceEvidenceSha256(sourceEvidenceSha256);if(!record)throw new Error('Runtime evidence was not accepted.');
  if(record.runtimeBundleSha256!==runtimeBundleSha256)throw new Error('Runtime evidence belongs to another Hero bundle.');
  if(record.consumedAtMs!==null||record.certificationId!==null)throw new Error('Runtime evidence has already been consumed.');
  const consumedAtMs=this.clock();if(!Number.isFinite(consumedAtMs)||consumedAtMs<record.acceptedAtMs)throw new Error('Runtime evidence consumption timestamp is invalid.');
  if(!await this.store.consume(sourceEvidenceSha256,certificationId,consumedAtMs))throw new Error('Runtime evidence was consumed concurrently.');
  return {...clone(record),consumedAtMs,certificationId};
 }
 auditDigest(record:HeroRuntimeEvidenceRecord):string{return createHash('sha256').update(canonical(record)).digest('hex');}
}
