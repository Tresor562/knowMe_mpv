#!/usr/bin/env node

import { parseCanonicalReceiptMaxAgeHours } from './market-release-evidence-bundle-receipt-reverify.mjs';

export function validateReleaseReceiptFreshnessPolicy(env = process.env) {
  const errors = [];
  const raw = env.KNOWME_RELEASE_RECEIPT_MAX_AGE_HOURS;
  if (raw === undefined || raw === null || raw === '') {
    errors.push('KNOWME_RELEASE_RECEIPT_MAX_AGE_HOURS must be explicitly configured for market readiness.');
  } else {
    try {
      parseCanonicalReceiptMaxAgeHours(raw, 'KNOWME_RELEASE_RECEIPT_MAX_AGE_HOURS');
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { ok: errors.length === 0, errors };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = validateReleaseReceiptFreshnessPolicy();
  if (!result.ok) {
    console.error('ERROR: Release receipt freshness preflight failed.');
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log('Release receipt freshness policy preflight passed.');
  }
}
