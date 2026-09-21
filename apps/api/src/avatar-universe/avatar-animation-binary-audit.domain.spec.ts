import { auditAvatarAnimationBinary } from './avatar-animation-binary-audit.domain';

function fixture(times:number[],rotations:number[][]){
 const floats=[...times,...rotations.flat()];const bin=new Uint8Array(floats.length*4),view=new DataView(bin.buffer);floats.forEach((v,i)=>view.setFloat32(i*4,v,true));
 const timeBytes=times.length*4;
 return{bin,g:{bufferViews:[{buffer:0,byteOffset:0,byteLength:timeBytes},{buffer:0,byteOffset:timeBytes,byteLength:rotations.length*16}],accessors:[{bufferView:0,componentType:5126,count:times.length,type:'SCALAR'},{bufferView:1,componentType:5126,count:rotations.length,type:'VEC4'}],animations:[{name:'idle',samplers:[{input:0,output:1,interpolation:'LINEAR'}],channels:[{sampler:0,target:{node:0,path:'rotation'}}]}]}};
}

describe('auditAvatarAnimationBinary',()=>{
 it('accepts increasing finite times and unit quaternions',()=>{const{x,...rest}=({x:0,...fixture([0,0.5,1],[[0,0,0,1],[0,0.38268343,0,0.92387953],[0,0,0,1]])});const r=auditAvatarAnimationBinary(rest.g,rest.bin);expect(r.valid).toBe(true);expect(r.keyframeCount).toBe(3);expect(r.maxClipDurationSeconds).toBeCloseTo(1);});
 it('rejects duplicate or decreasing keyframe times',()=>{const f=fixture([0,0.5,0.5],[[0,0,0,1],[0,0,0,1],[0,0,0,1]]);const r=auditAvatarAnimationBinary(f.g,f.bin);expect(r.valid).toBe(false);expect(r.issues.some(x=>x.includes('strictly increasing'))).toBe(true);});
 it('rejects negative keyframe times',()=>{const f=fixture([-0.1,0.5],[[0,0,0,1],[0,0,0,1]]);const r=auditAvatarAnimationBinary(f.g,f.bin);expect(r.valid).toBe(false);expect(r.issues.some(x=>x.includes('negative'))).toBe(true);});
 it('rejects non-normalized rotation quaternions',()=>{const f=fixture([0,1],[[0,0,0,2],[0,0,0,1]]);const r=auditAvatarAnimationBinary(f.g,f.bin);expect(r.valid).toBe(false);expect(r.nonNormalizedQuaternionCount).toBe(1);});
 it('rejects non-finite animation payloads',()=>{const f=fixture([0,1],[[0,0,Number.NaN,1],[0,0,0,1]]);const r=auditAvatarAnimationBinary(f.g,f.bin);expect(r.valid).toBe(false);expect(r.nonFiniteValueCount).toBeGreaterThan(0);});
 it('rejects accessors escaping their bufferView',()=>{const f=fixture([0,1],[[0,0,0,1],[0,0,0,1]]);f.g.bufferViews[1].byteLength=4;const r=auditAvatarAnimationBinary(f.g,f.bin);expect(r.valid).toBe(false);expect(r.issues.some(x=>x.includes('exceeds its bufferView'))).toBe(true);});
});
