#!/usr/bin/env node
/**
 * From an external GitHub Actions runner, prove that a compatible APK release
 * is actually served by KnowMe's VPS (not just published on GitHub).
 * This does not prove that any particular phone has received a notification.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const feedUrl='https://31-56-85-53.sslip.io/knowme-api/mobile-updates/android';
const expectedFile=process.argv[2];
if(!expectedFile)throw new Error('Usage: node scripts/verify-android-vps-delivery.mjs dist/knowme-update.json');
const expected=JSON.parse(readFileSync(expectedFile,'utf8'));
if(!Number.isSafeInteger(expected.versionCode)||expected.versionCode<10000||
  !/^\d+\.\d+\.\d+$/.test(expected.version)||
  !/^[a-f0-9]{64}$/i.test(expected.sha256)){
  throw new Error('Expected release metadata is invalid');
}
const apkUrl=feedUrl+'/apk/KnowMe-'+expected.version+'-preview.apk';
const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));

async function verifyDelivery(){
  const attempts=24; // five-minute pull timer plus bounded deployment delay
  for(let n=1;n<=attempts;n++){
    let reason='VPS update feed not ready';
    try{
      const response=await fetch(feedUrl,{signal:AbortSignal.timeout(12000),
        headers:{Accept:'application/json','Cache-Control':'no-store'}});
      if(!response.ok)throw new Error('feed HTTP '+response.status);
      const feed=await response.json();
      const release=feed?.release;
      if(release?.versionCode===expected.versionCode&&release.version===expected.version&&
        String(release.sha256).toLowerCase()===expected.sha256.toLowerCase()&&
        release.url===apkUrl){
        console.log('VPS manifest matches exact APK release version '+expected.version);
        const download=await fetch(apkUrl,{signal:AbortSignal.timeout(150000),
          headers:{'Cache-Control':'no-store'}});
        if(!download.ok||!download.body)throw new Error('APK HTTP '+download.status);
        const reported=Number(download.headers.get('content-length'));
        if(!Number.isSafeInteger(reported)||reported<10_000_000||reported>250_000_000)
          throw new Error('APK content length missing or outside expected range');
        let size=0;
        const hash=createHash('sha256');
        for await (const chunk of download.body){
          size+=chunk.byteLength;
          if(size>250_000_000)throw new Error('APK download exceeds size cap');
          hash.update(chunk);
        }
        const digest=hash.digest('hex');
        if(size!==reported||digest!==expected.sha256.toLowerCase())
          throw new Error('Hosted APK bytes do not match release SHA256 and length');
        console.log(JSON.stringify({ok:true,version:expected.version,versionCode:expected.versionCode,
          url:apkUrl,bytes:size,sha256:digest}));
        return;
      }
      reason='VPS has not mirrored exact version '+expected.version+' (currently '+(release?.version??'none')+')';
    }catch(e){reason=e instanceof Error?e.message:String(e);}
    console.log('Attempt '+n+'/'+attempts+': '+reason);
    if(n<attempts)await sleep(20000);
  }
  throw new Error('APK not verifiably available inside KnowMe via VPS. Do not announce rollout.');
}

verifyDelivery().catch(e=>{console.error('KnowMe Android delivery verification failed:',e.message);process.exitCode=1;});
