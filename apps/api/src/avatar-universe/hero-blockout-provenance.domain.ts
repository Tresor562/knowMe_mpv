import { createHash } from 'node:crypto';
import { HeroBlockoutReport, validateHeroBlockoutReport } from './hero-blockout-report-v11.domain';

export const HERO_BLOCKOUT_PROVENANCE_VERSION = 1 as const;
export type HeroBlockoutSourceFormat = 'BLEND' | 'GLB' | 'GLTF' | 'FBX' | 'OBJ';
export type HeroBlockoutProvenance = {
  version: typeof HERO_BLOCKOUT_PROVENANCE_VERSION;
  report: HeroBlockoutReport;
  sourceFormat: HeroBlockoutSourceFormat;
  sourceSha256: string;
  exporter: string;
  exportedAt: string;
};

const SHA256 = /^[a-f0-9]{64}$/;
const SAFE_EXPORTER = /^[A-Za-z0-9][A-Za-z0-9 ._+()/-]{1,95}$/;

export function sha256Hex(bytes: Buffer | Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function validateHeroBlockoutProvenance(input: HeroBlockoutProvenance): HeroBlockoutProvenance {
  if (input.version !== HERO_BLOCKOUT_PROVENANCE_VERSION) throw new Error('Unsupported Hero blockout provenance version.');
  validateHeroBlockoutReport(input.report);
  if (!['BLEND','GLB','GLTF','FBX','OBJ'].includes(input.sourceFormat)) throw new Error('Unsupported Hero blockout source format.');
  if (!SHA256.test(input.sourceSha256)) throw new Error('Hero blockout source requires a lowercase SHA-256 digest.');
  if (!SAFE_EXPORTER.test(input.exporter)) throw new Error('Invalid Hero blockout exporter identity.');
  const exportedAt = new Date(input.exportedAt);
  if (!Number.isFinite(exportedAt.getTime()) || exportedAt.toISOString() !== input.exportedAt) throw new Error('Hero blockout exportedAt must be canonical ISO-8601 UTC.');
  if (exportedAt.getTime() > Date.now() + 5 * 60_000) throw new Error('Hero blockout export timestamp cannot be in the future.');
  return input;
}

export function verifyHeroBlockoutSource(bytes: Buffer | Uint8Array, provenance: HeroBlockoutProvenance): HeroBlockoutProvenance {
  validateHeroBlockoutProvenance(provenance);
  if (sha256Hex(bytes) !== provenance.sourceSha256) throw new Error('Hero blockout source digest mismatch.');
  return provenance;
}
