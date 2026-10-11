import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compareDeployments } from './check-platform-deployment.mjs';

const sha='a'.repeat(40);
const manifest=JSON.parse(readFileSync(new URL('../packages/link-contract/src/platform-sync.json', import.meta.url),'utf8'));
const {productVersion,contractRevision}=manifest;
const good=(platform)=>({platform,version:productVersion,experienceRevision:contractRevision,commit:sha});

test('accepts matching Web and API versions from one immutable commit',()=>{
  assert.deepEqual(compareDeployments(good('web'),good('api'),productVersion,contractRevision,sha),[]);
});
test('blocks a site updated before its API and Android rollout',()=>{
  assert.ok(compareDeployments(good('web'),{...good('api'),commit:'b'.repeat(40)},productVersion,contractRevision,sha).length>0);
});
test('refuses missing build provenance even when semantic versions match',()=>{
  assert.ok(compareDeployments({...good('web'),commit:null},good('api'),productVersion,contractRevision,sha).length>0);
});
test('refuses a frontend with an incompatible experience revision',()=>{
  assert.ok(compareDeployments({...good('web'),experienceRevision:'yesterday'},good('api'),productVersion,contractRevision,sha).length>0);
});
