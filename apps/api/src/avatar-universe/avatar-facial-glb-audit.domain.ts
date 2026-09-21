import { AVATAR_EXPRESSION_BLENDSHAPES } from './avatar-facial-expression.domain';

export type FacialGltf = {
  meshes?: Array<{ extras?: { targetNames?: string[] }; primitives?: Array<{ targets?: Array<Record<string, number>> }> }>;
  nodes?: Array<{ mesh?: number }>;
  animations?: Array<{ channels?: Array<{ target?: { node?: number; path?: string } }> }>;
};

export type AvatarFacialGlbAudit = {
  valid: boolean;
  issues: string[];
  expressionTargets: string[];
  expressionMeshIndices: number[];
  expressionTargetCount: number;
  facialWeightChannelCount: number;
};

const EXPRESSION_SET = new Set<string>(AVATAR_EXPRESSION_BLENDSHAPES);

/**
 * Certifies facial morphs against the mesh actually targeted by glTF weight channels.
 * This deliberately does not trust a file-global union of target names: an expression
 * name present on an unrelated mesh cannot satisfy the facial runtime contract.
 */
export function auditAvatarFacialGlb(gltf: FacialGltf): AvatarFacialGlbAudit {
  const issues: string[] = [];
  const expressionTargets = new Set<string>();
  const expressionMeshes = new Set<number>();
  const meshTargetNames = new Map<number, string[]>();

  for (let meshIndex = 0; meshIndex < (gltf.meshes?.length ?? 0); meshIndex++) {
    const mesh = gltf.meshes![meshIndex];
    const names = mesh.extras?.targetNames;
    const primitives = mesh.primitives ?? [];
    const targetCounts = primitives.map((primitive) => primitive.targets?.length ?? 0);
    const maxTargets = targetCounts.length ? Math.max(...targetCounts) : 0;
    if (maxTargets === 0) continue;
    if (!names || names.length !== maxTargets) {
      issues.push(`Mesh ${meshIndex} morph target names do not match its primitive target count.`);
      continue;
    }
    if (new Set(names).size !== names.length) issues.push(`Mesh ${meshIndex} has duplicate morph target names.`);
    for (const count of targetCounts) if (count !== 0 && count !== names.length) issues.push(`Mesh ${meshIndex} primitives disagree on morph target layout.`);
    meshTargetNames.set(meshIndex, names);
    if (names.some((name) => EXPRESSION_SET.has(name))) {
      expressionMeshes.add(meshIndex);
      for (const name of names) if (EXPRESSION_SET.has(name)) expressionTargets.add(name);
    }
  }

  let facialWeightChannelCount = 0;
  for (let animationIndex = 0; animationIndex < (gltf.animations?.length ?? 0); animationIndex++) {
    for (const channel of gltf.animations![animationIndex].channels ?? []) {
      if (channel.target?.path !== 'weights') continue;
      const nodeIndex = channel.target.node;
      if (!Number.isSafeInteger(nodeIndex) || nodeIndex! < 0 || nodeIndex! >= (gltf.nodes?.length ?? 0)) {
        issues.push(`Animation ${animationIndex} has a weights channel with an invalid node.`);
        continue;
      }
      const meshIndex = gltf.nodes![nodeIndex!]?.mesh;
      if (!Number.isSafeInteger(meshIndex) || !meshTargetNames.has(meshIndex!)) {
        issues.push(`Animation ${animationIndex} weights channel targets a node without certified morph targets.`);
        continue;
      }
      if (expressionMeshes.has(meshIndex!)) facialWeightChannelCount++;
    }
  }

  if (expressionTargets.size > 0) {
    for (const expression of AVATAR_EXPRESSION_BLENDSHAPES) {
      if (!expressionTargets.has(expression)) issues.push(`Facial GLB is missing expression target ${expression}.`);
    }
    if (facialWeightChannelCount === 0) issues.push('Facial expression meshes are not driven by any animation weights channel.');
  }

  return {
    valid: issues.length === 0,
    issues,
    expressionTargets: [...expressionTargets].sort(),
    expressionMeshIndices: [...expressionMeshes].sort((a, b) => a - b),
    expressionTargetCount: expressionTargets.size,
    facialWeightChannelCount,
  };
}
