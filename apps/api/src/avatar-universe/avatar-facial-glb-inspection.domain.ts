import { AvatarGlbInspection } from './avatar-glb-inspection.domain';
import { auditAvatarFacialGlb, FacialGltf } from './avatar-facial-glb-audit.domain';

export type AvatarFacialInspectionFields = Pick<
  AvatarGlbInspection,
  | 'facialValid'
  | 'facialIssues'
  | 'expressionTargets'
  | 'expressionMeshIndices'
  | 'expressionTargetCount'
  | 'facialWeightChannelCount'
>;

/**
 * Converts the mesh-bound facial audit into the exact proof fields consumed by
 * validateAvatarGlbInspection(). Keeping this adapter separate prevents the GLB
 * parser from re-implementing facial certification or drifting from the gate.
 */
export function inspectAvatarFacialGlb(gltf: FacialGltf): AvatarFacialInspectionFields {
  const audit = auditAvatarFacialGlb(gltf);
  return {
    facialValid: audit.valid,
    facialIssues: audit.issues,
    expressionTargets: audit.expressionTargets,
    expressionMeshIndices: audit.expressionMeshIndices,
    expressionTargetCount: audit.expressionTargetCount,
    facialWeightChannelCount: audit.facialWeightChannelCount,
  };
}
