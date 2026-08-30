import test from 'node:test';
import assert from 'node:assert/strict';
import './kmd-delivery-registry-preflight.test.mjs';

import {
  fetchRepositoryGovernance,
  runRepositoryGovernancePreflight,
  validateRepositoryGovernance,
} from './github-release-governance-preflight.mjs';

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
    },
    protection: {
      required_status_checks: {
        strict: true,
        contexts: ['quality'],
        checks: [],
      },
      required_pull_request_reviews: {
        required_approving_review_count: 1,
      },
      enforce_admins: { enabled: true },
      required_conversation_resolution: { enabled: true },
      allow_force_pushes: { enabled: false },
      allow_deletions: { enabled: false },
    },
  };
}

test('accepts repository governance that enforces the market-release baseline', () => {
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
  assert.match(result.errors.join('\n'), /canonical quality status check/);
  assert.match(result.errors.join('\n'), /approving pull-request review/);
  assert.match(result.errors.join('\n'), /administrators/);
  assert.match(result.errors.join('\n'), /conversation resolution/);
  assert.match(result.errors.join('\n'), /force pushes/);
  assert.match(result.errors.join('\n'), /branch deletion/);
});

test('rejects a strict but unrelated status check instead of accepting a governance decoy', () => {
  const snapshot = passingSnapshot();
  snapshot.protection.required_status_checks.contexts = ['documentation-only'];
  snapshot.protection.required_status_checks.checks = [{ context: 'noop' }];

  const result = validateRepositoryGovernance(snapshot);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /canonical quality status check/);
});

test('accepts the canonical quality check from the modern checks collection', () => {
  const snapshot = passingSnapshot();
  snapshot.protection.required_status_checks.contexts = [];
  snapshot.protection.required_status_checks.checks = [{ context: 'quality', app_id: 15368 }];

  const result = validateRepositoryGovernance(snapshot);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test('rejects repository or default-branch identity drift', () => {
  const snapshot = passingSnapshot();
  snapshot.repositoryMetadata.full_name = 'someone/fork';
  snapshot.repositoryMetadata.default_branch = 'develop';
  snapshot.branchMetadata.name = 'develop';

  const result = validateRepositoryGovernance(snapshot);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /Repository must be exactly Tresor562\/knowMe_mpv/);
  assert.match(result.errors.join('\n'), /Default branch must be exactly main/);
  assert.match(result.errors.join('\n'), /Validated branch must be exactly main/);
});

test('fetches repository, branch and protection endpoints without following redirects', async () => {
  const requested = [];
  const payloads = [
    passingSnapshot().repositoryMetadata,
    passingSnapshot().branchMetadata,
    passingSnapshot().protection,
  ];
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

  assert.equal(requested.length, 3);
  assert.deepEqual(
    requested.map((entry) => entry.url),
    [
      'https://api.github.com/repos/Tresor562/knowMe_mpv',
      'https://api.github.com/repos/Tresor562/knowMe_mpv/branches/main',
      'https://api.github.com/repos/Tresor562/knowMe_mpv/branches/main/protection',
    ],
  );
  for (const entry of requested) {
    assert.equal(entry.options.method, 'GET');
    assert.equal(entry.options.redirect, 'error');
    assert.equal(entry.options.headers.Authorization, 'Bearer test-token');
  }
  assert.equal(result.branchMetadata.protected, true);
});

test('live market preflight pins the canonical repository and branch', async () => {
  const requested = [];
  const payloads = [
    passingSnapshot().repositoryMetadata,
    passingSnapshot().branchMetadata,
    passingSnapshot().protection,
  ];
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
  assert.deepEqual(requested, [
    'https://api.github.com/repos/Tresor562/knowMe_mpv',
    'https://api.github.com/repos/Tresor562/knowMe_mpv/branches/main',
    'https://api.github.com/repos/Tresor562/knowMe_mpv/branches/main/protection',
  ]);
});

test('live market preflight fails closed without an authenticated governance token', async () => {
  await assert.rejects(
    runRepositoryGovernancePreflight({ token: '', fetchImpl: async () => assert.fail('fetch must not run without a token') }),
    /GITHUB_TOKEN with read access to repository administration settings is required/,
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
