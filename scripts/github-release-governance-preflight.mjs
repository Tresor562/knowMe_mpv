#!/usr/bin/env node

const CANONICAL_REPOSITORY = 'Tresor562/knowMe_mpv';
const CANONICAL_BRANCH = 'main';
const REQUIRED_STATUS_CHECK = 'quality';
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function canonicalText(value, { max = 256 } = {}) {
  return typeof value === 'string' && value === value.trim() && value.length > 0 && value.length <= max && !CONTROL_CHARACTERS.test(value)
    ? value
    : null;
}

function exactRepositoryName(value) {
  return canonicalText(value) !== null && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value);
}

function authHeaders(token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'knowme-market-release-governance-preflight',
  };
  if (canonicalText(token, { max: 4096 }) !== null) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function fetchJson(url, { fetchImpl = globalThis.fetch, token } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('A Fetch-compatible implementation is required.');
  const response = await fetchImpl(url, { method: 'GET', headers: authHeaders(token), redirect: 'error' });
  if (!response || typeof response.ok !== 'boolean') throw new Error('GitHub governance request returned an invalid response object.');
  if (!response.ok) {
    throw new Error(`GitHub governance request failed with HTTP ${response.status}.`);
  }
  return response.json();
}

export async function fetchRepositoryGovernance({
  repository = CANONICAL_REPOSITORY,
  branch = CANONICAL_BRANCH,
  token,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!exactRepositoryName(repository)) throw new Error('Repository must be a canonical owner/name value.');
  if (canonicalText(branch, { max: 128 }) === null || !/^[A-Za-z0-9._\/-]+$/.test(branch)) {
    throw new Error('Branch must be a canonical Git ref name without control characters.');
  }

  const encodedRepository = repository.split('/').map(encodeURIComponent).join('/');
  const encodedBranch = encodeURIComponent(branch);
  const base = `https://api.github.com/repos/${encodedRepository}`;
  const repositoryMetadata = await fetchJson(base, { fetchImpl, token });
  const branchMetadata = await fetchJson(`${base}/branches/${encodedBranch}`, { fetchImpl, token });
  const protection = await fetchJson(`${base}/branches/${encodedBranch}/protection`, { fetchImpl, token });
  const branchCommitSha = canonicalText(branchMetadata?.commit?.sha, { max: 64 });
  if (branchCommitSha === null || !/^[0-9a-f]{40}$/i.test(branchCommitSha)) {
    throw new Error('GitHub branch metadata does not expose a canonical commit SHA for required-check verification.');
  }
  const checkRuns = await fetchJson(
    `${base}/commits/${encodeURIComponent(branchCommitSha)}/check-runs?check_name=${encodeURIComponent(REQUIRED_STATUS_CHECK)}&filter=latest&per_page=100`,
    { fetchImpl, token },
  );

  return { repositoryMetadata, branchMetadata, protection, checkRuns };
}

function enabled(value) {
  return value === true || value?.enabled === true;
}

function providerPinnedRequiredStatusCheck(protection) {
  const required = protection?.required_status_checks;
  if (!required || required.strict !== true || !Array.isArray(required.checks)) return null;
  const matching = required.checks.filter((entry) => {
    const context = typeof entry?.context === 'string' ? entry.context.trim() : '';
    return context === REQUIRED_STATUS_CHECK && Number.isInteger(entry?.app_id) && entry.app_id > 0;
  });
  return matching.length === 1 ? matching[0] : null;
}

function hasMatchingSuccessfulLiveCheck(checkRuns, { expectedSha, expectedAppId }) {
  if (!checkRuns || typeof checkRuns !== 'object' || Array.isArray(checkRuns) || !Array.isArray(checkRuns.check_runs)) return false;
  return checkRuns.check_runs.some((run) => {
    const name = typeof run?.name === 'string' ? run.name.trim() : '';
    return name === REQUIRED_STATUS_CHECK
      && run?.head_sha === expectedSha
      && run?.status === 'completed'
      && run?.conclusion === 'success'
      && Number.isInteger(run?.app?.id)
      && run.app.id === expectedAppId;
  });
}

