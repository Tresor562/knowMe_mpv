import test from 'node:test';
import assert from 'node:assert/strict';
import { compareDeployments } from './check-platform-deployment.mjs';

const sha='a'.repeat(40);
const good=(platform)=>({platform,version:'1.0.0',experienceRevision:'2026-10-11.2',commit:sha});

test('accepts matching Web and API versions from one immutable commit',()=>{
  assert.deepEqual(compareDeployments(good('web'),good('api'),'1.0.0','2026-10-11.2',sha),[]);
});
test('blocks a site updated before its API and Android rollout',()=>{
  assert.ok(compareDeployments(good('web'),{...good('api'),commit:'b'.repeat(40)},'1.0.0','2026-10-11.2',sha).length>0);
});
test('refuses missing build provenance even when semantic versions match',()=>{
  assert.ok(compareDeployments({...good('web'),commit:null},good('api'),'1.0.0','2026-10-11.2',sha).length>0);
});
test('refuses a frontend with an incompatible experience revision',()=>{
  assert.ok(compareDeployments({...good('web'),experienceRevision:'yesterday'},good('api'),'1.0.0','2026-10-11.2',sha).length>0);
});
