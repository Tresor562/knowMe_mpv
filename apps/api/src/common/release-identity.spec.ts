import { resolveRuntimeReleaseIdentity } from './release-identity';

describe('resolveRuntimeReleaseIdentity', () => {
  const commit = 'a'.repeat(40);

  it('returns configured canonical identity outside production', () => {
    expect(
      resolveRuntimeReleaseIdentity({
        NODE_ENV: 'test',
        KNOWME_RELEASE_COMMIT: commit,
        KNOWME_RELEASE_VERSION: '1.2.3-rc.1',
      }),
    ).toEqual({ commit, version: '1.2.3-rc.1' });
  });

  it('keeps release identity optional outside production', () => {
    expect(resolveRuntimeReleaseIdentity({ NODE_ENV: 'test' })).toEqual({
      commit: null,
      version: null,
    });
  });

  it('fails production closed when commit is missing or non-canonical', () => {
    expect(() =>
      resolveRuntimeReleaseIdentity({
        NODE_ENV: 'production',
        KNOWME_RELEASE_VERSION: '1.2.3',
      }),
    ).toThrow('KNOWME_RELEASE_COMMIT');

    expect(() =>
      resolveRuntimeReleaseIdentity({
        NODE_ENV: 'production',
        KNOWME_RELEASE_COMMIT: commit.toUpperCase(),
        KNOWME_RELEASE_VERSION: '1.2.3',
      }),
    ).toThrow('KNOWME_RELEASE_COMMIT');
  });

  it('fails production closed when version is missing or non-canonical', () => {
    expect(() =>
      resolveRuntimeReleaseIdentity({
        NODE_ENV: 'production',
        KNOWME_RELEASE_COMMIT: commit,
      }),
    ).toThrow('KNOWME_RELEASE_VERSION');

    for (const version of ['v1.2.3', '01.2.3', '1.2.3+build.1', ' 1.2.3']) {
      expect(() =>
        resolveRuntimeReleaseIdentity({
          NODE_ENV: 'production',
          KNOWME_RELEASE_COMMIT: commit,
          KNOWME_RELEASE_VERSION: version,
        }),
      ).toThrow('KNOWME_RELEASE_VERSION');
    }
  });

  it('accepts canonical production release candidates', () => {
    expect(
      resolveRuntimeReleaseIdentity({
        NODE_ENV: 'production',
        KNOWME_RELEASE_COMMIT: commit,
        KNOWME_RELEASE_VERSION: '2.0.0-rc.1',
      }),
    ).toEqual({ commit, version: '2.0.0-rc.1' });
  });
});
