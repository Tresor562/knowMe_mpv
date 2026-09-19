import {HERO_RUNTIME_MAX_TEXTURE_DIMENSION,inspectHeroRuntimePbrGlb} from './hero-runtime-pbr-v14.domain';

type Mutator=(doc:any)=>void;
const png=(w:number,h:number)=>{const b=new Uint8Array(24);b.set([137,80,78,71,13,10,26,10],0);b.set([73,72,68,82],12);const v=new DataView(b.buffer);v.setUint32(16,w,false);v.setUint32(20,h,false);return b;};
const make=(mutate?:Mutator,size=1024)=>{const images=[png(size,size),png(size,size),png(size,size)];let cursor=0;const views=images.map(x=>{const r={buffer:0,byteOffset:cursor,byteLength:x.length};cursor+=x.length;return r;});const binLength=(cursor+3)&~3;const doc:any={asset:{version:'2.0'},buffers:[{byteLength:binLength}],bufferViews:views,images:views.map((_,i)=>({bufferView:i,mimeType:'image/png'})),textures:[{source:0},{source:1},{source:2}],materials:[{pbrMetallicRoughness:{baseColorTexture:{index:0},metallicRoughnessTexture:{index:2}},normalTexture:{index:1},occlusionTexture:{index:2}}],meshes:[{primitives:[{material:0}]}]};mutate?.(doc);const raw=new TextEncoder().encode(JSON.stringify(doc)),padded=(raw.length+3)&~3;const out=new Uint8Array(20+padded+8+binLength),v=new DataView(out.buffer);v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,out.length,true);v.setUint32(12,padded,true);v.setUint32(16,0x4e4f534a,true);out.fill(32,20,20+padded);out.set(raw,20);const bh=20+padded;v.setUint32(bh,binLength,true);v.setUint32(bh+4,0x004e4942,true);let p=bh+8;for(const image of images){out.set(image,p);p+=image.length;}return out;};

describe('Hero runtime PBR v14',()=>{
 it('accepts embedded BaseColor + Normal + packed ORM within Android budget',()=>expect(inspectHeroRuntimePbrGlb(make())).toEqual({materialCount:1,textureImageCount:3,estimatedGpuTextureBytes:3*1024*1024*4}));
 it('rejects primitives without authoritative material binding',()=>expect(()=>inspectHeroRuntimePbrGlb(make(d=>delete d.meshes[0].primitives[0].material))).toThrow(/reference a material/));
 it('rejects missing baseColor textures',()=>expect(()=>inspectHeroRuntimePbrGlb(make(d=>delete d.materials[0].pbrMetallicRoughness.baseColorTexture))).toThrow(/baseColor/));
 it('rejects missing normal maps',()=>expect(()=>inspectHeroRuntimePbrGlb(make(d=>delete d.materials[0].normalTexture))).toThrow(/normal/));
 it('rejects unpacked ORM textures',()=>expect(()=>inspectHeroRuntimePbrGlb(make(d=>{d.textures.push({source:2});d.materials[0].occlusionTexture.index=3;}))).toThrow(/ORM/));
 it('rejects external texture URIs',()=>expect(()=>inspectHeroRuntimePbrGlb(make(d=>{d.images[0]={uri:'https://evil.invalid/a.png',mimeType:'image/png'};}))).toThrow(/embedded/));
 it('rejects unverifiable image formats',()=>expect(()=>inspectHeroRuntimePbrGlb(make(d=>{d.images[0].mimeType='image/webp';}))).toThrow(/PNG or JPEG/));
 it('rejects textures above the mobile dimension budget',()=>expect(()=>inspectHeroRuntimePbrGlb(make(undefined,HERO_RUNTIME_MAX_TEXTURE_DIMENSION+1))).toThrow(/dimension budget/));
 it('rejects aggregate decoded texture memory above the Android GPU budget while each texture stays <= 2K',()=>expect(()=>inspectHeroRuntimePbrGlb(make(undefined,1800))).toThrow(/GPU memory budget/));
 it('rejects unused materials that could hide unvalidated payloads',()=>expect(()=>inspectHeroRuntimePbrGlb(make(d=>d.materials.push(JSON.parse(JSON.stringify(d.materials[0])))))).toThrow(/unused materials/));
});
