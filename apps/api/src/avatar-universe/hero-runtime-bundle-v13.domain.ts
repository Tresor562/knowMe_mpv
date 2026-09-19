import { createHash } from 'node:crypto';
import { AVATAR_CANONICAL_SKELETON } from './avatar-asset-manifest.domain';
import { HERO_BLOCKOUT_ASSET_KEY,HERO_DNA_MORPH_NAMES,HERO_EXPRESSION_MORPH_NAMES,HeroBlockoutReport,validateHeroBlockoutReport } from './hero-blockout-report-v12.domain';

export const HERO_RUNTIME_BUNDLE_VERSION=13 as const;
export const HERO_RUNTIME_FORMAT='GLB' as const;
export const HERO_RUNTIME_MAX_BYTES=[8*1024*1024,5*1024*1024,3*1024*1024] as const;
export const HERO_RUNTIME_MORPH_TARGETS=[...HERO_DNA_MORPH_NAMES,...HERO_EXPRESSION_MORPH_NAMES] as const;
export type HeroRuntimeLod={level:0|1|2;fileName:string;sha256:string;downloadBytes:number;vertices:number;triangles:number};
export type HeroRuntimeBundle={bundleVersion:typeof HERO_RUNTIME_BUNDLE_VERSION;assetKey:typeof HERO_BLOCKOUT_ASSET_KEY;format:typeof HERO_RUNTIME_FORMAT;skeletonKey:typeof AVATAR_CANONICAL_SKELETON;morphTargets:string[];lods:HeroRuntimeLod[];sourceReport:HeroBlockoutReport};
const SHA256=/^[a-f0-9]{64}$/;
const FILE=/^knowme-hero-lod([012])\.glb$/;
const GLB_MAGIC=0x46546c67,GLB_VERSION=2,GLB_JSON=0x4e4f534a,GLB_BIN=0x004e4942;
const COMPONENT_BYTES:Record<number,number>={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
const TYPE_COMPONENTS:Record<string,number>={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};
const positiveInt=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0;
const nonNegativeInt=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const accessor=(doc:any,index:unknown,label:string)=>{
 if(!Number.isSafeInteger(index)||Number(index)<0||!Array.isArray(doc.accessors)||!doc.accessors[index as number])throw new Error(`Runtime GLB ${label} accessor is invalid.`);
 const a=doc.accessors[index as number];if(!positiveInt(a.count))throw new Error(`Runtime GLB ${label} accessor count is invalid.`);return a;
};

export function sha256RuntimeBytes(bytes:Uint8Array){return createHash('sha256').update(bytes).digest('hex');}

function validateAccessorStorage(doc:any,a:any,label:string,binLength:number){
 if(a.sparse!==undefined)throw new Error(`Runtime GLB ${label} sparse accessors are not allowed.`);
 if(!nonNegativeInt(a.bufferView)||!Array.isArray(doc.bufferViews)||!doc.bufferViews[a.bufferView])throw new Error(`Runtime GLB ${label} bufferView is invalid.`);
 const bv=doc.bufferViews[a.bufferView];
 if(bv.buffer!==0)throw new Error(`Runtime GLB ${label} must reference the embedded GLB buffer.`);
 if(!positiveInt(bv.byteLength)||!nonNegativeInt(bv.byteOffset??0))throw new Error(`Runtime GLB ${label} bufferView range is invalid.`);
 const componentBytes=COMPONENT_BYTES[a.componentType],components=TYPE_COMPONENTS[a.type];
 if(!componentBytes||!components)throw new Error(`Runtime GLB ${label} accessor layout is unsupported.`);
 const elementBytes=componentBytes*components;
 const stride=bv.byteStride??elementBytes;
 if(!positiveInt(stride)||stride<elementBytes||stride%componentBytes!==0)throw new Error(`Runtime GLB ${label} byteStride is invalid.`);
 const accessorOffset=a.byteOffset??0;
 if(!nonNegativeInt(accessorOffset)||accessorOffset%componentBytes!==0)throw new Error(`Runtime GLB ${label} byteOffset is invalid.`);
 const start=(bv.byteOffset??0)+accessorOffset;
 const end=start+(a.count-1)*stride+elementBytes;
 const viewEnd=(bv.byteOffset??0)+bv.byteLength;
 if(start<0||end>viewEnd||viewEnd>binLength)throw new Error(`Runtime GLB ${label} binary range exceeds its bufferView.`);
 return {start,stride,componentBytes,components};
}

function readComponent(view:DataView,offset:number,type:number){
 switch(type){case 5120:return view.getInt8(offset);case 5121:return view.getUint8(offset);case 5122:return view.getInt16(offset,true);case 5123:return view.getUint16(offset,true);case 5125:return view.getUint32(offset,true);case 5126:return view.getFloat32(offset,true);default:throw new Error('Unsupported GLB component type.');}
}
function normalizedComponent(value:number,type:number){
 switch(type){case 5120:return Math.max(value/127,-1);case 5121:return value/255;case 5122:return Math.max(value/32767,-1);case 5123:return value/65535;default:return value;}
}
function readAccessorElement(view:DataView,binStart:number,a:any,storage:{start:number;stride:number;componentBytes:number;components:number},index:number){
 const values:number[]=[];const base=binStart+storage.start+index*storage.stride;
 for(let c=0;c<storage.components;c++){const raw=readComponent(view,base+c*storage.componentBytes,a.componentType);values.push(a.normalized===true?normalizedComponent(raw,a.componentType):raw);}return values;
}

export function inspectHeroRuntimeGlb(bytes:Uint8Array){
 if(!(bytes instanceof Uint8Array)||bytes.byteLength<28)throw new Error('Runtime GLB is truncated.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(view.getUint32(0,true)!==GLB_MAGIC)throw new Error('Runtime file is not a GLB.');
 if(view.getUint32(4,true)!==GLB_VERSION)throw new Error('Runtime GLB must use glTF 2.0.');
 if(view.getUint32(8,true)!==bytes.byteLength)throw new Error('Runtime GLB declared length does not match its bytes.');
 const jsonLength=view.getUint32(12,true),jsonType=view.getUint32(16,true);
 if(jsonType!==GLB_JSON||jsonLength===0||20+jsonLength>bytes.byteLength)throw new Error('Runtime GLB JSON chunk is invalid.');
 let doc:any;try{doc=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+jsonLength)).trim());}catch{throw new Error('Runtime GLB JSON is malformed.');}
 const binHeader=20+jsonLength;
 if(binHeader+8>bytes.byteLength||view.getUint32(binHeader+4,true)!==GLB_BIN)throw new Error('Runtime GLB must contain one embedded BIN chunk.');
 const binLength=view.getUint32(binHeader,true),binStart=binHeader+8;
 if(binStart+binLength!==bytes.byteLength)throw new Error('Runtime GLB BIN chunk length is invalid.');
 if(!Array.isArray(doc.buffers)||doc.buffers.length!==1||doc.buffers[0]?.uri!==undefined||doc.buffers[0]?.byteLength!==binLength)throw new Error('Runtime GLB embedded buffer contract is invalid.');
 if(doc?.asset?.version!=='2.0')throw new Error('Runtime GLB asset version must be 2.0.');
 if(!Array.isArray(doc.nodes)||doc.nodes.length<1)throw new Error('Runtime GLB must contain skeleton nodes.');
 if(!Array.isArray(doc.meshes)||doc.meshes.length!==1)throw new Error('Runtime GLB must contain exactly one Hero body mesh.');
 if(!Array.isArray(doc.skins)||doc.skins.length!==1||!Array.isArray(doc.skins[0]?.joints)||doc.skins[0].joints.length<1)throw new Error('Runtime GLB must contain exactly one non-empty canonical skin.');
 const skin=doc.skins[0];
 if(new Set(skin.joints).size!==skin.joints.length||skin.joints.some((j:unknown)=>!nonNegativeInt(j)||j>=doc.nodes.length))throw new Error('Runtime GLB skin joints must reference unique existing nodes.');
 const ibm=accessor(doc,skin.inverseBindMatrices,'inverse bind matrices');
 if(ibm.type!=='MAT4'||ibm.componentType!==5126||ibm.count!==skin.joints.length)throw new Error('Runtime GLB inverse bind matrices contract is invalid.');
 const ibmStorage=validateAccessorStorage(doc,ibm,'inverse bind matrices',binLength);
 for(let i=0;i<ibm.count;i++)if(readAccessorElement(view,binStart,ibm,ibmStorage,i).some(v=>!Number.isFinite(v)))throw new Error('Runtime GLB inverse bind matrices must be finite.');
 const targetNames=doc.meshes[0]?.extras?.targetNames;
 if(!Array.isArray(targetNames)||targetNames.length!==HERO_RUNTIME_MORPH_TARGETS.length||HERO_RUNTIME_MORPH_TARGETS.some((n,i)=>targetNames[i]!==n))throw new Error('Runtime GLB morph targets are non-canonical.');
 const primitives=doc.meshes[0]?.primitives;
 if(!Array.isArray(primitives)||primitives.length<1)throw new Error('Runtime GLB mesh has no primitives.');
 let vertices=0,triangles=0;
 for(const primitive of primitives){
  if(primitive?.mode!==undefined&&primitive.mode!==4)throw new Error('Runtime GLB Hero primitives must use TRIANGLES mode.');
  if(!primitive?.attributes||primitive.attributes.POSITION===undefined)throw new Error('Runtime GLB primitive has no POSITION attribute.');
  if(primitive.attributes.JOINTS_0===undefined||primitive.attributes.WEIGHTS_0===undefined)throw new Error('Runtime GLB primitive is not skinned.');
  const pos=accessor(doc,primitive.attributes.POSITION,'POSITION');if(pos.type!=='VEC3'||pos.componentType!==5126)throw new Error('Runtime GLB POSITION must be FLOAT VEC3.');validateAccessorStorage(doc,pos,'POSITION',binLength);
  const joints=accessor(doc,primitive.attributes.JOINTS_0,'JOINTS_0');if(joints.type!=='VEC4'||![5121,5123].includes(joints.componentType)||joints.count!==pos.count)throw new Error('Runtime GLB JOINTS_0 contract is invalid.');const jointStorage=validateAccessorStorage(doc,joints,'JOINTS_0',binLength);
  const weights=accessor(doc,primitive.attributes.WEIGHTS_0,'WEIGHTS_0');if(weights.type!=='VEC4'||![5121,5123,5126].includes(weights.componentType)||weights.count!==pos.count||([5121,5123].includes(weights.componentType)&&weights.normalized!==true))throw new Error('Runtime GLB WEIGHTS_0 contract is invalid.');const weightStorage=validateAccessorStorage(doc,weights,'WEIGHTS_0',binLength);
  for(let i=0;i<pos.count;i++){
   const js=readAccessorElement(view,binStart,joints,jointStorage,i);if(js.some(j=>!Number.isInteger(j)||j<0||j>=skin.joints.length))throw new Error('Runtime GLB JOINTS_0 references a joint outside the skin palette.');
   const ws=readAccessorElement(view,binStart,weights,weightStorage,i);if(ws.some(w=>!Number.isFinite(w)||w<0))throw new Error('Runtime GLB WEIGHTS_0 contains invalid weights.');
   const sum=ws.reduce((a,b)=>a+b,0);if(Math.abs(sum-1)>1e-3)throw new Error('Runtime GLB WEIGHTS_0 must sum to one per vertex.');
  }
  const indices=accessor(doc,primitive.indices,'indices');if(indices.type!=='SCALAR'||![5121,5123,5125].includes(indices.componentType)||indices.count%3!==0)throw new Error('Runtime GLB indices must encode triangles.');const indexStorage=validateAccessorStorage(doc,indices,'indices',binLength);
  for(let i=0;i<indices.count;i++)if(readAccessorElement(view,binStart,indices,indexStorage,i)[0]>=pos.count)throw new Error('Runtime GLB index references a vertex outside POSITION.');
  if(!Array.isArray(primitive.targets)||primitive.targets.length!==HERO_RUNTIME_MORPH_TARGETS.length)throw new Error('Runtime GLB primitive morph count is non-canonical.');
  for(const target of primitive.targets){const morph=accessor(doc,target?.POSITION,'morph POSITION');if(morph.type!=='VEC3'||morph.componentType!==5126||morph.count!==pos.count)throw new Error('Runtime GLB morph POSITION contract is invalid.');validateAccessorStorage(doc,morph,'morph POSITION',binLength);}
  vertices+=pos.count;triangles+=indices.count/3;
 }
 return {meshCount:doc.meshes.length,skinCount:doc.skins.length,morphTargetCount:targetNames.length,vertices,triangles};
}

