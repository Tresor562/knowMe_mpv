import {AVATAR_CANONICAL_SKELETON} from './avatar-asset-manifest.domain';
import {HERO_BLOCKOUT_ASSET_KEY,HERO_DNA_MORPH_NAMES,HERO_EXPRESSION_MORPH_NAMES,HERO_COMBINATION_CASE_NAMES,HeroBlockoutReport} from './hero-blockout-report-v12.domain';
import {HERO_RUNTIME_BUNDLE_VERSION,HERO_RUNTIME_MORPH_TARGETS,HeroRuntimeBundle,inspectHeroRuntimeGlb,sha256RuntimeBytes,validateHeroRuntimeBundle,verifyHeroRuntimeBundleBytes} from './hero-runtime-bundle-v13.domain';

const LOD_VERTICES=[30000,15000,6000] as const,LOD_TRIANGLES=[50000,25000,10000] as const;
const sourceReport=():HeroBlockoutReport=>({
 reportVersion:12,assetKey:HERO_BLOCKOUT_ASSET_KEY,unitSystem:'METERS',authoringUpAxis:'Z',runtimeUpAxis:'Y',pose:'A_POSE',
 poseVerified:true,measuredLeftUpperArmAngleDeg:40,measuredRightUpperArmAngleDeg:40,centeredWorldOrigin:true,measuredBodyCenterX:0,
 groundContactY:0,measuredGroundContactMeters:0,groundContactVerified:true,bodyHeightMeters:1.68,skeletonTarget:AVATAR_CANONICAL_SKELETON,
 stableVertexOrder:true,deformationTopologyReady:true,skinningVerified:true,measuredUnweightedBodyVertices:0,measuredMaxBodyBoneInfluences:4,
 measuredMaxBodyWeightSumError:.001,uvVerified:true,measuredBodyUvLayers:1,measuredBodyUvOutOfBoundsLoops:0,pbrMaterialsVerified:true,
 measuredMaterialSlots:3,measuredMaxMaterialsPerObject:1,texturesVerified:true,bodyBaseColorTextureVerified:true,bodyNormalTextureVerified:true,
 bodyOrmTextureVerified:true,textureColorSpacesVerified:true,measuredTextureCount:3,measuredMaxTextureDimension:2048,
 measuredTotalTexturePixels:12582912,dnaMorphsVerified:true,dnaMorphNames:[...HERO_DNA_MORPH_NAMES],
 measuredDnaMorphCount:HERO_DNA_MORPH_NAMES.length,measuredMaxDnaVertexDeltaMeters:.12,expressionsVerified:true,
 expressionMorphNames:[...HERO_EXPRESSION_MORPH_NAMES],measuredExpressionMorphCount:HERO_EXPRESSION_MORPH_NAMES.length,
 measuredMaxExpressionVertexDeltaMeters:.04,combinedDeformationsVerified:true,combinationCaseNames:[...HERO_COMBINATION_CASE_NAMES],
 measuredCombinationCaseCount:HERO_COMBINATION_CASE_NAMES.length,measuredMaxCombinedVertexDeltaMeters:.2,measuredMaxSelfIntersectionCount:0,
 lodsVerified:true,lodCanonicalArmatureName:'RIG_HUMANOID',lodShapeKeyNames:['Basis',...HERO_DNA_MORPH_NAMES,...HERO_EXPRESSION_MORPH_NAMES],
 lodMetrics:[
  {level:0,objectName:'BODY_LOD0',vertices:30000,triangles:45000,maxBonesPerVertex:4,reductionFromPrevious:0},
  {level:1,objectName:'BODY_LOD1',vertices:18000,triangles:26000,maxBonesPerVertex:4,reductionFromPrevious:Number((1-26000/45000).toFixed(6))},
  {level:2,objectName:'BODY_LOD2',vertices:7000,triangles:10000,maxBonesPerVertex:4,reductionFromPrevious:Number((1-10000/26000).toFixed(6))}
 ],
 objects:[
  {role:'BODY',vertices:30000,triangles:45000,manifold:true,unappliedTransforms:false,fusedClothingOrAccessories:false},
  {role:'EYE_L',vertices:800,triangles:1400,manifold:true,unappliedTransforms:false,fusedClothingOrAccessories:false},
  {role:'EYE_R',vertices:800,triangles:1400,manifold:true,unappliedTransforms:false,fusedClothingOrAccessories:false}
 ]
});

