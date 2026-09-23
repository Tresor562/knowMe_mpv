import { AVATAR_ART_PIPELINE_STAGES } from './avatar-art-production.domain';
import {
  AvatarCatalogProductionEntry,
  isAvatarCatalogEntryRuntimeReady,
} from './avatar-catalog-production.domain';

describe('Avatar catalog certification binding', () => {
  const entry: AvatarCatalogProductionEntry = {
    itemKey: 'outfit.hero.001',
    slot: 'AVATAR_OUTFIT',
    sourceAssetKey: 'hero-outfit-source',
    variantKey: 'hero-outfit-variant',
    originalDesign: true,
    completedStages: [...AVATAR_ART_PIPELINE_STAGES],
    runtimeGlbUri: 'runtime/avatar/outfit-hero-001.glb',
    runtimeGlbSha256: 'a'.repeat(64),
    runtimeGlbBytes: 1024,
    runtimeCertifiedAt: '2026-09-23T12:00:00.000Z',
  };

  it('does not accept runtime readiness without an immutable certified manifest binding', () => {
    expect(isAvatarCatalogEntryRuntimeReady(entry)).toBe(false);
  });
});
