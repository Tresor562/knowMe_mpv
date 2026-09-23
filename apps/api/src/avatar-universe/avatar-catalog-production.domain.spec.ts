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

function certify(entry: AvatarCatalogProductionEntry): AvatarCatalogProductionEntry {
  return {
    ...entry,
    completedStages: [...AVATAR_ART_PIPELINE_STAGES],
    runtimeGlbUri: 'runtime/avatar/outfit-001.glb',
    runtimeGlbSha256: 'a'.repeat(64),
    runtimeGlbBytes: 1_048_576,
    runtimeCertifiedAt: '2026-09-23T03:00:00.000Z',
  };
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

  it('requires the complete audited art pipeline and immutable GLB evidence before runtime readiness', () => {
    const entry = certify(makePlanEntries()[0]);
    expect(isAvatarCatalogEntryRuntimeReady(entry)).toBe(true);
    expect(validateAvatarCatalogProductionPlan({ revision: 'catalog.v1', entries: [entry, ...makePlanEntries().slice(1)] })).toBeDefined();
  });

  it('rejects runtime certification without a GLB digest or byte size', () => {
    const entry = certify(makePlanEntries()[0]);
    delete entry.runtimeGlbSha256;
    expect(isAvatarCatalogEntryRuntimeReady(entry)).toBe(false);
    expect(() => validateAvatarCatalogProductionPlan({ revision: 'catalog.v1', entries: [entry, ...makePlanEntries().slice(1)] })).toThrow('cannot claim runtime readiness');

    const invalidBytes = certify(makePlanEntries()[0]);
    invalidBytes.runtimeGlbBytes = 0;
    expect(() => validateAvatarCatalogProductionPlan({ revision: 'catalog.v1', entries: [invalidBytes, ...makePlanEntries().slice(1)] })).toThrow('cannot claim runtime readiness');
  });

  it('rejects malformed SHA-256 evidence and unknown pipeline stages at runtime boundaries', () => {
    const malformedDigest = certify(makePlanEntries()[0]);
    malformedDigest.runtimeGlbSha256 = 'not-a-digest';
    expect(() => validateAvatarCatalogProductionPlan({ revision: 'catalog.v1', entries: [malformedDigest, ...makePlanEntries().slice(1)] })).toThrow('valid SHA-256 digest');

    const unknownStage = makePlanEntries()[0] as AvatarCatalogProductionEntry & { completedStages: string[] };
    unknownStage.completedStages = ['CONCEPT_MULTI_ANGLE', 'AI_IMAGE_IS_FINAL_ASSET'];
    expect(() => validateAvatarCatalogProductionPlan({ revision: 'catalog.v1', entries: [unknownStage as AvatarCatalogProductionEntry, ...makePlanEntries().slice(1)] })).toThrow('unknown production stage');
  });

  it('requires production stages to form the canonical prefix instead of skipping artistic gates', () => {
    const entries = makePlanEntries();
    const skipped = { ...entries[0], completedStages: [AVATAR_ART_PIPELINE_STAGES[0], AVATAR_ART_PIPELINE_STAGES[2]] } as AvatarCatalogProductionEntry;
    expect(() => validateAvatarCatalogProductionPlan({ revision: 'catalog.v1', entries: [skipped, ...entries.slice(1)] })).toThrow('canonical order without skipping gates');

    const reordered = certify(entries[0]);
    [reordered.completedStages[0], reordered.completedStages[1]] = [reordered.completedStages[1], reordered.completedStages[0]];
    expect(isAvatarCatalogEntryRuntimeReady(reordered)).toBe(false);
    expect(() => validateAvatarCatalogProductionPlan({ revision: 'catalog.v1', entries: [reordered, ...entries.slice(1)] })).toThrow('canonical order without skipping gates');
  });

  it('keeps certified GLBs inside the controlled runtime asset root', () => {
    for (const unsafeUri of [
      'https://cdn.example.com/avatar/outfit.glb',
      'runtime/avatar/../private/outfit.glb',
      'runtime/avatar/outfit.glb?version=2',
      'runtime/avatar/outfit.glb#tampered',
      'runtime\\avatar\\outfit.glb',
    ]) {
      const entry = certify(makePlanEntries()[0]);
      entry.runtimeGlbUri = unsafeUri;
      expect(() => validateAvatarCatalogProductionPlan({ revision: 'catalog.v1', entries: [entry, ...makePlanEntries().slice(1)] })).toThrow('internal GLB under runtime/avatar/');
    }
  });
});