export function validateHeroRuntimeBundle(input:HeroRuntimeBundle):HeroRuntimeBundle{
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Hero runtime bundle must be an object.');
 if(input.bundleVersion!==HERO_RUNTIME_BUNDLE_VERSION)throw new Error('Unsupported Hero runtime bundle version.');
 if(input.assetKey!==HERO_BLOCKOUT_ASSET_KEY||input.format!==HERO_RUNTIME_FORMAT)throw new Error('Hero runtime bundle identity is invalid.');
 if(input.skeletonKey!==AVATAR_CANONICAL_SKELETON)throw new Error('Hero runtime bundle must use the canonical skeleton.');
 validateHeroBlockoutReport(input.sourceReport);
 if(!Array.isArray(input.morphTargets)||input.morphTargets.length!==HERO_RUNTIME_MORPH_TARGETS.length||HERO_RUNTIME_MORPH_TARGETS.some((n,i)=>input.morphTargets[i]!==n))throw new Error('Hero runtime morph contract is non-canonical.');
 if(!Array.isArray(input.lods)||input.lods.length!==3)throw new Error('Hero runtime bundle requires exactly three LOD files.');
 input.lods.forEach((lod,index)=>{
  if(!lod||lod.level!==index||lod.fileName!==`knowme-hero-lod${index}.glb`||!FILE.test(lod.fileName))throw new Error('Hero runtime LOD identity is non-canonical.');
  if(!SHA256.test(lod.sha256))throw new Error('Hero runtime LOD SHA-256 is invalid.');
  if(!positiveInt(lod.downloadBytes)||lod.downloadBytes>HERO_RUNTIME_MAX_BYTES[index])throw new Error('Hero runtime LOD exceeds byte budget.');
  const measured=input.sourceReport.lodMetrics[index];
  if(lod.vertices!==measured.vertices||lod.triangles!==measured.triangles)throw new Error('Hero runtime LOD geometry does not match certified source evidence.');
 });
 return input;
}

export function verifyHeroRuntimeBundleBytes(bundle:HeroRuntimeBundle,files:ReadonlyMap<string,Uint8Array>){
 validateHeroRuntimeBundle(bundle);
 if(files.size!==3)throw new Error('Hero runtime byte set must contain exactly three files.');
 for(const lod of bundle.lods){
  const bytes=files.get(lod.fileName);if(!bytes)throw new Error(`Missing runtime bytes for ${lod.fileName}.`);
  if(bytes.byteLength!==lod.downloadBytes)throw new Error(`Runtime byte length mismatch for ${lod.fileName}.`);
  if(sha256RuntimeBytes(bytes)!==lod.sha256)throw new Error(`Runtime SHA-256 mismatch for ${lod.fileName}.`);
  const measured=inspectHeroRuntimeGlb(bytes);
  if(measured.vertices!==lod.vertices||measured.triangles!==lod.triangles)throw new Error(`Runtime GLB geometry mismatch for ${lod.fileName}.`);
 }
 for(const name of files.keys())if(!bundle.lods.some(l=>l.fileName===name))throw new Error(`Unexpected runtime file ${name}.`);
 return true;
}
