import { appendFileSync, readFileSync } from 'node:fs';
import { coordinationMetadata, getOverlaps } from './coordination-core.mjs';

const eventPath = process.env.GITHUB_EVENT_PATH;
const token = process.env.GH_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
if (!eventPath || !token || !repo || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
  throw new Error('GitHub Actions pull_request context or read-only token unavailable.');
}
const event = JSON.parse(readFileSync(eventPath, 'utf8'));
const current = event.pull_request;
if (!current || !Number.isSafeInteger(current.number)) {
  throw new Error('This guard requires a pull_request event.');
}
const meta = coordinationMetadata(current);
const api = (process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, '');
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

async function github(relativePath) {
  const response = await fetch(`${api}/repos/${repo}/${relativePath}`, {
    headers, signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`GitHub HTTP ${response.status} on repository endpoint ${relativePath.split('?')[0]}`);
  return response.json();
}

async function paginated(resource) {
  const result = [];
  for (let page = 1; page <= 10; page++) {
    const separator = resource.includes('?') ? '&' : '?';
    const chunk = await github(`${resource}${separator}per_page=100&page=${page}`);
    if (!Array.isArray(chunk)) throw new Error('GitHub pagination response is not an array.');
    result.push(...chunk);
    if (chunk.length < 100) return result;
  }
  throw new Error(`Too many results for ${resource}; aborting rather than skipping collisions.`);
}

async function poolMap(list, limit, mapper) {
  const results = new Array(list.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (cursor < list.length) {
      const index = cursor++;
      results[index] = await mapper(list[index]);
    }
  }));
  return results;
}

function summary(message) {
  console.log(message);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, message + '\n');
}

if (!meta.coordinated) {
  summary('### KnowMe coordination\nLegacy branch: metadata and file-overlap enforcement apply to new `chat/*` branches only. Please inspect parallel PRs manually.');
} else {
  const ticket = await github(`issues/${meta.issueNumber}`);
  if (ticket.pull_request || ticket.state !== 'open') throw new Error('Coordination-Issue must reference an open GitHub issue, not a PR.');
  const ticketDomain = /^Workstream:\s*([a-z]+)\s*$/im.exec(ticket.body ?? '')?.[1];
  if (ticketDomain !== meta.domain) throw new Error(`Coordination-Issue #${meta.issueNumber} must declare Workstream: ${meta.domain}.`);
  const ownFiles = (await paginated(`pulls/${current.number}/files`)).map((f) => f.filename);
  if (!ownFiles.length) throw new Error('No changed files found for this PR; cannot qualify overlap.');
  const other = (await paginated('pulls?state=open'))
    .filter((pr) => pr.number !== current.number && pr.base?.ref === current.base?.ref);
  const competing = await poolMap(other, 8, async (pr) => ({
    pr,
    files: (await paginated(`pulls/${pr.number}/files`)).map((f) => f.filename),
  }));
  const overlaps = getOverlaps(current, ownFiles, competing);
  summary(`### KnowMe coordination — ${meta.domain}\n- Issue: #${meta.issueNumber}\n- Changed files: ${ownFiles.length}\n- Competing open PRs on \`${current.base.ref}\`: ${other.length}`);
  if (overlaps.length) {
    for (const item of overlaps) {
      const names = item.paths.slice(0, 20).map((path) => JSON.stringify(path)).join(', ');
      summary(`- **Collision avec PR #${item.number}** : ${names}${item.paths.length > 20 ? '…' : ''}`);
    }
    throw new Error('Chevauchement de fichiers détecté : résoudre/ordonner les PR liées avant intégration.');
  }
  summary('- **Aucun chevauchement de fichiers détecté avec les PR ouvertes.** Faire quand même une revue des contrats communs.');
}
