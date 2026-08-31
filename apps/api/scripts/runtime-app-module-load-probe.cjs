'use strict';

const Module = require('node:module');
const { closeSync, fsyncSync, openSync, writeSync } = require('node:fs');
const { relative, resolve, sep } = require('node:path');

const apiDistRoot = resolve(__dirname, '..', 'dist');
const markerPath = '/app/.knowme-app-module-load-probe';
const originalLoad = Module._load;

function persistMarker(value) {
  const fd = openSync(markerPath, 'w');
  try {
    writeSync(fd, `${value}\n`);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function applicationModuleMarker(filename) {
  if (typeof filename !== 'string') return null;
  if (filename !== apiDistRoot && !filename.startsWith(`${apiDistRoot}${sep}`)) return null;

  const localPath = relative(apiDistRoot, filename).split(sep).join('/');
  return localPath ? `loading:${localPath}` : 'loading:dist-root';
}

Module._load = function boundedApplicationLoadProbe(request, parent, isMain) {
  let resolved;
  try {
    resolved = Module._resolveFilename(request, parent, isMain);
  } catch {
    return originalLoad.apply(this, arguments);
  }

  const marker = applicationModuleMarker(resolved);
  if (marker) persistMarker(marker);
  return originalLoad.apply(this, arguments);
};

persistMarker('probe-enter');

try {
  require('../dist/app.module.js');
  persistMarker('app-module-load-ok');
  writeSync(1, 'app-module-load-ok\n');
} catch {
  writeSync(2, '[startup-probe] application graph load failed.\n');
  process.exitCode = 1;
}
