'use strict';

// Expo evaluates the dynamic config before prebuild and Metro bundling.
// Generate the exact official Web logo as native PNG files without storing
// stale or independently drawn binary artwork in this monorepo.
const { syncBrandAssets } = require('./scripts/sync-brand-assets.cjs');
syncBrandAssets();

module.exports = ({ config }) => config;
