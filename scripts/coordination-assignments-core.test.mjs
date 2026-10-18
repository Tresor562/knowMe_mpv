import test from 'node:test';
import assert from 'node:assert/strict';
import {ORDER,snapshot,choose,claim,transition} from './coordination-assignments-core.mjs';
const seed=()=>({
  schemaVersion:1,
  domains:Object.fromEntries(ORDER.map(id=>[id,{
    issue:0,status:'free',ownerRef:null,branch:null,task:null,
    claimedAt:null,updatedAt:null,lastPr:null,resumeFrom:null,
  }])),history:[]
});
const now='2026-10-18T10:00:00Z';
const a='session-aaaaaaaa',b='session-bbbbbbbb';
test('different chats take distinct free domains in order',()=>{
  const first=claim(seed(),a,now);
  assert.equal(first.domain,'messaging');
  const second=claim(first.state,b,now);
  assert.equal(second.domain,'social');
  assert.deepEqual(snapshot(second.state).active,['messaging','social']);
  assert.deepEqual(snapshot(second.state).free,ORDER.slice(2));
});
test('same chat reuses its domain and never consumes another',()=>{
  const state=claim(seed(),a,now).state;
  const resumed=claim(state,a,'2026-10-18T12:00:00Z');
  assert.equal(resumed.reason,'same-session');
  assert.equal(resumed.domain,'messaging');
  assert.deepEqual(snapshot(resumed.state).active,['messaging']);
});
test('once free exhausted, resume paused oldest and keep previous task references',()=>{
  const state=seed();
  ORDER.forEach((id,index)=>{
    state.domains[id]={...state.domains[id],status:index<2?'paused':'active',
      ownerRef:'session-existing-'+index,
      updatedAt:index===0?'2026-10-17T10:00:00Z':'2026-10-18T00:00:00Z',
      task:id+' task',branch:'chat/'+id+'/old-task',lastPr:100+index};
  });
  const result=claim(state,a,now);
  assert.equal(result.domain,'messaging');
  assert.equal(result.reason,'resume-paused');
  assert.equal(result.state.domains.messaging.resumeFrom.branch,'chat/messaging/old-task');
});
test('active work cannot be stolen merely due to inactivity',()=>{
  const state=seed();
  for(const id of ORDER){
    state.domains[id].status='active';
    state.domains[id].ownerRef='session-existing-'+id;
    state.domains[id].updatedAt='2026-10-01T00:00:00Z';
  }
  assert.equal(choose(state,a,now),null);
  assert.throws(()=>claim(state,a,now),/No safely available/);
  const r=claim(state,a,now,['reels']);
  assert.equal(r.domain,'reels');
  assert.equal(r.reason,'verified-stale');
});
test('pause preserves reference for same chat, complete releases ownership',()=>{
  const active=claim(seed(),a,now).state;
  const paused=transition(active,{
    ownerRef:a,action:'pause',now,branch:'chat/messaging/voice',
    task:'voice notes',lastPr:712,
  }).state;
  assert.deepEqual(snapshot(paused).paused,['messaging']);
  const resumed=claim(paused,a,now).state;
  assert.equal(resumed.domains.messaging.branch,'chat/messaging/voice');
  const done=transition(resumed,{ownerRef:a,action:'complete',now}).state;
  assert.deepEqual(snapshot(done).free,ORDER);
  assert.equal(done.domains.messaging.ownerRef,null);
  assert.ok(done.history.length>=4);
});
test('malformed session and cross-owner updates fail closed',()=>{
  assert.throws(()=>claim(seed(),'user',now),/ownerRef/);
  assert.throws(()=>transition(claim(seed(),a,now).state,{ownerRef:b,action:'pause'}),/does not own/);
});
