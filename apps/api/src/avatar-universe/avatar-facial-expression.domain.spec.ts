import { AVATAR_CANONICAL_FACIAL_RIG, AvatarAssetManifest } from './avatar-asset-manifest.domain';
import {
  AVATAR_EXPRESSION_BLENDSHAPES,
  assertAvatarAssetFacialMorphIsolation,
  validateAvatarFacialExpressionContract,
} from './avatar-facial-expression.domain';

const contract = () => ({
  contractVersion: 1 as const,
  facialRigKey: AVATAR_CANONICAL_FACIAL_RIG,
  blendshapes: [...AVATAR_EXPRESSION_BLENDSHAPES],
});

const asset = (kind: AvatarAssetManifest['kind'], facialRigKey?: string) => ({ kind, facialRigKey } as AvatarAssetManifest);

describe('avatar facial expression contract', () => {
  it('accepts the complete canonical expression set', () => expect(validateAvatarFacialExpressionContract(contract())).toBeTruthy());
  it('rejects a missing canonical expression', () => {
    const value = contract();
    value.blendshapes = value.blendshapes.filter(v => v !== 'blinkLeft') as any;
    expect(() => validateAvatarFacialExpressionContract(value)).toThrow(/blinkLeft/);
  });
  it('rejects duplicate expressions', () => {
    const value = contract();
    value.blendshapes.push('blinkLeft');
    expect(() => validateAvatarFacialExpressionContract(value)).toThrow(/Duplicate/);
  });
  it('rejects client-invented expression names', () => {
    const value = contract() as any;
    value.blendshapes.push('unlockPremiumFace');
    expect(() => validateAvatarFacialExpressionContract(value)).toThrow(/Undeclared/);
  });
  it('allows canonical expressions only on base body or face assets', () => {
    expect(assertAvatarAssetFacialMorphIsolation(asset('BASE_BODY', AVATAR_CANONICAL_FACIAL_RIG), ['blinkLeft'])).toBe(true);
    expect(assertAvatarAssetFacialMorphIsolation(asset('FACE', AVATAR_CANONICAL_FACIAL_RIG), ['blinkLeft'])).toBe(true);
    expect(() => assertAvatarAssetFacialMorphIsolation(asset('CLOTHING'), ['blinkLeft'])).toThrow(/cannot declare/);
    expect(() => assertAvatarAssetFacialMorphIsolation(asset('HAIR'), ['smileLeft'])).toThrow(/cannot declare/);
  });
  it('requires the canonical facial rig when expression targets exist', () => {
    expect(() => assertAvatarAssetFacialMorphIsolation(asset('FACE', 'client.fake.rig'), ['blinkLeft'])).toThrow(/canonical facial rig/);
  });
});
