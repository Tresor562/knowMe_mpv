import { validateExpoManifest, safeRuntime } from './expo-ota.controller';

const prefix='https://updates.knowme.example/mobile-updates/ota';
const digest='a'.repeat(64);
const asset={
  key:'bundle-key',hash:'A'.repeat(43),contentType:'application/javascript',
  url:prefix+'/assets/'+digest
};
const good={
  id:'8e0a66d8-f15b-4f90-8686-d380638c2a03',
  createdAt:'2026-10-17T19:00:00.000Z',
  runtimeVersion:'knowme-android-ota1',
  launchAsset:asset,assets:[],metadata:{},extra:{expoClient:{name:'KnowMe'}}
};
describe('Expo updates: safe signed manifest selection',()=>{
  it('accepts same-runtime Expo protocol manifest',()=>{
    expect(validateExpoManifest(good,'knowme-android-ota1',prefix)).toBe(true);
  });
  it('rejects native runtime mismatches and arbitrary asset hosts',()=>{
    expect(validateExpoManifest(good,'knowme-android-ota2',prefix)).toBe(false);
    expect(validateExpoManifest({...good,launchAsset:{...asset,url:'https://evil.invalid/a'}},
      good.runtimeVersion,prefix)).toBe(false);
  });
  it('refuses traversal or invalid channels in runtime selectors',()=>{
    expect(safeRuntime('../secrets')).toBe(false);
    expect(safeRuntime('v1/other')).toBe(false);
    expect(safeRuntime('knowme-android-ota1')).toBe(true);
  });
});
