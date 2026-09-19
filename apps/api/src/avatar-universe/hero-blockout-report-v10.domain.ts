import {
  HERO_BLOCKOUT_REPORT_VERSION as V9_REPORT_VERSION,
  HERO_BLOCKOUT_BUDGETS,
  HERO_DNA_MORPH_NAMES,
  HeroBlockoutReport as HeroBlockoutReportV9,
  validateHeroBlockoutReport as validateV9,
} from './hero-blockout-report.domain';

export const HERO_BLOCKOUT_REPORT_VERSION = 10 as const;
export const HERO_EXPRESSION_MORPH_NAMES = [
  'expr_blink_l','expr_blink_r','expr_brow_up_l','expr_brow_up_r','expr_smile_l',
  'expr_smile_r','expr_frown_l','expr_frown_r','expr_jaw_open','expr_mouth_pucker',
] as const;
export const HERO_MAX_EXPRESSION_VERTEX_DELTA_METERS = 0.12 as const;

export type HeroBlockoutReport = Omit<HeroBlockoutReportV9, 'reportVersion'> & {
  reportVersion: typeof HERO_BLOCKOUT_REPORT_VERSION;
  expressionsVerified: true;
  expressionMorphNames: string[];
  measuredExpressionMorphCount: number;
  measuredMaxExpressionVertexDeltaMeters: number;
};

const V10_ONLY_KEYS = new Set([
  'expressionsVerified','expressionMorphNames','measuredExpressionMorphCount',
  'measuredMaxExpressionVertexDeltaMeters',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/**
 * v10 transition gate. Reuses the audited v9 geometry/PBR/skinning/DNA gate by
 * projecting the report to its exact v9 schema, then validates the new facial
 * expression evidence independently. Client-supplied unknown fields remain
 * rejected by the v9 exact-key boundary rather than being silently ignored.
 */
export function validateHeroBlockoutReport(input: HeroBlockoutReport): HeroBlockoutReport {
  if (!isRecord(input)) throw new Error('Hero blockout report must be an object.');
  if (input.reportVersion !== HERO_BLOCKOUT_REPORT_VERSION) throw new Error('Unsupported Hero blockout report version.');

  const projected: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!V10_ONLY_KEYS.has(key)) projected[key] = value;
  }
  projected.reportVersion = V9_REPORT_VERSION;
  validateV9(projected as HeroBlockoutReportV9);

  if (input.expressionsVerified !== true) throw new Error('Hero facial expression evidence is missing or unverified.');
  if (!Array.isArray(input.expressionMorphNames) || input.expressionMorphNames.some(name => typeof name !== 'string')) {
    throw new Error('Hero facial expression morph names are malformed.');
  }
  if (!isSafeNonNegativeInteger(input.measuredExpressionMorphCount) ||
      input.measuredExpressionMorphCount !== HERO_EXPRESSION_MORPH_NAMES.length ||
      input.expressionMorphNames.length !== HERO_EXPRESSION_MORPH_NAMES.length ||
      input.expressionMorphNames.some((name, index) => name !== HERO_EXPRESSION_MORPH_NAMES[index])) {
    throw new Error('Hero facial expression morph evidence is non-canonical.');
  }
  if (!isFiniteNumber(input.measuredMaxExpressionVertexDeltaMeters) ||
      input.measuredMaxExpressionVertexDeltaMeters <= 0 ||
      input.measuredMaxExpressionVertexDeltaMeters > HERO_MAX_EXPRESSION_VERTEX_DELTA_METERS) {
    throw new Error('Hero facial expression deformation evidence is empty or outside the safe facial budget.');
  }
  return input;
}

export { HERO_BLOCKOUT_ASSET_KEY, HERO_DNA_MORPH_NAMES, HERO_BLOCKOUT_BUDGETS } from './hero-blockout-report.domain';
