import test from 'node:test';
import assert from 'node:assert/strict';
import './kmd-delivery-registry-preflight.test.mjs';

import {
  fetchRepositoryGovernance,
  runRepositoryGovernancePreflight,
  validateRepositoryGovernance,
} from './github-release-governance-preflight.mjs';

const MAIN_SHA = '1111111111111111111111111111111111111111';
const QUALITY_APP_ID = 12345;

function passingSnapshot() {
  return {
    repositoryMetadata: {
      full_name: 'Tresor562/knowMe_mpv',
      default_branch: 'main',
      archived: false,
      disabled: false,
    },
    branchMetadata: {
      name: 'main',
      protected: true,
      commit: { sha: MAIN_SHA },
    },
    protection: {
      required_status_checks: {
        strict: true,
        contexts: [],
        checks: [{ context: 'quality', app_id: QUALITY_APP_ID }],
      },
      required_pull_request_reviews: {
        required_approving_review_count: 1,
      },
      enforce_admins: { enabled: true },
      required_conversation_resolution: { enabled: true },
      allow_force_pushes: { enabled: false },
      allow_deletions: { enabled: false },
    },
    checkRuns: {
      total_count: 1,
      check_runs: [{
        name: 'quality',
        head_sha: MAIN_SHA,
        status: 'completed',
        conclusion: 'success',
        app: { id: QUALITY_APP_ID },
      }],
    },
  };
}

test('accepts repository governance that binds the live quality check to the pinned provider', () => {
  const result = validateRepositoryGovernance(passingSnapshot());
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('fails closed when main is unprotected or review/status protections are weak', () => {
  const snapshot = passingSnapshot();
  snapshot.branchMetadata.protected = false;
  snapshot.protection.required_status_checks.strict = false;
  snapshot.protection.required_pull_request_reviews.required_approving_review_count = 0;
  snapshot.protection.enforce_admins.enabled = false;
  snapshot.protection.required_conversation_resolution.enabled = false;
  snapshot.protection.allow_force_pushes.enabled = true;
  snapshot.protection.allow_deletions.enabled = true;

  const result = validateRepositoryGovernance(snapshot);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /main must be protected/);
  assert.match(result.errors.join('\n'), /provider-pinned checks collection/);
  assert.match(result.errors.join('\n'), /approving pull-request review/);
  assert.match(result.errors.join('\n'), /administrators/);
  assert.match(result.errors.join('\n'), /conversation resolution/);
  assert.match(result.errors.join('\n'), /force pushes/);
  assert.match(result.errors.join('\n'), /branch deletion/);
});

test('rejects a strict but unrelated status check instead of accepting a governance decoy', () => {
  const snapshot = passingSnapshot();
  snapshot.protection.required_status_checks.checks = [{ context: 'documentation-only', app_id: QUALITY_APP_ID }];

  const result = validateRepositoryGovernance(snapshot);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /canonical quality check/);
});

test('rejects legacy contexts-only quality because provider provenance is not explicit', () => {
  const snapshot = passingSnapshot();
  snapshot.protection.required_status_checks.contexts = ['quality'];
  snapshot.protection.required_status_checks.checks = [];

  const result = validateRepositoryGovernance(snapshot);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /provider-pinned checks collection/);
});

test('rejects quality when any application is explicitly allowed to provide it', () => {
  const snapshot = passingSnapshot();
  snapshot.protection.required_status_checks.checks = [{ context: 'quality', app_id: -1 }];

  const result = validateRepositoryGovernance(snapshot);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /positive app_id/);
});

test('rejects quality without an app id instead of assuming provider provenance', () => {
  const snapshot = passingSnapshot();
  snapshot.protection.required_status_checks.checks = [{ context: 'quality' }];

  const result = validateRepositoryGovernance(snapshot);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /positive app_id/);
});

test('rejects duplicate provider-pinned quality entries because provenance must be unambiguous', () => {
  const snapshot = passingSnapshot();
  snapshot.protection.required_status_checks.checks = [
    { context: 'quality', app_id: QUALITY_APP_ID },
    { context: 'quality', app_id: 98765 },
  ];

  const result = validateRepositoryGovernance(snapshot);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /exactly one canonical quality check/);
});

test('rejects a successful quality check from a different app than branch protection pins', () => {
  const snapshot = passingSnapshot();
  snapshot.checkRuns.check_runs[0].app.id = 98765;

  const result = validateRepositoryGovernance(snapshot);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /same GitHub App pinned in branch protection/);
});

