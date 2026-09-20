import {HeroRuntimeEvidencePostgresStore} from './hero-runtime-evidence-v23.store';
import {HERO_RUNTIME_EVIDENCE_SCHEMA,HeroRuntimeEvidenceRecord} from './hero-runtime-evidence-v22.domain';
import {PrismaService} from '../prisma/prisma.service';

const record:HeroRuntimeEvidenceRecord={schema:HERO_RUNTIME_EVIDENCE_SCHEMA,sessionId:'s1',sourceEvidenceSha256:'a'.repeat(64),sessionEvidenceSha256:'b'.repeat(64),runtimeBundleSha256:'c'.repeat(64),appVersion:'1.0.0',commitSha:'d'.repeat(40),acceptedAtMs:1000,consumedAtMs:null,certificationId:null};
const prisma=(queryRows:unknown[]=[],executeResults:number[]=[1])=>({$queryRawUnsafe:jest.fn().mockResolvedValue(queryRows),$executeRawUnsafe:jest.fn().mockImplementation(async()=>executeResults.shift()??0)}) as unknown as PrismaService;

describe('HeroRuntimeEvidencePostgresStore v23',()=>{
 it('hydrates BIGINT timestamps without exposing database values',async()=>{const db=prisma([{...record,acceptedAtMs:1000n,consumedAtMs:1200n,certificationId:'cert-1'}]);const store=new HeroRuntimeEvidencePostgresStore(db);expect(await store.findBySessionId('s1')).toEqual({...record,consumedAtMs:1200,certificationId:'cert-1'});expect((db.$queryRawUnsafe as jest.Mock).mock.calls[0][0]).toContain('"sessionId" = $1');});
 it('fails closed when a concurrent insert wins either unique constraint',async()=>{const db=prisma([], [0]);const store=new HeroRuntimeEvidencePostgresStore(db);await expect(store.append(record)).rejects.toThrow(/uniqueness conflict/);});
 it('uses a database compare-and-set for one-shot consumption',async()=>{const db=prisma([], [1,0]);const store=new HeroRuntimeEvidencePostgresStore(db);await expect(store.consume(record.sourceEvidenceSha256,'cert-1',1100)).resolves.toBe(true);await expect(store.consume(record.sourceEvidenceSha256,'cert-2',1200)).resolves.toBe(false);const sql=(db.$executeRawUnsafe as jest.Mock).mock.calls[0][0] as string;expect(sql).toContain('"consumedAtMs" IS NULL');expect(sql).toContain('"certificationId" IS NULL');});
 it('parameterizes caller-controlled values',async()=>{const db=prisma([], [1]);const store=new HeroRuntimeEvidencePostgresStore(db);await store.consume("x'; DROP TABLE users; --",'cert-x',1100);const call=(db.$executeRawUnsafe as jest.Mock).mock.calls[0];expect(call[0]).not.toContain('DROP TABLE');expect(call[1]).toContain('DROP TABLE');});
});
