import { HeroRuntimeBundle, verifyHeroRuntimeBundleBytes } from './hero-runtime-bundle-v13.domain';

export const HERO_RUNTIME_PBR_GATE_VERSION=14 as const;
export const HERO_RUNTIME_MAX_TEXTURE_DIMENSION=2048 as const;
export const HERO_RUNTIME_MAX_GPU_TEXTURE_BYTES=48*1024*1024 as const;
const GLB_JSON=0x4e4f534a,GLB_BIN=0x004e4942;
const nonNegativeInt=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const positiveInt=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0;

function parse(bytes:Uint8Array){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);if(bytes.byteLength<28||view.getUint32(12,true)<=0||view.getUint32(16,true)!==GLB_JSON)throw new Error('Runtime PBR gate requires a valid GLB JSON chunk.');
 const jsonLength=view.getUint32(12,true);let doc:any;try{doc=JSON.parse(new TextDecoder().decode(bytes.subarray(20,20+jsonLength)).trim());}catch{throw new Error('Runtime PBR gate cannot parse GLB JSON.');}
 const binHeader=20+jsonLength;if(binHeader+8>bytes.byteLength||view.getUint32(binHeader+4,true)!==GLB_BIN)throw new Error('Runtime PBR gate requires an embedded BIN chunk.');
 return {doc,binStart:binHeader+8,binLength:view.getUint32(binHeader,true)};
}
function pngSize(data:Uint8Array){if(data.length<24||data[0]!==137||data[1]!==80||data[2]!==78||data[3]!==71||data[12]!==73||data[13]!==72||data[14]!==68||data[15]!==82)return null;const v=new DataView(data.buffer,data.byteOffset,data.byteLength);return [v.getUint32(16,false),v.getUint32(20,false)] as const;}
function jpegSize(data:Uint8Array){if(data.length<4||data[0]!==0xff||data[1]!==0xd8)return null;let p=2;while(p+8<data.length){if(data[p]!==0xff){p++;continue;}const marker=data[p+1],len=(data[p+2]<<8)|data[p+3];if(len<2||p+2+len>data.length)return null;if(marker>=0xc0&&marker<=0xc3)return [(data[p+7]<<8)|data[p+8],(data[p+5]<<8)|data[p+6]] as const;p+=2+len;}return null;}
function textureIndex(doc:any,slot:any,label:string){const i=slot?.index;if(!nonNegativeInt(i)||!Array.isArray(doc.textures)||!doc.textures[i])throw new Error(`Runtime PBR ${label} texture is missing or invalid.`);const source=doc.textures[i].source;if(!nonNegativeInt(source)||!Array.isArray(doc.images)||!doc.images[source])throw new Error(`Runtime PBR ${label} image source is invalid.`);return {texture:i,image:source};}

export function inspectHeroRuntimePbrGlb(bytes:Uint8Array){
 const {doc,binStart,binLength}=parse(bytes);if(!Array.isArray(doc.materials)||doc.materials.length<1)throw new Error('Runtime PBR requires at least one material.');
 const used=new Set<number>();if(!Array.isArray(doc.meshes))throw new Error('Runtime PBR requires meshes.');
 for(const mesh of doc.meshes)for(const primitive of mesh?.primitives??[]){if(!nonNegativeInt(primitive.material)||!doc.materials[primitive.material])throw new Error('Runtime PBR primitive must reference a material.');used.add(primitive.material);}
 if(used.size!==doc.materials.length)throw new Error('Runtime PBR contains unused materials.');
 const imageIds=new Set<number>();for(const id of used){const m=doc.materials[id],p=m.pbrMetallicRoughness;if(!p)throw new Error('Runtime PBR material is missing metallic-roughness data.');const base=textureIndex(doc,p.baseColorTexture,'baseColor'),normal=textureIndex(doc,m.normalTexture,'normal'),mr=textureIndex(doc,p.metallicRoughnessTexture,'metallicRoughness'),occ=textureIndex(doc,m.occlusionTexture,'occlusion');if(mr.texture!==occ.texture)throw new Error('Runtime PBR ORM must pack occlusion and metallic-roughness into one texture.');for(const x of [base,normal,mr])imageIds.add(x.image);}
 let gpuBytes=0;for(const imageId of imageIds){const image=doc.images[imageId];if(image.uri!==undefined||!nonNegativeInt(image.bufferView)||!doc.bufferViews?.[image.bufferView])throw new Error('Runtime PBR images must be embedded bufferViews.');if(!['image/png','image/jpeg'].includes(image.mimeType))throw new Error('Runtime PBR image format must be PNG or JPEG.');const bv=doc.bufferViews[image.bufferView];if(bv.buffer!==0||!positiveInt(bv.byteLength)||!nonNegativeInt(bv.byteOffset??0)||(bv.byteOffset??0)+bv.byteLength>binLength)throw new Error('Runtime PBR image bufferView is invalid.');const data=bytes.subarray(binStart+(bv.byteOffset??0),binStart+(bv.byteOffset??0)+bv.byteLength);const size=image.mimeType==='image/png'?pngSize(data):jpegSize(data);if(!size||!positiveInt(size[0])||!positiveInt(size[1]))throw new Error('Runtime PBR image dimensions cannot be verified.');if(size[0]>HERO_RUNTIME_MAX_TEXTURE_DIMENSION||size[1]>HERO_RUNTIME_MAX_TEXTURE_DIMENSION)throw new Error('Runtime PBR texture exceeds mobile dimension budget.');gpuBytes+=size[0]*size[1]*4;}
 if(gpuBytes>HERO_RUNTIME_MAX_GPU_TEXTURE_BYTES)throw new Error('Runtime PBR textures exceed estimated Android GPU memory budget.');return {materialCount:doc.materials.length,textureImageCount:imageIds.size,estimatedGpuTextureBytes:gpuBytes};
}

export function verifyHeroRuntimeBundlePbrBytes(bundle:HeroRuntimeBundle,files:ReadonlyMap<string,Uint8Array>){verifyHeroRuntimeBundleBytes(bundle,files);const lods=bundle.lods.map(l=>{const bytes=files.get(l.fileName);if(!bytes)throw new Error(`Missing runtime bytes for ${l.fileName}.`);return inspectHeroRuntimePbrGlb(bytes);});return {gateVersion:HERO_RUNTIME_PBR_GATE_VERSION,lods};}