test('rejects a quality check that succeeded on a different commit', () => {
  const snapshot = passingSnapshot();
  snapshot.checkRuns.check_runs[0].head_sha = '2222222222222222222222222222222222222222';

  const result = validateRepositoryGovernance(snapshot);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /exact main head/);
});

test('rejects incomplete or unsuccessful quality on the exact head', () => {
  const snapshot = passingSnapshot();
  snapshot.checkRuns.check_runs[0].conclusion = 'failure';

  const result = validateRepositoryGovernance(snapshot);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /successful quality check/);
});

test('rejects repository, default-branch or branch-head identity drift', () => {
  const snapshot = passingSnapshot();
  snapshot.repositoryMetadata.full_name = 'someone/fork';
  snapshot.repositoryMetadata.default_branch = 'develop';
  snapshot.branchMetadata.name = 'develop';
  snapshot.branchMetadata.commit.sha = 'not-a-sha';

  const result = validateRepositoryGovernance(snapshot);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Repository must be exactly Tresor562\/knowMe_mpv/);
  assert.match(result.errors.join('\n'), /Default branch must be exactly main/);
  assert.match(result.errors.join('\n'), /Validated branch must be exactly main/);
  assert.match(result.errors.join('\n'), /exact commit SHA/);
});

test('fetches repository, branch, protection and exact-head quality checks without following redirects', async () => {
  const requested = [];
  const snapshot = passingSnapshot();
  const payloads = [snapshot.repositoryMetadata, snapshot.branchMetadata, snapshot.protection, snapshot.checkRuns];
  const fetchImpl = async (url, options) => {
    requested.push({ url, options });
    return {
      ok: true,
      status: 200,
      async json() {
        return payloads.shift();
      },
    };
  };

  const result = await fetchRepositoryGovernance({
    repository: 'Tresor562/knowMe_mpv',
    branch: 'main',
    token: 'test-token',
    fetchImpl,
  });

  assert.equal(requested.length, 4);
  assert.deepEqual(
    requested.map((entry) => entry.url),
    [
      'https://api.github.com/repos/Tresor562/knowMe_mpv',
      'https://api.github.com/repos/Tresor562/knowMe_mpv/branches/main',
      'https://api.github.com/repos/Tresor562/knowMe_mpv/branches/main/protection',
      `https://api.github.com/repos/Tresor562/knowMe_mpv/commits/${MAIN_SHA}/check-runs?check_name=quality&filter=latest&per_page=100`,
    ],
  );
  for (const entry of requested) {
    assert.equal(entry.options.method, 'GET');
    assert.equal(entry.options.redirect, 'error');
    assert.equal(entry.options.headers.Authorization, 'Bearer test-token');
  }
  assert.equal(result.branchMetadata.protected, true);
  assert.equal(result.checkRuns.check_runs[0].app.id, QUALITY_APP_ID);
});

test('live market preflight pins the canonical repository, branch and live quality provenance', async () => {
  const requested = [];
  const snapshot = passingSnapshot();
  const payloads = [snapshot.repositoryMetadata, snapshot.branchMetadata, snapshot.protection, snapshot.checkRuns];
  const fetchImpl = async (url) => {
    requested.push(url);
    return {
      ok: true,
      status: 200,
      async json() {
        return payloads.shift();
      },
    };
  };

  const result = await runRepositoryGovernancePreflight({ token: 'read-only-token', fetchImpl });
  assert.equal(result.ok, true);
  assert.equal(requested.length, 4);
  assert.match(requested[3], new RegExp(`/commits/${MAIN_SHA}/check-runs\\?`));
});

test('fetch fails closed when branch metadata omits an exact commit SHA', async () => {
  const snapshot = passingSnapshot();
  delete snapshot.branchMetadata.commit;
  const payloads = [snapshot.repositoryMetadata, snapshot.branchMetadata, snapshot.protection];
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    async json() {
      return payloads.shift();
    },
  });

  await assert.rejects(
    fetchRepositoryGovernance({ token: 'token', fetchImpl }),
    /does not expose a canonical commit SHA/,
  );
});

test('live market preflight fails closed without an authenticated governance token', async () => {
  await assert.rejects(
    runRepositoryGovernancePreflight({ token: '', fetchImpl: async () => assert.fail('fetch must not run without a token') }),
    /GITHUB_TOKEN with read access to repository administration settings and checks is required/,
  );
});

test('fails closed when GitHub refuses a governance endpoint', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 404,
    async json() {
      return {};
    },
  });

  await assert.rejects(
    fetchRepositoryGovernance({ fetchImpl }),
    /GitHub governance request failed with HTTP 404/,
  );
});