type DocMutator=(doc:any)=>void;type BinMutator=(bin:Uint8Array,doc:any)=>void;
const makeGlb=(vertices:number,triangles:number,targetNames:string[]=[...HERO_RUNTIME_MORPH_TARGETS],mutate?:DocMutator,mutateBin?:BinMutator)=>{
 const sizes=[vertices*12,vertices*8,vertices*16,triangles*3*4,vertices*12,64];const offsets:number[]=[];let cursor=0;for(const size of sizes){cursor=(cursor+3)&~3;offsets.push(cursor);cursor+=size;}const binLength=(cursor+3)&~3;
 const bufferViews=sizes.map((byteLength,i)=>({buffer:0,byteOffset:offsets[i],byteLength}));
 const accessors=[{count:vertices,type:'VEC3',componentType:5126,bufferView:0},{count:vertices,type:'VEC4',componentType:5123,bufferView:1},{count:vertices,type:'VEC4',componentType:5126,bufferView:2},{count:triangles*3,type:'SCALAR',componentType:5125,bufferView:3},{count:vertices,type:'VEC3',componentType:5126,bufferView:4},{count:1,type:'MAT4',componentType:5126,bufferView:5}];
 const doc:any={asset:{version:'2.0'},buffers:[{byteLength:binLength}],bufferViews,accessors,nodes:[{name:'root'}],skins:[{joints:[0],inverseBindMatrices:5}],meshes:[{extras:{targetNames},primitives:[{mode:4,indices:3,attributes:{POSITION:0,JOINTS_0:1,WEIGHTS_0:2},targets:targetNames.map(()=>({POSITION:4}))}]}]};mutate?.(doc);
 const bin=new Uint8Array(binLength),dv=new DataView(bin.buffer);for(let i=0;i<vertices;i++)dv.setFloat32(offsets[2]+i*16,1,true);for(let i=0;i<triangles*3;i++)dv.setUint32(offsets[3]+i*4,i%vertices,true);for(let i=0;i<16;i++)dv.setFloat32(offsets[5]+i*4,i%5===0?1:0,true);mutateBin?.(bin,doc);
 const raw=new TextEncoder().encode(JSON.stringify(doc));const padded=(raw.length+3)&~3;const out=new Uint8Array(20+padded+8+binLength);const view=new DataView(out.buffer);view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,out.byteLength,true);view.setUint32(12,padded,true);view.setUint32(16,0x4e4f534a,true);out.fill(0x20,20,20+padded);out.set(raw,20);const binHeader=20+padded;view.setUint32(binHeader,binLength,true);view.setUint32(binHeader+4,0x004e4942,true);out.set(bin,binHeader+8);return out;
};
const bytes=LOD_VERTICES.map((v,i)=>makeGlb(v,LOD_TRIANGLES[i]));
const bundle=():HeroRuntimeBundle=>({bundleVersion:HERO_RUNTIME_BUNDLE_VERSION,assetKey:HERO_BLOCKOUT_ASSET_KEY,format:'GLB',skeletonKey:AVATAR_CANONICAL_SKELETON,morphTargets:[...HERO_DNA_MORPH_NAMES,...HERO_EXPRESSION_MORPH_NAMES],sourceReport:sourceReport(),lods:bytes.map((b,i)=>({level:i as 0|1|2,fileName:`knowme-hero-lod${i}.glb`,sha256:sha256RuntimeBytes(b),downloadBytes:b.byteLength,vertices:LOD_VERTICES[i],triangles:LOD_TRIANGLES[i]}))});
const replace=(b:HeroRuntimeBundle,index:number,forged:Uint8Array)=>{b.lods[index].sha256=sha256RuntimeBytes(forged);b.lods[index].downloadBytes=forged.byteLength;return new Map(b.lods.map((l,i)=>[l.fileName,i===index?forged:bytes[i]]));};
const forge=(doc?:DocMutator,bin?:BinMutator)=>makeGlb(6000,10000,undefined,doc,bin);

