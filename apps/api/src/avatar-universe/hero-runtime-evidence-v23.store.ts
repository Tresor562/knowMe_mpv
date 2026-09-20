import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HERO_RUNTIME_EVIDENCE_SCHEMA, HeroRuntimeEvidenceRecord, HeroRuntimeEvidenceStore } from './hero-runtime-evidence-v22.domain';

type EvidenceRow={schema:string;sessionId:string;sourceEvidenceSha256:string;sessionEvidenceSha256:string;runtimeBundleSha256:string;appVersion:string;commitSha:string;acceptedAtMs:bigint;consumedAtMs:bigint|null;certificationId:string|null};
const toRecord=(row:EvidenceRow):HeroRuntimeEvidenceRecord=>({schema:HERO_RUNTIME_EVIDENCE_SCHEMA,sessionId:row.sessionId,sourceEvidenceSha256:row.sourceEvidenceSha256,sessionEvidenceSha256:row.sessionEvidenceSha256,runtimeBundleSha256:row.runtimeBundleSha256,appVersion:row.appVersion,commitSha:row.commitSha,acceptedAtMs:Number(row.acceptedAtMs),consumedAtMs:row.consumedAtMs===null?null:Number(row.consumedAtMs),certificationId:row.certificationId});

@Injectable()
export class HeroRuntimeEvidencePostgresStore implements HeroRuntimeEvidenceStore{
 constructor(private readonly prisma:PrismaService){}
 private async one(where:'sessionId'|'sourceEvidenceSha256',value:string){
  const column=where==='sessionId'?'"sessionId"':'"sourceEvidenceSha256"';
  const rows=await this.prisma.$queryRawUnsafe<EvidenceRow[]>(`SELECT * FROM "HeroRuntimeEvidence" WHERE ${column} = $1 LIMIT 1`,value);
  return rows[0]?toRecord(rows[0]):null;
 }
 findBySessionId(sessionId:string){return this.one('sessionId',sessionId);}
 findBySourceEvidenceSha256(sha256:string){return this.one('sourceEvidenceSha256',sha256);}
 async append(r:HeroRuntimeEvidenceRecord):Promise<void>{
  const changed=await this.prisma.$executeRawUnsafe(`INSERT INTO "HeroRuntimeEvidence" ("sessionId","schema","sourceEvidenceSha256","sessionEvidenceSha256","runtimeBundleSha256","appVersion","commitSha","acceptedAtMs","consumedAtMs","certificationId") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL,NULL) ON CONFLICT DO NOTHING`,r.sessionId,r.schema,r.sourceEvidenceSha256,r.sessionEvidenceSha256,r.runtimeBundleSha256,r.appVersion,r.commitSha,BigInt(r.acceptedAtMs));
  if(changed!==1)throw new Error('Runtime evidence uniqueness conflict.');
 }
 async consume(sourceEvidenceSha256:string,certificationId:string,consumedAtMs:number):Promise<boolean>{
  const changed=await this.prisma.$executeRawUnsafe(`UPDATE "HeroRuntimeEvidence" SET "consumedAtMs"=$2,"certificationId"=$3 WHERE "sourceEvidenceSha256"=$1 AND "consumedAtMs" IS NULL AND "certificationId" IS NULL`,sourceEvidenceSha256,BigInt(consumedAtMs),certificationId);
  return changed===1;
 }
}
