import { inspectAvatarFacialGlb } from './avatar-facial-glb-inspection.domain';
import { AVATAR_EXPRESSION_BLENDSHAPES } from './avatar-facial-expression.domain';

const facialMesh = () => ({
  extras: { targetNames: [...AVATAR_EXPRESSION_BLENDSHAPES] },
  primitives: [{ targets: AVATAR_EXPRESSION_BLENDSHAPES.map(() => ({ POSITION: 0 })) }],
});

describe('inspectAvatarFacialGlb', () => {
  it('maps a valid mesh-bound audit to the fail-closed inspection proof', () => {
    const proof = inspectAvatarFacialGlb({
      meshes: [facialMesh()],
      nodes: [{ mesh: 0 }],
      animations: [{ channels: [{ target: { node: 0, path: 'weights' } }] }],
    });

    expect(proof.facialValid).toBe(true);
    expect(proof.facialIssues).toEqual([]);
    expect(proof.expressionTargets).toHaveLength(AVATAR_EXPRESSION_BLENDSHAPES.length);
    expect(proof.expressionMeshIndices).toEqual([0]);
    expect(proof.expressionTargetCount).toBe(AVATAR_EXPRESSION_BLENDSHAPES.length);
    expect(proof.facialWeightChannelCount).toBe(1);
  });

  it('preserves audit failures instead of manufacturing facial proof', () => {
    const mesh = facialMesh();
    mesh.extras.targetNames.pop();
    mesh.primitives[0].targets.pop();
    const proof = inspectAvatarFacialGlb({ meshes: [mesh], nodes: [{ mesh: 0 }] });

    expect(proof.facialValid).toBe(false);
    expect(proof.expressionTargetCount).toBeLessThan(AVATAR_EXPRESSION_BLENDSHAPES.length);
    expect(proof.facialIssues?.some((issue) => issue.includes('missing expression target'))).toBe(true);
  });
});