export function validateRepositoryGovernance(snapshot, {
  expectedRepository = CANONICAL_REPOSITORY,
  expectedBranch = CANONICAL_BRANCH,
} = {}) {
  const errors = [];
  const repository = snapshot?.repositoryMetadata;
  const branch = snapshot?.branchMetadata;
  const protection = snapshot?.protection;
  const checkRuns = snapshot?.checkRuns;

  if (!repository || typeof repository !== 'object' || Array.isArray(repository)) {
    return { ok: false, errors: ['GitHub repository metadata is missing or invalid.'] };
  }
  if (repository.full_name !== expectedRepository) errors.push(`Repository must be exactly ${expectedRepository}.`);
  if (repository.default_branch !== expectedBranch) errors.push(`Default branch must be exactly ${expectedBranch}.`);
  if (repository.archived === true || repository.disabled === true) errors.push('Release repository must be active and not archived or disabled.');

  const branchSha = canonicalText(branch?.commit?.sha, { max: 64 });
  if (!branch || typeof branch !== 'object' || Array.isArray(branch)) {
    errors.push('GitHub branch metadata is missing or invalid.');
  } else {
    if (branch.name !== expectedBranch) errors.push(`Validated branch must be exactly ${expectedBranch}.`);
    if (branch.protected !== true) errors.push(`${expectedBranch} must be protected before a market release.`);
    if (branchSha === null || !/^[0-9a-f]{40}$/i.test(branchSha)) errors.push(`${expectedBranch} must expose its exact commit SHA for required-check verification.`);
  }

  if (!protection || typeof protection !== 'object' || Array.isArray(protection)) {
    errors.push('Branch protection details are missing or invalid.');
  } else {
    const pinnedCheck = providerPinnedRequiredStatusCheck(protection);
    if (!pinnedCheck) {
      errors.push(
        `Branch protection must require exactly one canonical ${REQUIRED_STATUS_CHECK} check through GitHub's provider-pinned checks collection with a positive app_id, and require branches to be up to date before merging.`,
      );
    } else if (branchSha && /^[0-9a-f]{40}$/i.test(branchSha) && !hasMatchingSuccessfulLiveCheck(checkRuns, {
      expectedSha: branchSha,
      expectedAppId: pinnedCheck.app_id,
    })) {
      errors.push(`The exact ${expectedBranch} head must have a successful ${REQUIRED_STATUS_CHECK} check produced by the same GitHub App pinned in branch protection.`);
    }
    const reviews = protection.required_pull_request_reviews;
    if (!reviews || !Number.isInteger(reviews.required_approving_review_count) || reviews.required_approving_review_count < 1) {
      errors.push('Branch protection must require at least one approving pull-request review.');
    }
    if (!enabled(protection.enforce_admins)) errors.push('Branch protection must enforce protections for repository administrators.');
    if (!enabled(protection.required_conversation_resolution)) {
      errors.push('Branch protection must require conversation resolution before merging.');
    }
    if (enabled(protection.allow_force_pushes)) errors.push('Branch protection must not allow force pushes.');
    if (enabled(protection.allow_deletions)) errors.push('Branch protection must not allow branch deletion.');
  }

  return { ok: errors.length === 0, errors };
}

export async function runRepositoryGovernancePreflight({
  token = process.env.GITHUB_TOKEN,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (canonicalText(token, { max: 4096 }) === null) {
    throw new Error('GITHUB_TOKEN with read access to repository administration settings and checks is required for the market-release governance preflight.');
  }
  const snapshot = await fetchRepositoryGovernance({
    repository: CANONICAL_REPOSITORY,
    branch: CANONICAL_BRANCH,
    token,
    fetchImpl,
  });
  return validateRepositoryGovernance(snapshot, {
    expectedRepository: CANONICAL_REPOSITORY,
    expectedBranch: CANONICAL_BRANCH,
  });
}

async function runCli() {
  const result = await runRepositoryGovernancePreflight();
  if (!result.ok) {
    for (const error of result.errors) console.error(`ERROR: ${error}`);
    console.error(`Repository governance preflight failed with ${result.errors.length} error(s).`);
    process.exitCode = 1;
    return;
  }
  console.log('Repository governance preflight passed.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli().catch((error) => {
    console.error('ERROR: Repository governance preflight could not be completed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
