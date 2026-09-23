import { AVATAR_ART_PIPELINE_STAGES } from './avatar-art-production.domain';
import {
  AVATAR_CATALOG_PRODUCTION_TARGETS,
  AVATAR_CATALOG_TARGET_COUNT,
  AvatarCatalogProductionEntry,
  isAvatarCatalogEntryRuntimeReady,
  validateAvatarCatalogProductionPlan,
} from './avatar-catalog-production.domain';

function makePlanEntries(): AvatarCatalogProductionEntry[] {
  return Object.entries(AVATAR_CATALOG_PRODUCTION_TARGETS).flatMap(([slot, target]) =>
    Array.from({ length: target }, (_, index) => ({
      itemKey: `${slot.toLowerCase()}.${index + 1}`,
      slot: slot as AvatarCatalogProductionEntry['slot'],
      sourceAssetKey: `source.${slot.toLowerCase()}.${index + 1}`,
      variantKey: `variant:${slot.toLowerCase()}:${index + 1}`,
      originalDesign: true as const,
      completedStages: [],
    })),
  );
}

describe('Avatar catalog production contract', () => {
  it('reserves a balanced production backlog of at least 100 original cosmetics', () => {
    expect(AVATAR_CATALOG_TARGET_COUNT).toBe(120);
    expect(AVATAR_CATALOG_PRODUCTION_TARGETS.AVATAR_OUTFIT).toBeGreaterThanOrEqual(30);
    expect(AVATAR_CATALOG_PRODUCTION_TARGETS.AVATAR_HAIR).toBeGreaterThanOrEqual(20);
    expect(validateAvatarCatalogProductionPlan({ revision: 'catalog.v1', entries: makePlanEntries() }).entries).toHaveLength(120);
  });

  it('rejects padding one category while leaving another below its production target', () => {
    const entries = makePlanEntries();
    const withoutHair = entries.filter((entry) => entry.slot !== 'AVATAR_HAIR');
    const padded = withoutHair.concat(
      Array.from({ length: 20 }, (_, index) => ({ ...withoutHair[index], itemKey: `padding.${index}`, variantKey: `padding:variant:${index}` })),
    );
    expect(() => validateAvatarCatalogProductionPlan({ revision: 'catalog.v1', entries: padded })).toThrow('AVATAR_HAIR requires 20');
  });

  it('rejects duplicate modular variants masquerading as separate catalog items', () => {
    const entries = makePlanEntries();
    entries[1] = { ...entries[1], variantKey: entries[0].variantKey };
    expect(() => validateAvatarCatalogProductionPlan({ revision: 'catalog.v1', entries })).toThrow('Duplicate catalog variant key');
  });

  it('does not treat concept or generated imagery as a runtime 3D asset', () => {
    const entry = makePlanEntries()[0];
    entry.completedStages = ['CONCEPT_MULTI_ANGLE'];
    entry.runtimeGlbUri = 'runtime/avatar/outfit.glb';
    entry.runtimeCertifiedAt = '2026-09-23T03:00:00.000Z';
    expect(isAvatarCatalogEntryRuntimeReady(entry)).toBe(false);
    expect(() => validateAvatarCatalogProductionPlan({ revision: 'catalog.v1', entries: [entry, ...makePlanEntries().slice(1)] })).toThrow('cannot claim runtime readiness');
  });

  it('requires the complete audited art pipeline before runtime readiness', () => {
    const entry = makePlanEntries()[0];
    entry.completedStages = [...AVATAR_ART_PIPELINE_STAGES];
    entry.runtimeGlbUri = 'runtime/avatar/outfit-001.glb';
    entry.runtimeCertifiedAt = '2026-09-23T03:00:00.000Z';
    expect(isAvatarCatalogEntryRuntimeReady(entry)).toBe(true);
    expect(validateAvatarCatalogProductionPlan({ revision: 'catalog.v1', entries: [entry, ...makePlanEntries().slice(1)] })).toBeDefined();
  });
});
