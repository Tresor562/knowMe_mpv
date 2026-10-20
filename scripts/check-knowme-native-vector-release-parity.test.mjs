import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  SVG_FILES, assertVectorUpgrade, inspectCurrentVectorSource, choosePublishedPreview
} from './check-knowme-native-vector-release-parity.mjs';

test('existing non-SVG signed previews can receive another non-SVG release',()=>{
  assert.match(assertVectorUpgrade({previousReleaseHadSVG:false,currentHasSVG:false}),
    /comportement graphique préexistant/);
});

test('a fully integrated SVG renderer can be introduced for the first time',()=>{
  assert.match(assertVectorUpgrade({previousReleaseHadSVG:false,currentHasSVG:true}),
    /Première APK/);
});

test('an SVG-capable signed preview cannot be downgraded',()=>{
  assert.throws(()=>assertVectorUpgrade({previousReleaseHadSVG:true,currentHasSVG:false}),
    /Régression/);
});

test('SVG renderer is allowed when previously released and preserved',()=>{
  assert.match(assertVectorUpgrade({previousReleaseHadSVG:true,currentHasSVG:true}),
    /SVG natif conservé/);
});

test('newest actual preview asset establishes the exact previous release commit',()=>{
  const make=(tag,publishedAt,sha,hasMetadata=true)=>({
    tag_name:tag,prerelease:true,draft:false,published_at:publishedAt,
    target_commitish:sha,
    assets:[{name:'KnowMe-'+tag.slice(1).replace(/-preview$/,'')+'-preview.apk'},
      ...(hasMetadata?[{name:'knowme-update.json'}]:[])]
  });
  const old=make('v1.1.10000-preview','2026-10-18T00:00:00Z','a'.repeat(40));
  const latest=make('v1.1.11000-preview','2026-10-19T00:00:00Z','b'.repeat(40));
  const fake={...make('v1.1.12000-preview','2026-10-20T00:00:00Z','c'.repeat(40)),draft:true};
  const incomplete=make('v1.1.13000-preview','2026-10-21T00:00:00Z','d'.repeat(40),false);
  assert.equal(choosePublishedPreview([old,fake,incomplete,latest])?.target_commitish,'b'.repeat(40));
  assert.equal(choosePublishedPreview([]),null);
  assert.throws(()=>choosePublishedPreview('not-an-array'),/malformed/);
});

test('ambiguous latest release source is refused',()=>{
  const r={
    tag_name:'v1.1.11000-preview',prerelease:true,draft:false,
    published_at:'2026-10-20T00:00:00Z',target_commitish:'main',
    assets:[{name:'KnowMe-1.1.11000-preview.apk'},{name:'knowme-update.json'}]
  };
  assert.throws(()=>choosePublishedPreview([r]),/ambiguous/);
});

test('partially copied native renderer is never qualified',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'knowme-svg-release-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  assert.equal(inspectCurrentVectorSource(root).installed,false);
  const first=path.join(root,SVG_FILES[0]);
  fs.mkdirSync(path.dirname(first),{recursive:true});
  fs.writeFileSync(first,'// incomplete');
  assert.throws(()=>inspectCurrentVectorSource(root),/incomplète/);
});

test('full source must still have a locked dependency and real UI wiring',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'knowme-svg-release-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  for(const rel of SVG_FILES){
    const file=path.join(root,rel);fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,rel.endsWith('.json')?JSON.stringify({glyphs:{}}):'// input');
  }
  const mobile=path.join(root,'apps/mobile/package.json');
  fs.writeFileSync(mobile,JSON.stringify({dependencies:{'react-native-svg':'15.11.2'}}));
  fs.writeFileSync(path.join(root,'pnpm-lock.yaml'),"  react-native-svg@15.11.2:\n");
  fs.writeFileSync(path.join(root,'apps/mobile/src/ui/KnowMeUI.tsx'),'// incomplete');
  assert.throws(()=>inspectCurrentVectorSource(root),/sans dépendance verrouillée/);
});
