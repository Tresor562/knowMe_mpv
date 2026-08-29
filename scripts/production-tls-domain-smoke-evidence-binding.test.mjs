import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { createProductionTlsDomainMarketEvidenceItem, validateProductionTlsDomainSmokeArtifact } from './production-tls-domain-smoke-evidence-binding.mjs';

const NOW = new Date('2026-08-27T15:00:00.000Z');
const VALID_UNTIL = '2026-09-27T14:00:00.000Z';
const cliPath = fileURLToPath(new URL('./production-tls-domain-smoke-evidence-binding.mjs', import.meta.url));
function artifact(overrides={}) {
  return {
    schemaVersion:1,
    kind:'knowme-production-tls-domain-smoke',
    status:'PASSED',
    observedAt:'2026-08-27T14:00:00.000Z',
    origin:'https://api.example.com/',
    hostname:'api.example.com',
    port:443,
    minValidityDays:14,
    tls:{
      protocol:'TLSv1.3',
      fingerprintSha256:'a'.repeat(64),
      validFrom:'2026-08-01T00:00:00.000Z',
      validTo:'2026-09-30T14:00:00.000Z',
      remainingValidityDays:34,
    },
    proofBoundary:'TLS/domain transport validation only.',
    ...overrides,
  };
}
function bytes(value=artifact()) { return Buffer.from(`${JSON.stringify(value,null,2)}\n`,'utf8'); }
function cliArgs(artifactPath,outputPath) {
  return [cliPath,'--artifact',artifactPath,'--output',outputPath,'--scope','WEB_V1','--verifier','release-operator','--ref','evidence://knowme/tls-domain/cli','--valid-until',VALID_UNTIL];
}

test('accepts exact passed TLS/domain artifact',()=>{
  assert.deepEqual(validateProductionTlsDomainSmokeArtifact(artifact(),{now:NOW}),{ok:true,verifiedAt:'2026-08-27T14:00:00.000Z'});
});

test('creates production_tls_domain item from exact retained bytes',()=>{
  const retained=Buffer.from(JSON.stringify(artifact()));
  const result=createProductionTlsDomainMarketEvidenceItem(retained,{scope:'WEB_V1',verifier:'release-operator',evidenceRef:'evidence://tls-domain/2026-08-27',validUntil:VALID_UNTIL,now:NOW});
  assert.equal(result.ok,true);
  assert.equal(result.item.id,'production_tls_domain');
  assert.equal(result.item.status,'VERIFIED');
  assert.equal(result.item.verifiedAt,'2026-08-27T14:00:00.000Z');
  assert.match(result.item.evidenceSha256,/^[0-9a-f]{64}$/);
});

test('rejects artifacts with unknown fields even if otherwise plausible',()=>{
  const result=validateProductionTlsDomainSmokeArtifact(artifact({dnsValidated:true}),{now:NOW});
  assert.equal(result.ok,false);
});

test('rejects hostname or port inconsistent with retained origin',()=>{
  assert.equal(validateProductionTlsDomainSmokeArtifact(artifact({hostname:'other.example.com'}),{now:NOW}).ok,false);
  assert.equal(validateProductionTlsDomainSmokeArtifact(artifact({port:8443}),{now:NOW}).ok,false);
});

test('rejects certificate fingerprint and validity inconsistencies',()=>{
  assert.equal(validateProductionTlsDomainSmokeArtifact(artifact({tls:{...artifact().tls,fingerprintSha256:'A'.repeat(64)}}),{now:NOW}).ok,false);
  assert.equal(validateProductionTlsDomainSmokeArtifact(artifact({tls:{...artifact().tls,remainingValidityDays:35}}),{now:NOW}).ok,false);
});

test('rejects retained observation that violates minimum validity policy',()=>{
  const value=artifact({minValidityDays:35});
  assert.equal(validateProductionTlsDomainSmokeArtifact(value,{now:NOW}).ok,false);
});

test('rejects failed, future, malformed, and non-JSON artifacts',()=>{
  assert.equal(validateProductionTlsDomainSmokeArtifact(artifact({status:'FAILED'}),{now:NOW}).ok,false);
  assert.equal(validateProductionTlsDomainSmokeArtifact(artifact({observedAt:'2026-08-28T14:00:00.000Z'}),{now:NOW}).ok,false);
  assert.equal(createProductionTlsDomainMarketEvidenceItem(Buffer.from('{'),{now:NOW}).ok,false);
});

test('CLI creates TLS/domain evidence from a regular retained artifact', async()=>{
  const dir=await mkdtemp(join(tmpdir(),'knowme-tls-domain-binding-'));
  try {
    const artifactPath=join(dir,'tls-domain-smoke.json');
    const outputPath=join(dir,'item.json');
    await writeFile(artifactPath,bytes());
    const result=spawnSync(process.execPath,cliArgs(artifactPath,outputPath),{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const item=JSON.parse(await readFile(outputPath,'utf8'));
    assert.equal(item.id,'production_tls_domain');
    assert.equal(item.status,'VERIFIED');
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test('CLI rejects a symlinked TLS/domain retained artifact before JSON ingestion', async(t)=>{
  if (process.platform==='win32') { t.skip('Symlink creation is not reliably available on Windows CI without elevated privileges.'); return; }
  const dir=await mkdtemp(join(tmpdir(),'knowme-tls-domain-binding-symlink-'));
  try {
    const targetPath=join(dir,'tls-domain-target.json');
    const artifactPath=join(dir,'tls-domain-link.json');
    const outputPath=join(dir,'item.json');
    await writeFile(targetPath,bytes());
    await symlink(targetPath,artifactPath);
    const result=spawnSync(process.execPath,cliArgs(artifactPath,outputPath),{encoding:'utf8'});
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/regular non-symlink file/);
    assert.equal(existsSync(outputPath),false);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
