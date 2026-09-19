import {
  HERO_BLOCKOUT_REPORT_VERSION as V10_REPORT_VERSION,
  HERO_BLOCKOUT_ASSET_KEY,HERO_BLOCKOUT_BUDGETS,HERO_DNA_MORPH_NAMES,HERO_EXPRESSION_MORPH_NAMES,
  HeroBlockoutReport as HeroBlockoutReportV10,
  validateHeroBlockoutReport as validateV10,
} from './hero-blockout-report-v10.domain';

export const HERO_BLOCKOUT_REPORT_VERSION = 11 as const;
export const HERO_COMBINATION_CASE_NAMES = [
  'body_tall_broad','body_compact_hips','face_wide_smile','face_nose_pucker','face_eye_blink_brow','jaw_frown',
] as const;
export const HERO_MAX_COMBINED_VERTEX_DELTA_METERS = 0.42 as const;

export type HeroBlockoutReport = Omit<HeroBlockoutReportV10, 'reportVersion'> & {
  reportVersion: typeof HERO_BLOCKOUT_REPORT_VERSION;
  combinedDeformationsVerified: true;
  combinationCaseNames: string[];
  measuredCombinationCaseCount: number;
  measuredMaxCombinedVertexDeltaMeters: number;
  measuredMaxSelfIntersectionCount: number;
};

const V11_ONLY_KEYS = new Set([
  'combinedDeformationsVerified','combinationCaseNames','measuredCombinationCaseCount',
  'measuredMaxCombinedVertexDeltaMeters','measuredMaxSelfIntersectionCount',
]);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const safeInt = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export function validateHeroBlockoutReport(input: HeroBlockoutReport): HeroBlockoutReport {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error('Hero blockout report must be an object.');
  if (input.reportVersion !== HERO_BLOCKOUT_REPORT_VERSION) throw new Error('Unsupported Hero blockout report version.');
  const projected: Record<string, unknown> = {};
  for (const [key,value] of Object.entries(input)) if (!V11_ONLY_KEYS.has(key)) projected[key]=value;
  projected.reportVersion=V10_REPORT_VERSION;
  validateV10(projected as HeroBlockoutReportV10);

  if (input.combinedDeformationsVerified !== true) throw new Error('Hero combined deformation evidence is missing or unverified.');
  if (!Array.isArray(input.combinationCaseNames) ||
      input.combinationCaseNames.length !== HERO_COMBINATION_CASE_NAMES.length ||
      input.combinationCaseNames.some((name,index) => typeof name !== 'string' || name !== HERO_COMBINATION_CASE_NAMES[index])) {
    throw new Error('Hero combined deformation stress matrix is non-canonical.');
  }
  if (!safeInt(input.measuredCombinationCaseCount) || input.measuredCombinationCaseCount !== HERO_COMBINATION_CASE_NAMES.length) {
    throw new Error('Hero combined deformation case count is invalid.');
  }
  if (!finite(input.measuredMaxCombinedVertexDeltaMeters) || input.measuredMaxCombinedVertexDeltaMeters < 0 ||
      input.measuredMaxCombinedVertexDeltaMeters > HERO_MAX_COMBINED_VERTEX_DELTA_METERS) {
    throw new Error('Hero combined deformation exceeds the safe displacement budget.');
  }
  if (!safeInt(input.measuredMaxSelfIntersectionCount) || input.measuredMaxSelfIntersectionCount !== 0) {
    throw new Error('Hero combined deformation contains BODY self-intersections.');
  }
  return input;
}

export { HERO_BLOCKOUT_ASSET_KEY,HERO_BLOCKOUT_BUDGETS,HERO_DNA_MORPH_NAMES,HERO_EXPRESSION_MORPH_NAMES };