describe('Hero runtime bundle v13',()=>{
 it('accepts certified manifest bound to structurally and numerically valid GLB bytes',()=>{const b=bundle();expect(validateHeroRuntimeBundle(b)).toBe(b);expect(verifyHeroRuntimeBundleBytes(b,new Map(b.lods.map((l,i)=>[l.fileName,bytes[i]])))).toBe(true);});
 it('recomputes geometry from GLB accessors',()=>expect(inspectHeroRuntimeGlb(bytes[0])).toEqual({meshCount:1,skinCount:1,morphTargetCount:HERO_RUNTIME_MORPH_TARGETS.length,vertices:30000,triangles:50000}));
 it('rejects substituted GLB bytes',()=>{const b=bundle();const files=new Map(b.lods.map((l,i)=>[l.fileName,bytes[i]]));files.set('knowme-hero-lod1.glb',new Uint8Array([9,9]));expect(()=>verifyHeroRuntimeBundleBytes(b,files)).toThrow();});
 it('rejects forged geometry copied into runtime manifest',()=>{const b=bundle();b.lods[1].triangles++;expect(()=>validateHeroRuntimeBundle(b)).toThrow(/geometry/);});
 it('rejects non-canonical manifest morph ordering',()=>{const b=bundle();b.morphTargets.reverse();expect(()=>validateHeroRuntimeBundle(b)).toThrow(/morph/);});
 it('rejects structurally forged GLB even when hash and length are self-consistent',()=>{const b=bundle();const forged=makeGlb(15000,25000,[...HERO_RUNTIME_MORPH_TARGETS].reverse());expect(()=>verifyHeroRuntimeBundleBytes(b,replace(b,1,forged))).toThrow(/morph targets/);});
 it('rejects accessor geometry forged with a self-consistent digest',()=>{const b=bundle();const forged=makeGlb(14999,25000);expect(()=>verifyHeroRuntimeBundleBytes(b,replace(b,1,forged))).toThrow(/geometry mismatch/);});
 it('rejects malformed skin accessor contracts',()=>{const b=bundle();expect(()=>verifyHeroRuntimeBundleBytes(b,replace(b,2,forge(doc=>{doc.accessors[1].type='VEC3';})))).toThrow(/JOINTS_0/);});
 it('rejects morph accessors with a different vertex domain',()=>{const b=bundle();expect(()=>verifyHeroRuntimeBundleBytes(b,replace(b,2,forge(doc=>{doc.accessors[4].count=5999;})))).toThrow(/morph POSITION/);});
 it('rejects non-triangle index streams',()=>{const b=bundle();expect(()=>verifyHeroRuntimeBundleBytes(b,replace(b,2,forge(doc=>{doc.accessors[3].count=29999;})))).toThrow(/indices/);});
 it('rejects bufferViews that exceed the embedded BIN chunk',()=>{const b=bundle();expect(()=>verifyHeroRuntimeBundleBytes(b,replace(b,2,forge(doc=>{doc.bufferViews[0].byteLength=999999999;})))).toThrow(/binary range/);});
 it('rejects accessor offsets escaping their bufferView',()=>{const b=bundle();expect(()=>verifyHeroRuntimeBundleBytes(b,replace(b,2,forge(doc=>{doc.accessors[0].byteOffset=doc.bufferViews[0].byteLength;})))).toThrow(/binary range/);});
 it('rejects invalid interleaved strides',()=>{const b=bundle();expect(()=>verifyHeroRuntimeBundleBytes(b,replace(b,2,forge(doc=>{doc.bufferViews[0].byteStride=2;})))).toThrow(/byteStride/);});
 it('rejects external buffers',()=>{const b=bundle();expect(()=>verifyHeroRuntimeBundleBytes(b,replace(b,2,forge(doc=>{doc.buffers[0].uri='evil.bin';})))).toThrow(/embedded buffer/);});
 it('rejects sparse runtime accessors',()=>{const b=bundle();expect(()=>verifyHeroRuntimeBundleBytes(b,replace(b,2,forge(doc=>{doc.accessors[0].sparse={count:1};})))).toThrow(/sparse/);});
 it('rejects indices outside the POSITION domain even with a matching digest',()=>{const b=bundle();const forged=forge(undefined,(bin,doc)=>new DataView(bin.buffer).setUint32(doc.bufferViews[3].byteOffset,6000,true));expect(()=>verifyHeroRuntimeBundleBytes(b,replace(b,2,forged))).toThrow(/index references/);});
 it('rejects JOINTS_0 values outside the skin palette',()=>{const b=bundle();const forged=forge(undefined,(bin,doc)=>new DataView(bin.buffer).setUint16(doc.bufferViews[1].byteOffset,1,true));expect(()=>verifyHeroRuntimeBundleBytes(b,replace(b,2,forged))).toThrow(/joint outside/);});
 it('rejects vertex weights that do not sum to one',()=>{const b=bundle();const forged=forge(undefined,(bin,doc)=>new DataView(bin.buffer).setFloat32(doc.bufferViews[2].byteOffset,0.5,true));expect(()=>verifyHeroRuntimeBundleBytes(b,replace(b,2,forged))).toThrow(/sum to one/);});
 it('rejects non-finite inverse bind matrices',()=>{const b=bundle();const forged=forge(undefined,(bin,doc)=>new DataView(bin.buffer).setFloat32(doc.bufferViews[5].byteOffset,Number.NaN,true));expect(()=>verifyHeroRuntimeBundleBytes(b,replace(b,2,forged))).toThrow(/inverse bind matrices must be finite/);});
 it('rejects inverse bind matrices not matching the joint palette',()=>{const b=bundle();expect(()=>verifyHeroRuntimeBundleBytes(b,replace(b,2,forge(doc=>{doc.accessors[5].count=2;})))).toThrow(/inverse bind matrices/);});
 it('rejects skin joints pointing outside nodes',()=>{const b=bundle();expect(()=>verifyHeroRuntimeBundleBytes(b,replace(b,2,forge(doc=>{doc.skins[0].joints=[9];})))).toThrow(/skin joints/);});
 it('rejects non-finite POSITION values even with a matching digest',()=>{const b=bundle();const forged=forge(undefined,(bin,doc)=>new DataView(bin.buffer).setFloat32(doc.bufferViews[0].byteOffset,Number.NaN,true));expect(()=>verifyHeroRuntimeBundleBytes(b,replace(b,2,forged))).toThrow(/non-finite coordinates/);});
 it('rejects POSITION values outside the Hero world-space bound',()=>{const b=bundle();const forged=forge(undefined,(bin,doc)=>new DataView(bin.buffer).setFloat32(doc.bufferViews[0].byteOffset,4.01,true));expect(()=>verifyHeroRuntimeBundleBytes(b,replace(b,2,forged))).toThrow(/world-space safety bound/);});
 it('rejects non-finite morph deltas',()=>{const b=bundle();const forged=forge(undefined,(bin,doc)=>new DataView(bin.buffer).setFloat32(doc.bufferViews[4].byteOffset,Number.POSITIVE_INFINITY,true));expect(()=>verifyHeroRuntimeBundleBytes(b,replace(b,2,forged))).toThrow(/non-finite deltas/);});
 it('rejects DNA morph deltas above the certified deformation budget',()=>{const b=bundle();const forged=forge(undefined,(bin,doc)=>new DataView(bin.buffer).setFloat32(doc.bufferViews[4].byteOffset,0.351,true));expect(()=>verifyHeroRuntimeBundleBytes(b,replace(b,2,forged))).toThrow(/DNA deformation budget/);});
 it('rejects non-GLB payload even with matching manifest digest',()=>{const b=bundle();const forged=new Uint8Array(32);expect(()=>verifyHeroRuntimeBundleBytes(b,replace(b,2,forged))).toThrow(/not a GLB/);});
 it('rejects extra runtime files',()=>{const b=bundle();const files=new Map(b.lods.map((l,i)=>[l.fileName,bytes[i]]));files.set('evil.glb',new Uint8Array([1]));expect(()=>verifyHeroRuntimeBundleBytes(b,files)).toThrow(/exactly three|Unexpected/);});
});
