#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../packages/link-contract/src/platform-sync.json', import.meta.url), 'utf8'));

export function compareDeployments(web, api, expectedVersion, expectedRevision, expectedSha) {
  const errors=[];
  for(const [platform,record] of [['web',web],['api',api]]) {
    if(record?.platform!==platform)errors.push(`${platform}: wrong platform identity`);
    if(record?.version!==expectedVersion)errors.push(`${platform}: product version drift`);
    if(record?.experienceRevision!==expectedRevision)errors.push(`${platform}: UI contract drift`);
    if(!/^[a-f\d]{40}$/i.test(record?.commit||''))errors.push(`${platform}: deployment commit unknown`);
    else if(expectedSha&&record.commit.toLowerCase()!==expectedSha.toLowerCase())
      errors.push(`${platform}: deployed commit differs from expected release`);
  }
  if(web?.commit&&api?.commit&&web.commit!==api.commit)errors.push('Web/API were built from different commits');
  return errors;
}

async function main() {
  const webOrigin=process.env.KNOWME_WEB_ORIGIN;
  const apiOrigin=process.env.KNOWME_API_ORIGIN;
  const sha=process.env.KNOWME_RELEASE_COMMIT;
  if(!webOrigin||!apiOrigin||!sha)throw new Error('Set KNOWME_WEB_ORIGIN, KNOWME_API_ORIGIN and KNOWME_RELEASE_COMMIT');
  const roots=[webOrigin,apiOrigin].map(value=>{
    const uri=new URL(value);
    if(uri.protocol!=='https:'||uri.username||uri.password||uri.search||uri.hash)
      throw new Error('Production origins must be HTTPS without credentials or query');
    return uri.toString().replace(/\/$/,'');
  });
  const paths=['/api/version','/platform-sync/version'];
  const versions=await Promise.all(roots.map(async(origin,i)=>{
    const response=await fetch(origin+paths[i],{signal:AbortSignal.timeout(7000),headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error(`Version endpoint ${paths[i]} returned HTTP ${response.status}`);
    return response.json();
  }));
  const errors=compareDeployments(versions[0],versions[1],config.productVersion,config.contractRevision,sha);
  console.log(JSON.stringify({web:versions[0],api:versions[1],synchronized:!errors.length,errors},null,2));
  if(errors.length)process.exitCode=1;
}
if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1]) {
  main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
}
