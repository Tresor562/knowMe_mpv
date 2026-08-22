#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const REVERSE_DNS = /^[a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z][a-zA-Z0-9_]*){2,}$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const PLACEHOLDER_IDENTIFIERS = new Set([
  'com.example.app',
  'com.example.knowme',
  'org.example.app',
]);

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateIdentifier(value, key, errors) {
  if (!nonEmpty(value)) {
    errors.push(`${key} must be set for store distribution.`);
    return;
  }
  const normalized = value.trim();
  if (!REVERSE_DNS.test(normalized)) {
    errors.push(`${key} must be a reverse-DNS application identifier.`);
  }
  if (PLACEHOLDER_IDENTIFIERS.has(normalized.toLowerCase())) {
    errors.push(`${key} must not use a placeholder application identifier.`);
  }
}

export function validateMobileStoreConfig(config) {
  const errors = [];
  const warnings = [];
  const expo = config?.expo;

  if (!expo || typeof expo !== 'object') {
    return { ok: false, errors: ['apps/mobile/app.json must contain an Expo configuration.'], warnings };
  }

  if (!nonEmpty(expo.name)) errors.push('expo.name must be set.');
  if (!nonEmpty(expo.slug)) errors.push('expo.slug must be set.');
  if (!nonEmpty(expo.scheme)) errors.push('expo.scheme must be set for authenticated deep-link flows.');

  if (!nonEmpty(expo.version) || !SEMVER.test(expo.version.trim())) {
    errors.push('expo.version must be a stable MAJOR.MINOR.PATCH semantic version.');
  } else if (Number(expo.version.split('.')[0]) < 1) {
    errors.push('expo.version must be at least 1.0.0 for the first market release candidate.');
  }

  validateIdentifier(expo.ios?.bundleIdentifier, 'expo.ios.bundleIdentifier', errors);
  const iosBuild = expo.ios?.buildNumber;
  if (!nonEmpty(iosBuild) || !/^[1-9]\d*$/.test(iosBuild.trim())) {
    errors.push('expo.ios.buildNumber must be a positive integer string.');
  }

  validateIdentifier(expo.android?.package, 'expo.android.package', errors);
  const androidVersionCode = expo.android?.versionCode;
  if (!Number.isInteger(androidVersionCode) || androidVersionCode < 1) {
    errors.push('expo.android.versionCode must be a positive integer.');
  }

  if (expo.ios?.bundleIdentifier === expo.android?.package) {
    warnings.push('iOS and Android currently share the same reverse-DNS identifier; keep both values stable once store records are created.');
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function validateMobileProductionBuildConfig(config) {
  const errors = [];
  const warnings = [];
  const cli = config?.cli;
  const production = config?.build?.production;

  if (!production || typeof production !== 'object') {
    return {
      ok: false,
      errors: ['apps/mobile/eas.json must define build.production for store releases.'],
      warnings,
    };
  }

  if (production.developmentClient === true) {
    errors.push('build.production.developmentClient must not be enabled for a store release.');
  }
  if (production.distribution !== 'store') {
    errors.push('build.production.distribution must be "store".');
  }
  if (production.android?.buildType !== 'app-bundle') {
    errors.push('build.production.android.buildType must be "app-bundle" for Google Play distribution.');
  }
  if (production.ios?.simulator !== false) {
    errors.push('build.production.ios.simulator must be false for App Store distribution.');
  }
  if (production.autoIncrement !== true) {
    errors.push('build.production.autoIncrement must be true to preserve forward-only store build numbering.');
  }

  if (cli?.appVersionSource !== 'remote') {
    errors.push('cli.appVersionSource must be "remote" so EAS owns monotonic store build identifiers.');
  }

  const submitProduction = config?.submit?.production;
  if (!submitProduction || typeof submitProduction !== 'object' || Array.isArray(submitProduction)) {
    errors.push('submit.production must exist as an object for the production submission workflow.');
  }

  return { ok: errors.length === 0, errors, warnings };
}

async function runCli() {
  const appConfigUrl = new URL('../apps/mobile/app.json', import.meta.url);
  const easConfigUrl = new URL('../apps/mobile/eas.json', import.meta.url);
  const [appConfig, easConfig] = await Promise.all([
    readFile(fileURLToPath(appConfigUrl), 'utf8').then(JSON.parse),
    readFile(fileURLToPath(easConfigUrl), 'utf8').then(JSON.parse),
  ]);
  const results = [
    validateMobileStoreConfig(appConfig),
    validateMobileProductionBuildConfig(easConfig),
  ];
  const warnings = results.flatMap((result) => result.warnings);
  const errors = results.flatMap((result) => result.errors);

  for (const warning of warnings) console.warn(`WARN: ${warning}`);
  if (errors.length > 0) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    console.error(`Mobile store preflight failed with ${errors.length} error(s).`);
    process.exitCode = 1;
    return;
  }
  console.log('Mobile store preflight passed.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Mobile store preflight could not read the Expo/EAS configuration.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
