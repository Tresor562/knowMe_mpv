import { AVATAR_ART_PIPELINE_STAGES } from './avatar-art-production.domain';
import { AvatarCatalogProductionEntry, isAvatarCatalogEntryRuntimeReady } from './avatar-catalog-production.domain';

function certifiedEntry(): AvatarCatalogProductionEntry {
  return {
    itemKey: 'avatar_outfit.hero.001', slot: 'AVATAR_OUTFIT', sourceAssetKey: 'source.avatar_outfit.hero.001', variantKey: 'variant:avatar_outfit:hero:001', originalDesign: true,
    completedStages: [...AVATAR_ART_PIPELINE_STAGES], runtimeGlbUri: 'runtime/avatar/outfit-hero-001.glb', runtimeGlbSha256: 'a'.repeat(64), runtimeGlbBytes: 1_048_576,
    runtimeCertifiedAt: '2026-09-23T10:00:00.000Z', runtimeManifestSha256: 'b'.repeat(64),
  };
}

describe('Avatar catalog runtime readiness authority', () => {
  it('accepts only complete canonical production plus immutable GLB and manifest evidence', () => { expect(isAvatarCatalogEntryRuntimeReady(certifiedEntry())).toBe(true); });
  it.each([
    ['external URI', { runtimeGlbUri: 'https://cdn.example.com/avatar/outfit.glb' }], ['path traversal', { runtimeGlbUri: 'runtime/avatar/../private/outfit.glb' }],
    ['query-swappable URI', { runtimeGlbUri: 'runtime/avatar/outfit.glb?asset=other' }], ['fragment-swappable URI', { runtimeGlbUri: 'runtime/avatar/outfit.glb#other' }],
    ['malformed GLB digest', { runtimeGlbSha256: 'client-supplied-digest' }], ['missing manifest digest', { runtimeManifestSha256: undefined }],
    ['malformed manifest digest', { runtimeManifestSha256: 'client-manifest' }], ['zero byte payload', { runtimeGlbBytes: 0 }],
    ['invalid certification time', { runtimeCertifiedAt: 'not-a-date' }], ['future certification time', { runtimeCertifiedAt: '2099-01-01T00:00:00.000Z' }],
  ])('rejects %s directly at the runtime-ready predicate', (_label, patch) => { expect(isAvatarCatalogEntryRuntimeReady({ ...certifiedEntry(), ...patch })).toBe(false); });
  it('rejects incomplete or reordered artistic production even with otherwise valid evidence', () => {
    const incomplete = certifiedEntry(); incomplete.completedStages = incomplete.completedStages.slice(0, -1); expect(isAvatarCatalogEntryRuntimeReady(incomplete)).toBe(false);
    const reordered = certifiedEntry(); [reordered.completedStages[0], reordered.completedStages[1]] = [reordered.completedStages[1], reordered.completedStages[0]]; expect(isAvatarCatalogEntryRuntimeReady(reordered)).toBe(false);
  });
});
