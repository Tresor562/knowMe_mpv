#!/usr/bin/env node
/** CLI for atomically claiming, updating, and reporting KnowMe chat domains. */
import { randomUUID } from 'node:crypto';
import {claim,snapshot,transition} from './coordination-assignments-core.mjs';
const command=process.argv[2]||'status';
const get=(key)=>{
  const index=process.argv.indexOf('--'+key);
  return index>=0 ? process.argv[index+1] : undefined;
};
if(!['status','claim','touch','pause','complete'].includes(command))
  throw Error('Commands: status, claim, touch, pause, complete');
const token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN;
if(command!=='status'&&!token) throw Error('GH_TOKEN required to write assignments');
const repo='Tresor562/knowMe_mpv';
const branch='coordination/workstream-assignments';
const url=(process.env.GITHUB_API_URL||'https://api.github.com').replace(/\/$/,'')+
  '/repos/'+repo+'/contents/docs/coordination/assignments.json';
const headers={
  Accept:'application/vnd.github+json',
  'X-GitHub-Api-Version':'2022-11-28',
  ...(token ? {Authorization:'Bearer '+token} : {}),
};
async function http(method,address,payload) {
  const response=await fetch(address,{
    method,headers:{...headers,...(payload?{'Content-Type':'application/json'}:{})},
    ...(payload?{body:JSON.stringify(payload)}:{}),
    signal:AbortSignal.timeout(20000),
  });
  if([409,422].includes(response.status)){
    const err=new Error('Concurrent state update; reload required');
    err.conflict=true;
    throw err;
  }
  if(!response.ok) throw Error('GitHub HTTP '+response.status);
  return response.json();
}
async function load(){
  const result=await http('GET',url+'?ref='+encodeURIComponent(branch));
  return {sha:result.sha,state:JSON.parse(Buffer.from(result.content,'base64').toString('utf8'))};
}
const ownerRef=get('owner')||(command==='claim'?'session-'+randomUUID():null);
for(let attempt=0;attempt<5;attempt++){
  const current=await load();
  if(command==='status'){
    console.log(JSON.stringify({summary:snapshot(current.state),domains:current.state.domains},null,2));
    break;
  }
  const update=command==='claim'?
    claim(current.state,ownerRef):
    transition(current.state,{
      ownerRef,action:command,branch:get('branch'),task:get('task'),
      lastPr:get('pr')===undefined?undefined:Number(get('pr')),
    });
  try{
    const saved=await http('PUT',url,{
      message:'coordination: '+command+' '+update.domain,
      branch,sha:current.sha,
      content:Buffer.from(JSON.stringify(update.state,null,2)+'\n').toString('base64'),
    });
    if(!saved.commit?.sha)throw Error('GitHub did not confirm a committed update');
    console.log(JSON.stringify({
      confirmed:true,commit:saved.commit.sha,ownerRef,domain:update.domain,
      reason:update.reason,summary:snapshot(update.state),
      resumeFrom:update.state.domains[update.domain].resumeFrom,
    },null,2));
    break;
  }catch(error){
    if(error.conflict&&attempt<4)continue;
    throw error;
  }
}
