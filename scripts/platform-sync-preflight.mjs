#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const MANIFEST = path.join(ROOT, 'packages/link-contract/src/platform-sync.json');
const VALID_STATUS = new Set(['implemented', 'partial', 'missing']);

export function auditPlatformSync(manifest, options = {}) {
  const errors = [];
  const missing = [];
  const strict = options.strict === true;
  const root = options.root ?? ROOT;
  if (!/^\d+\.\d+\.\d+$/.test(manifest?.productVersion ?? '')) {
    errors.push('Invalid product version');
  }
  if (!Array.isArray(manifest?.features) || !manifest.features.length) {
    errors.push('Feature registry is missing');
    return { errors, missing };
  }
  const ids = new Set();
  for (const feature of manifest.features) {
    if (typeof feature.id !== 'string' || !/^[a-z0-9.-]+$/.test(feature.id) || ids.has(feature.id)) {
      errors.push(`Invalid or duplicate feature ID: ${feature.id}`);
    }
    ids.add(feature.id);
    for (const platform of ['web', 'android']) {
      const item = feature[platform];
      if (!item || !VALID_STATUS.has(item.status)) {
        errors.push(`${feature.id}:${platform} has an invalid status`);
        continue;
      }
      const evidence = item.evidence;
      if (item.status === 'missing' && evidence !== null) {
        errors.push(`${feature.id}:${platform} must not cite implemented code when missing`);
      }
      if (item.status !== 'missing') {
        const prefix = platform === 'web' ? 'apps/web/' : 'apps/mobile/';
        if (typeof evidence !== 'string' || !evidence.startsWith(prefix) ||
            evidence.includes('..') || !existsSync(path.join(root, evidence))) {
          errors.push(`${feature.id}:${platform} evidence is missing: ${evidence}`);
        }
      }
    }
    if (feature.releaseRequired &&
        (feature.web?.status !== 'implemented' || feature.android?.status !== 'implemented')) {
      missing.push(feature.id);
    }
  }
  for (const file of ['apps/web/package.json', 'apps/api/package.json', 'apps/mobile/app.json']) {
    const parsed = JSON.parse(readFileSync(path.join(root, file), 'utf8'));
    const version = file.includes('app.json') ? parsed.expo?.version : parsed.version;
    if (version !== manifest.productVersion) {
      errors.push(`${file} version ${version ?? 'missing'} != ${manifest.productVersion}`);
    }
  }
  if (strict && missing.length) {
    errors.push(`Release blocked: missing Web/Android parity for ${missing.join(', ')}`);
  }
  return { errors, missing };
}

function main() {
  const strict = process.argv.includes('--release');
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const { errors, missing } = auditPlatformSync(manifest, { strict });
  console.log(JSON.stringify({
    product: manifest.product,
    version: manifest.productVersion,
    contractRevision: manifest.contractRevision,
    releaseReady: !errors.length && !missing.length,
    unavailableOrPartialOnAndroid: manifest.features
      .filter((feature) => feature.android.status !== 'implemented')
      .map(({ id, android }) => ({ feature: id, status: android.status })),
    errors
  }, null, 2));
  if (errors.length) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
