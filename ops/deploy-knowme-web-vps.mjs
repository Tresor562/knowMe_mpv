#!/usr/bin/env node
/**
 * Blue/green KnowMe Web deployment on the owner's VPS.
 * Build from an exact CI-qualified commit; do not alter the live container
 * or nginx until the candidate responds on localhost. Roll back nginx on
 * any failed production health check.
 */
import { spawnSync, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, openSync, closeSync } from 'node:fs';
import { join } from 'node:path';

const sha = String(process.env.KNOWME_DEPLOY_SHA || '').trim();
if (!/^[a-f0-9]{40}$/i.test(sha)) throw new Error('Expected exact KnowMe commit SHA');
const root = '/opt/nex/apps/public/knowme-web/source';
const runtime = '/var/lib/nex/runtime/knowme-web';
const nginxFile = '/etc/nginx/sites-available/knowme-web-vps.conf';
const host = 'https://knowme.31-56-85-53.sslip.io';
const api = 'https://31-56-85-53.sslip.io/knowme-api';
const dockerTag = 'knowme-web:' + sha.slice(0, 12);
mkdirSync(runtime, { recursive: true, mode: 0o700 });
function run(command, args, timeout = 180000) {
  return execFileSync(command, args, { encoding: 'utf8', timeout, maxBuffer: 4 * 1024 * 1024 }).trim();
}
function http(url, timeoutSeconds = 8) {
  return run('curl', ['--silent', '--show-error', '--max-time', String(timeoutSeconds), '--output', '/dev/null', '--write-out', '%{http_code}', url], (timeoutSeconds + 2) * 1000);
}
function verifyApi() {
  const result = JSON.parse(run('curl', ['-fsS', '--max-time', '10', api + '/platform-sync/version'], 12000));
  if (result.commit !== sha) throw new Error('API must be deployed at the same commit before Web switch');
  return result.version;
}
function containerExists(name) {
  try { run('docker', ['inspect', name], 10000); return true; } catch { return false; }
}
if (!existsSync(nginxFile)) throw new Error('Dedicated KnowMe nginx host is not configured');
if (!existsSync(join(root, '.git'))) throw new Error('Dedicated KnowMe Web source checkout missing');
run('git', ['-C', root, 'fetch', '--quiet', 'origin', sha], 180000);
run('git', ['-C', root, 'checkout', '--detach', '--force', sha]);
if (run('git', ['-C', root, 'rev-parse', 'HEAD']) !== sha) throw new Error('Source SHA verification failed');
const version = JSON.parse(readFileSync(join(root, 'packages/link-contract/src/platform-sync.json'))).productVersion;
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Bad Web release version');
if (verifyApi() !== version) throw new Error('Web/API release version mismatch');
const nginx = readFileSync(nginxFile, 'utf8');
const pattern = /proxy_pass http:\/\/127\.0\.0\.1:(3000|3001|3002);/g;
const matches = [...nginx.matchAll(pattern)];
if (matches.length !== 1) throw new Error('Expected one dedicated KnowMe proxy_pass');
const previousPort = Number(matches[0][1]);
const nextPort = previousPort === 3001 ? 3002 : 3001;
const container = nextPort === 3001 ? 'knowme-web-blue' : 'knowme-web-green';
const dockerfile = join(root, '.knowme-vps.Dockerfile');
const original = readFileSync(join(root, 'Dockerfile.web'), 'utf8');
const anchor = 'RUN pnpm --filter @knowme/web... build';
if (original.split(anchor).length !== 2) throw new Error('Unexpected Dockerfile.web build anchor');
const injected = original.replace(anchor,
  'ENV KNOWME_API_ORIGIN=' + api + '\n' +
  'ENV NEXT_PUBLIC_API_URL=' + api + '\n' +
  'ENV NEXT_PUBLIC_RELEASE_COMMIT=' + sha + '\n' + anchor);
writeFileSync(dockerfile, injected, { mode: 0o600 });
const log = join(runtime, 'deploy.log');
const fd = openSync(log, 'a', 0o600);
let result;
try {
  result = spawnSync('docker', ['build', '-f', '.knowme-vps.Dockerfile', '-t', dockerTag, '.'], {
    cwd: root, stdio: ['ignore', fd, fd], timeout: 45 * 60000
  });
} finally {
  closeSync(fd);
}
if (result.status !== 0) throw new Error('Docker Web build failed; see root-only runtime log');
if (containerExists(container)) run('docker', ['rm', '-f', container], 120000);
run('docker', ['run', '-d', '--restart', 'unless-stopped',
  '--name', container, '--network', 'knowme-net',
  '-p', '127.0.0.1:' + nextPort + ':3000',
  '-e', 'KNOWME_API_ORIGIN=' + api, '-e', 'NEXT_PUBLIC_API_URL=' + api, dockerTag], 120000);
let candidateReady = false;
for (let attempt = 0; attempt < 48; attempt++) {
  try {
    if (http('http://127.0.0.1:' + nextPort + '/health/live', 4) === '200' &&
        http('http://127.0.0.1:' + nextPort + '/login', 5) === '200') {
      candidateReady = true; break;
    }
  } catch { /* retry startup */ }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2500);
}
if (!candidateReady) {
  run('docker', ['rm', '-f', container]);
  throw new Error('New KnowMe Web container not healthy; old production preserved');
}
const candidate = nginx.replace(matches[0][0], 'proxy_pass http://127.0.0.1:' + nextPort + ';');
const saved = nginxFile + '.knowme-previous';
writeFileSync(saved, nginx, { mode: 0o600 });
const staged = nginxFile + '.knowme-new';
writeFileSync(staged, candidate, { mode: 0o644 });
renameSync(staged, nginxFile);
try {
  run('nginx', ['-t'], 12000);
  run('systemctl', ['reload', 'nginx'], 15000);
  if (http(host + '/login', 10) !== '200' ||
      http(host + '/api/version', 10) !== '200') {
    throw new Error('New public Web not available');
  }
  const live = JSON.parse(run('curl', ['-fsS', '--max-time', '10', host + '/api/version'], 12000));
  if (live.commit !== sha || live.version !== version) throw new Error('Public Web release identity differs from target');
  const state = { sha, version, port: nextPort, image: dockerTag, updatedAt: new Date().toISOString() };
  const stateFile = join(runtime, 'active-release.json');
  writeFileSync(stateFile + '.tmp', JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
  renameSync(stateFile + '.tmp', stateFile);
  console.log(JSON.stringify({ ok: true, sha, version, port: nextPort, api: 'ready', web: 'ready' }));
} catch (error) {
  writeFileSync(nginxFile + '.rollback', nginx, { mode: 0o644 });
  renameSync(nginxFile + '.rollback', nginxFile);
  run('nginx', ['-t'], 12000);
  run('systemctl', ['reload', 'nginx'], 15000);
  throw error;
}
