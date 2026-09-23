import { AVATAR_ALL_SLOTS } from './avatar-universe.domain';
import { AVATAR_ART_PIPELINE_STAGES, AvatarArtPipelineStage } from './avatar-art-production.domain';

export const AVATAR_CATALOG_PRODUCTION_TARGETS = {
  AVATAR_OUTFIT: 32,
  AVATAR_HAIR: 20,
  AVATAR_FOOTWEAR: 14,
  AVATAR_HEADWEAR: 10,
  AVATAR_BACK_ITEM: 8,
  AVATAR_HAND_ITEM: 8,
  AVATAR_WEAPON_STYLE: 8,
  AVATAR_SKIN: 8,
  AVATAR_FACE: 4,
  AVATAR_ACCESSORY: 4,
  AVATAR_AURA: 2,
  AVATAR_FRAME: 1,
  AVATAR_COMPANION: 1,
} as const satisfies Partial<Record<(typeof AVATAR_ALL_SLOTS)[number], number>>;

export const AVATAR_CATALOG_TARGET_COUNT = Object.values(AVATAR_CATALOG_PRODUCTION_TARGETS).reduce((sum, count) => sum + count, 0);

export type AvatarCatalogProductionEntry = {
  itemKey: string;
  slot: keyof typeof AVATAR_CATALOG_PRODUCTION_TARGETS;
  sourceAssetKey: string;
  variantKey: string;
  originalDesign: true;
  completedStages: AvatarArtPipelineStage[];
  runtimeGlbUri?: string;
  runtimeGlbSha256?: string;
  runtimeGlbBytes?: number;
  runtimeCertifiedAt?: string;
};

export type AvatarCatalogProductionPlan = {
  revision: string;
  entries: AvatarCatalogProductionEntry[];
};

const SAFE_KEY = /^[a-z0-9][a-z0-9._:-]{1,127}$/i;
const SHA256 = /^[a-f0-9]{64}$/i;
const RUNTIME_EVIDENCE_FIELDS = ['runtimeGlbUri', 'runtimeGlbSha256', 'runtimeGlbBytes', 'runtimeCertifiedAt'] as const;

function assertKey(value: string, label: string) {
  if (!SAFE_KEY.test(value)) throw new Error(`Invalid ${label}.`);
}

function hasAnyRuntimeEvidence(entry: AvatarCatalogProductionEntry) {
  return RUNTIME_EVIDENCE_FIELDS.some((field) => entry[field] !== undefined);
}

function hasCompleteRuntimeEvidence(entry: AvatarCatalogProductionEntry) {
  return Boolean(entry.runtimeGlbUri && entry.runtimeGlbSha256 && entry.runtimeCertifiedAt)
    && Number.isSafeInteger(entry.runtimeGlbBytes)
    && (entry.runtimeGlbBytes ?? 0) > 0;
}

export function isAvatarCatalogEntryRuntimeReady(entry: AvatarCatalogProductionEntry) {
  const completed = new Set(entry.completedStages);
  return AVATAR_ART_PIPELINE_STAGES.every((stage) => completed.has(stage)) && hasCompleteRuntimeEvidence(entry);
}

export function validateAvatarCatalogProductionPlan(plan: AvatarCatalogProductionPlan) {
  assertKey(plan.revision, 'catalog revision');
  if (plan.entries.length < AVATAR_CATALOG_TARGET_COUNT) {
    throw new Error(`Avatar catalog production plan requires at least ${AVATAR_CATALOG_TARGET_COUNT} entries.`);
  }

  const itemKeys = new Set<string>();
  const variantKeys = new Set<string>();
  const counts = new Map<string, number>();
  const allowedStages = new Set<string>(AVATAR_ART_PIPELINE_STAGES);

  for (const entry of plan.entries) {
    assertKey(entry.itemKey, 'catalog item key');
    assertKey(entry.sourceAssetKey, 'source asset key');
    assertKey(entry.variantKey, 'variant key');
    if (entry.originalDesign !== true) throw new Error(`Catalog item ${entry.itemKey} must be an original design.`);
    if (!AVATAR_ALL_SLOTS.includes(entry.slot as (typeof AVATAR_ALL_SLOTS)[number])) throw new Error(`Unknown Avatar Universe slot ${entry.slot}.`);
    if (itemKeys.has(entry.itemKey)) throw new Error(`Duplicate catalog item key ${entry.itemKey}.`);
    if (variantKeys.has(entry.variantKey)) throw new Error(`Duplicate catalog variant key ${entry.variantKey}.`);
    itemKeys.add(entry.itemKey);
    variantKeys.add(entry.variantKey);
    counts.set(entry.slot, (counts.get(entry.slot) ?? 0) + 1);

    const stageSet = new Set(entry.completedStages);
    if (stageSet.size !== entry.completedStages.length) throw new Error(`Catalog item ${entry.itemKey} repeats a production stage.`);
    const unknownStage = entry.completedStages.find((stage) => !allowedStages.has(stage));
    if (unknownStage) throw new Error(`Catalog item ${entry.itemKey} contains unknown production stage ${unknownStage}.`);

    if (hasAnyRuntimeEvidence(entry)) {
      if (!isAvatarCatalogEntryRuntimeReady(entry)) throw new Error(`Catalog item ${entry.itemKey} cannot claim runtime readiness before the complete art pipeline and GLB evidence are certified.`);
      const certifiedAt = Date.parse(entry.runtimeCertifiedAt!);
      if (!Number.isFinite(certifiedAt) || certifiedAt > Date.now() + 5 * 60 * 1000) throw new Error(`Invalid runtime certification timestamp for ${entry.itemKey}.`);
      if (!entry.runtimeGlbUri!.toLowerCase().endsWith('.glb')) throw new Error(`Catalog item ${entry.itemKey} runtime asset must be GLB.`);
      if (!SHA256.test(entry.runtimeGlbSha256!)) throw new Error(`Catalog item ${entry.itemKey} runtime GLB requires a valid SHA-256 digest.`);
    }
  }

  for (const [slot, target] of Object.entries(AVATAR_CATALOG_PRODUCTION_TARGETS)) {
    const actual = counts.get(slot) ?? 0;
    if (actual < target) throw new Error(`Avatar catalog slot ${slot} requires ${target} entries, found ${actual}.`);
  }

  return plan;
}
