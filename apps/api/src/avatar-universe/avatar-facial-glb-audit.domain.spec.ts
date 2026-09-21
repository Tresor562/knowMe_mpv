import { auditAvatarFacialGlb } from './avatar-facial-glb-audit.domain';
import { AVATAR_EXPRESSION_BLENDSHAPES } from './avatar-facial-expression.domain';

const facialMesh = () => ({
  extras: { targetNames: [...AVATAR_EXPRESSION_BLENDSHAPES] },
  primitives: [{ targets: AVATAR_EXPRESSION_BLENDSHAPES.map(() => ({ POSITION: 0 })) }],
});

describe('auditAvatarFacialGlb', () => {
  it('certifies canonical expression targets bound to the animated facial mesh', () => {
    const result = auditAvatarFacialGlb({
      meshes: [facialMesh()], nodes: [{ mesh: 0 }],
      animations: [{ channels: [{ target: { node: 0, path: 'weights' } }] }],
    });
    expect(result.valid).toBe(true);
    expect(result.expressionTargetCount).toBe(AVATAR_EXPRESSION_BLENDSHAPES.length);
    expect(result.expressionMeshIndices).toEqual([0]);
    expect(result.facialWeightChannelCount).toBe(1);
  });

  it('fails when a canonical expression is missing', () => {
    const mesh = facialMesh();
    mesh.extras.targetNames.pop();
    mesh.primitives[0].targets.pop();
    const result = auditAvatarFacialGlb({ meshes: [mesh], nodes: [{ mesh: 0 }], animations: [{ channels: [{ target: { node: 0, path: 'weights' } }] }] });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.includes('missing expression target'))).toBe(true);
  });

  it('does not let a weights channel on another mesh prove facial animation', () => {
    const result = auditAvatarFacialGlb({
      meshes: [facialMesh(), { extras: { targetNames: ['clothFold'] }, primitives: [{ targets: [{ POSITION: 0 }] }] }],
      nodes: [{ mesh: 0 }, { mesh: 1 }],
      animations: [{ channels: [{ target: { node: 1, path: 'weights' } }] }],
    });
    expect(result.valid).toBe(false);
    expect(result.facialWeightChannelCount).toBe(0);
  });

  it('rejects duplicate names and inconsistent primitive layouts', () => {
    const names = [...AVATAR_EXPRESSION_BLENDSHAPES];
    names[1] = names[0];
    const result = auditAvatarFacialGlb({ meshes: [{ extras: { targetNames: names }, primitives: [{ targets: names.map(() => ({ POSITION: 0 })) }, { targets: [{ POSITION: 0 }] }] }] });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.includes('duplicate'))).toBe(true);
    expect(result.issues.some((issue) => issue.includes('disagree'))).toBe(true);
  });

  it('rejects weight channels targeting nodes without certified morph targets', () => {
    const result = auditAvatarFacialGlb({ meshes: [{}], nodes: [{ mesh: 0 }], animations: [{ channels: [{ target: { node: 0, path: 'weights' } }] }] });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.includes('without certified morph targets'))).toBe(true);
  });
});
