export type AvatarTextureSamplerAudit={valid:boolean;issues:string[];mipmappedSamplerCount:number;repeatSamplerCount:number};

type Sampler={magFilter?:number;minFilter?:number;wrapS?:number;wrapT?:number};
type Texture={sampler?:number};
type GltfSamplerGraph={textures?:Texture[];samplers?:Sampler[]};

const MAG=new Set([9728,9729]);
const MIN=new Set([9728,9729,9984,9985,9986,9987]);
const MIP_MIN=new Set([9984,9985,9986,9987]);
const WRAP=new Set([33071,33648,10497]);
const ANDROID_MAG=9729;
const ANDROID_MIP_MIN=9987;

export function auditAvatarTextureSamplers(gltf:GltfSamplerGraph,textureMipChainsComplete:boolean):AvatarTextureSamplerAudit{
 const issues:string[]=[];let mipmappedSamplerCount=0,repeatSamplerCount=0;
 const textures=gltf.textures??[],samplers=gltf.samplers??[];
 textures.forEach((texture,textureIndex)=>{
  if(texture.sampler===undefined){issues.push(`Texture ${textureIndex} must declare an explicit runtime sampler.`);return;}
  if(!Number.isSafeInteger(texture.sampler)||texture.sampler<0||texture.sampler>=samplers.length){issues.push(`Texture ${textureIndex} references an invalid sampler.`);return;}
  const sampler=samplers[texture.sampler];
  if(sampler.magFilter===undefined||!MAG.has(sampler.magFilter))issues.push(`Texture ${textureIndex} sampler must declare a valid magFilter.`);
  else if(sampler.magFilter!==ANDROID_MAG)issues.push(`Texture ${textureIndex} must use LINEAR magnification for the Android avatar runtime.`);
  if(sampler.minFilter===undefined||!MIN.has(sampler.minFilter))issues.push(`Texture ${textureIndex} sampler must declare a valid minFilter.`);
  else if(MIP_MIN.has(sampler.minFilter)){
   mipmappedSamplerCount++;
   if(!textureMipChainsComplete)issues.push(`Texture ${textureIndex} requests mip filtering without a complete mip chain.`);
   if(sampler.minFilter!==ANDROID_MIP_MIN)issues.push(`Texture ${textureIndex} must use LINEAR_MIPMAP_LINEAR minification for the Android avatar runtime.`);
  }else if(textureMipChainsComplete)issues.push(`Texture ${textureIndex} embeds a complete mip chain but its sampler does not consume mipmaps.`);
  if(sampler.wrapS===undefined||sampler.wrapT===undefined){issues.push(`Texture ${textureIndex} sampler must declare explicit wrapS and wrapT modes.`);return;}
  if(!WRAP.has(sampler.wrapS)||!WRAP.has(sampler.wrapT)){issues.push(`Texture ${textureIndex} sampler uses an invalid wrap mode.`);return;}
  if(sampler.wrapS===33648||sampler.wrapT===33648)issues.push(`Texture ${textureIndex} uses MIRRORED_REPEAT, which is outside the certified Android avatar sampler profile.`);
  if(sampler.wrapS===10497||sampler.wrapT===10497)repeatSamplerCount++;
 });
 return{valid:issues.length===0,issues,mipmappedSamplerCount,repeatSamplerCount};
}
