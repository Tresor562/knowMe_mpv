import { describe, expect, it } from 'vitest';
import { inspectAvatarGlb } from './avatar-glb-parser.domain';
import { AVATAR_EXPRESSION_BLENDSHAPES } from './avatar-facial-expression.domain';

function glb(json: Record<string, unknown>, bin: Buffer): Buffer {
  const raw=Buffer.from(JSON.stringify(json)), jc=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,0x20)]), bc=Buffer.concat([bin,Buffer.alloc((4-bin.length%4)%4)]);
  const body=Buffer.alloc(16+jc.length+bc.length); let o=0;
  body.writeUInt32LE(jc.length,o); body.writeUInt32LE(0x4e4f534a,o+4); o+=8; jc.copy(body,o); o+=jc.length;
  body.writeUInt32LE(bc.length,o); body.writeUInt32LE(0x004e4942,o+4); o+=8; bc.copy(body,o);
  const h=Buffer.alloc(12); h.writeUInt32LE(0x46546c67,0); h.writeUInt32LE(2,4); h.writeUInt32LE(12+body.length,8); return Buffer.concat([h,body]);
}

function heroFixture(removeExpression=false){
  const dna=['face_jaw_width','face_nose_width']; const expressions=[...AVATAR_EXPRESSION_BLENDSHAPES]; if(removeExpression) expressions.pop();
  const names=[...dna,...expressions], times=Buffer.alloc(8); times.writeFloatLE(0,0); times.writeFloatLE(.5,4);
  const weights=Buffer.alloc(names.length*2*4); if(names.length) weights.writeFloatLE(1,names.length*4); const bin=Buffer.concat([times,weights]);
  const json={asset:{version:'2.0'},buffers:[{byteLength:bin.length}],bufferViews:[{buffer:0,byteOffset:0,byteLength:8},{buffer:0,byteOffset:8,byteLength:weights.length}],accessors:[{bufferView:0,componentType:5126,count:2,type:'SCALAR',min:[0],max:[.5]},{bufferView:1,componentType:5126,count:names.length*2,type:'SCALAR'}],meshes:[{name:'HeroFace',extras:{targetNames:names},primitives:[{attributes:{},targets:names.map(()=>({}))}]}],nodes:[{name:'HeroFaceNode',mesh:0}],animations:[{name:'HeroExpressions',samplers:[{input:0,output:1,interpolation:'LINEAR'}],channels:[{sampler:0,target:{node:0,path:'weights'}}]}]};
  return {bytes:glb(json,bin),dna,expressions};
}

describe('Hero Avatar DNA/expression certification',()=>{
  it('certifies canonical expressions while preserving independent DNA morphs',()=>{const f=heroFixture(),i=inspectAvatarGlb(f.bytes); expect(i.facialValid).toBe(true); expect(i.facialExpressionTargetCount).toBe(AVATAR_EXPRESSION_BLENDSHAPES.length); expect(i.facialExpressionMeshIndices).toEqual([0]); expect(i.facialWeightAnimationChannelCount).toBe(1); expect(i.facialDiagnostics).toEqual([]); expect(i.animationStructureValid).toBe(true); expect(i.animationBinaryValid).toBe(true); expect(i.maxAnimationClipDurationSeconds).toBeCloseTo(.5); expect(i.morphTargets).toEqual(expect.arrayContaining(f.dna)); expect(i.morphTargets).toEqual(expect.arrayContaining(f.expressions));});
  it('fails closed when DNA is present but one canonical expression is absent',()=>{const f=heroFixture(true),i=inspectAvatarGlb(f.bytes); expect(i.facialValid).toBe(false); expect(i.facialExpressionTargetCount).toBe(AVATAR_EXPRESSION_BLENDSHAPES.length-1); expect(i.facialDiagnostics.length).toBeGreaterThan(0); expect(i.morphTargets).toEqual(expect.arrayContaining(f.dna));});
});
