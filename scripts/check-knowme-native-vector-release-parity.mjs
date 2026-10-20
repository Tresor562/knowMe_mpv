#!/usr/bin/env node
/**
 * Prevent native vector UI regressions across *published, signed* previews.
 *
 * Unlike an unconditional "SVG file must exist" check, this compares today's
 * release source to the source of the most recently published official APK.
 * Before the first vector-enabled APK is published the previous UI is the
 * valid backwards-compatible baseline. Once SVG ships, removal is rejected.
 *
 * GitHub API errors, incomplete vector integrations, missing metadata, and
 * ambiguous release provenance FAIL CLOSED. This check supplements, but does
 * not replace, APK signature, versionCode, SHA256, CI and exact-commit gates.
 *
 * Usage in GitHub Actions:
 *   GH_TOKEN=... GITHUB_REPOSITORY=owner/repo node scripts/check-knowme-native-vector-release-parity.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const SVG_FILES = [
  'apps/mobile/src/ui/KnowMeNativeVectorIcon.tsx',
  'apps/mobile/src/ui/knowme-native-vector-contract.json',
  'scripts/check-knowme-native-vector-contract.mjs'
];

const RELEASE_PATTERN = /^v\d+\.\d+\.\d+-preview$/;
const SHA_PATTERN = /^[a-f0-9]{40}$/i;
const read = p => fs.readFileSync(path.resolve(p), 'utf8');

export function inspectCurrentVectorSource(root = process.cwd()) {
  const missing = SVG_FILES.filter(p => !fs.existsSync(path.join(root,p)));
  const presentCount = SVG_FILES.length - missing.length;
  const present = presentCount === SVG_FILES.length;
  const absent = presentCount === 0;
  if (!present && !absent) {
    throw Error('Installation SVG native incomplète : ' + missing.join(', '));
  }
  if (present) {
    const pkg = JSON.parse(fs.readFileSync(path.join(root,'apps/mobile/package.json'),'utf8'));
    const lock = fs.readFileSync(path.join(root,'pnpm-lock.yaml'),'utf8');
    const wrapper = fs.readFileSync(path.join(root,'apps/mobile/src/ui/KnowMeUI.tsx'),'utf8');
    const actual = pkg.dependencies?.['react-native-svg'];
    if (!actual || !lock.includes('react-native-svg@'+actual+':') ||
        !lock.includes('        specifier: '+actual) ||
        !wrapper.includes('hasKnowMeNativeVectorGlyph(name)') ||
        !wrapper.includes('<KnowMeNativeVectorIcon')) {
      throw Error('Moteur SVG déclaré sans dépendance verrouillée ou branchement UI : publication refusée.');
    }
    const contract = JSON.parse(fs.readFileSync(
      path.join(root,'apps/mobile/src/ui/knowme-native-vector-contract.json'),'utf8'));
    if (!contract?.glyphs || Object.keys(contract.glyphs).length < 75)
      throw Error('Contrat géométrique SVG incomplet : publication refusée.');
  }
  return { installed:present,missing };
}

export function assertVectorUpgrade({ previousReleaseHadSVG, currentHasSVG }) {
  if (previousReleaseHadSVG && !currentHasSVG) {
    throw Error('Régression : une APK officielle précédente incluait le moteur SVG natif.');
  }
  return previousReleaseHadSVG
    ? 'SVG natif conservé entre deux APK officielles'
    : currentHasSVG
      ? 'Première APK officielle avec moteur SVG natif complet'
      : 'APK officielle sans SVG natif : comportement graphique préexistant conservé';
}

export function choosePublishedPreview(releases) {
  if (!Array.isArray(releases))throw Error('GitHub releases payload malformed');
  const candidates = releases.filter(r=>
    r?.prerelease === true && r?.draft === false &&
    RELEASE_PATTERN.test(r.tag_name) &&
    r.assets?.some(a=>a.name===`KnowMe-${r.tag_name.slice(1).replace(/-preview$/,'')}-preview.apk`) &&
    r.assets?.some(a=>a.name==='knowme-update.json')
  );
  candidates.sort((a,b)=>new Date(b.published_at).getTime()-new Date(a.published_at).getTime());
  const latest = candidates[0];
  if (latest && (!SHA_PATTERN.test(latest.target_commitish) ||
      !Number.isFinite(Date.parse(latest.published_at)))) {
    throw Error('Latest signed preview has ambiguous source provenance');
  }
  return latest ?? null;
}

async function gh(pathname, token,{allow404=false}={}) {
  const response = await fetch('https://api.github.com'+pathname,{
    headers:{
      'Authorization':'Bearer '+token,
      'Accept':'application/vnd.github+json',
      'X-GitHub-Api-Version':'2022-11-28'
    },
    signal:AbortSignal.timeout(15000)
  });
  if (allow404 && response.status===404)return null;
  if(!response.ok)throw Error('GitHub release provenance check failed: HTTP '+response.status);
  return response.json();
}

export async function main() {
  const token=process.env.GH_TOKEN;
  const repo=process.env.GITHUB_REPOSITORY;
  if(!token || !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo??'')) {
    throw Error('Expected GH_TOKEN and validated GITHUB_REPOSITORY');
  }
  const source=inspectCurrentVectorSource();
  const releases=await gh('/repos/'+repo+'/releases?per_page=100',token);
  const latest=choosePublishedPreview(releases);
  let previousReleaseHadSVG=false;
  if(latest){
    const filename=encodeURIComponent(SVG_FILES[0]).replace(/%2F/gi,'/');
    const item=await gh('/repos/'+repo+'/contents/'+filename+
      '?ref='+encodeURIComponent(latest.target_commitish),token,{allow404:true});
    previousReleaseHadSVG=item!==null;
    // A published source may contain the renderer without its parity metadata;
    // it still counts as a native feature that must never be removed.
  } else if(releases.length>=100) {
    // We cannot prove the absence of older, supported releases if the first
    // page is full and no valid current official preview was found.
    throw Error('Release history incomplete: cannot establish a safe baseline');
  }
  const status=assertVectorUpgrade({
    previousReleaseHadSVG,
    currentHasSVG:source.installed
  });
  if(source.installed){
    // Geometry parity and the native glyph mapping are checked against source.
    const {execFileSync}=await import('node:child_process');
    execFileSync(process.execPath,['scripts/check-knowme-native-vector-contract.mjs'],{
      stdio:'inherit',timeout:20000
    });
    execFileSync(process.execPath,
      ['scripts/audit-knowme-icon-parity.mjs','--require-parity'],{
        stdio:'inherit',timeout:20000
      });
  }
  console.log(JSON.stringify({
    compatibility:'ok',
    previousTag:latest?.tag_name??null,
    previousSha:latest?.target_commitish??null,
    previousReleaseHadSVG,
    currentHasSVG:source.installed,
    note:status
  }));
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  main().catch(error=>{
    console.error('::error::'+(error instanceof Error?error.message:String(error)));
    process.exitCode=1;
  });
}
