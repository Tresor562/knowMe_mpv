import { inspectAvatarEmbeddedImage } from './avatar-image-inspection.domain';

export type AvatarTextureSemantic='SRGB'|'LINEAR';
export type AvatarTextureColorSpaceAudit={valid:boolean;issues:string[];srgbTextureCount:number;linearTextureCount:number};

type TextureInfo={index?:number};
type Material={pbrMetallicRoughness?:{baseColorTexture?:TextureInfo;metallicRoughnessTexture?:TextureInfo};normalTexture?:TextureInfo;occlusionTexture?:TextureInfo;emissiveTexture?:TextureInfo};
type Texture={source?:number;extensions?:{KHR_texture_basisu?:{source?:number}}};
type Image={bufferView?:number;mimeType?:string};
type BufferView={buffer?:number;byteOffset?:number;byteLength?:number};
type Gltf={materials?:Material[];textures?:Texture[];images?:Image[];bufferViews?:BufferView[]};

const LINEAR=1,SRGB=2;

export function auditAvatarTextureColorSpaces(g:Gltf,bin:Uint8Array|undefined):AvatarTextureColorSpaceAudit{
 const textures=g.textures??[],images=g.images??[],views=g.bufferViews??[];
 const usage=new Map<number,Set<AvatarTextureSemantic>>();
 const use=(info:TextureInfo|undefined,semantic:AvatarTextureSemantic)=>{if(!info||!Number.isSafeInteger(info.index))return;const index=info.index as number;let set=usage.get(index);if(!set){set=new Set();usage.set(index,set);}set.add(semantic);};
 for(const material of g.materials??[]){const p=material.pbrMetallicRoughness;use(p?.baseColorTexture,'SRGB');use(material.emissiveTexture,'SRGB');use(p?.metallicRoughnessTexture,'LINEAR');use(material.normalTexture,'LINEAR');use(material.occlusionTexture,'LINEAR');}
 const issues:string[]=[];let srgbTextureCount=0,linearTextureCount=0;
 for(const [textureIndex,semantics] of usage){
  if(textureIndex<0||textureIndex>=textures.length)continue;
  if(semantics.size>1){issues.push(`Texture ${textureIndex} is shared between sRGB and linear material channels.`);continue;}
  const semantic=[...semantics][0];if(semantic==='SRGB')srgbTextureCount++;else linearTextureCount++;
  const texture=textures[textureIndex],source=texture.extensions?.KHR_texture_basisu?.source??texture.source;
  if(!Number.isSafeInteger(source)||source!<0||source!>=images.length)continue;
  const image=images[source as number];
  // PNG/JPEG color management is handled by the runtime import contract. KTX2 carries an explicit DFD transfer function, so it is certifiable here.
  if(image?.mimeType!=='image/ktx2')continue;
  if(image.bufferView===undefined||!bin){issues.push(`KTX2 texture ${textureIndex} cannot be inspected for color space.`);continue;}
  const view=views[image.bufferView];if(!view||view.buffer!==0||!Number.isSafeInteger(view.byteLength)){issues.push(`KTX2 texture ${textureIndex} has an invalid embedded bufferView.`);continue;}
  const start=view.byteOffset??0,end=start+(view.byteLength as number);if(start<0||end>bin.length){issues.push(`KTX2 texture ${textureIndex} exceeds the embedded BIN payload.`);continue;}
  const transfer=inspectAvatarEmbeddedImage(bin.subarray(start,end),'image/ktx2').ktx2?.dfdTransferFunction;
  const expected=semantic==='SRGB'?SRGB:LINEAR;if(transfer!==expected)issues.push(`KTX2 texture ${textureIndex} uses ${transfer===SRGB?'sRGB':'linear'} transfer for a ${semantic.toLowerCase()} material channel.`);
 }
 return{valid:issues.length===0,issues,srgbTextureCount,linearTextureCount};
}
