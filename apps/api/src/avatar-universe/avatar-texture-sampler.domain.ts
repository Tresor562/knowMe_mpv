export type AvatarTextureSamplerAudit={valid:boolean;issues:string[];mipmappedSamplerCount:number;repeatSamplerCount:number};

type Sampler={magFilter?:number;minFilter?:number;wrapS?:number;wrapT?:number};
type Texture={sampler?:number};
type GltfSamplerGraph={textures?:Texture[];samplers?:Sampler[]};

const MAG=new Set([9728,9729]);
const MIN=new Set([9728,9729,9984,9985,9986,9987]);
const MIP_MIN=new Set([9984,9985,9986,9987]);
const WRAP=new Set([33071,33648,10497]);

export function auditAvatarTextureSamplers(gltf:GltfSamplerGraph,textureMipChainsComplete:boolean):AvatarTextureSamplerAudit{
 const issues:string[]=[];let mipmappedSamplerCount=0,repeatSamplerCount=0;
 const textures=gltf.textures??[],samplers=gltf.samplers??[];
 textures.forEach((texture,textureIndex)=>{
  if(texture.sampler===undefined){issues.push(`Texture ${textureIndex} must declare an explicit runtime sampler.`);return;}
  if(!Number.isSafeInteger(texture.sampler)||texture.sampler<0||texture.sampler>=samplers.length){issues.push(`Texture ${textureIndex} references an invalid sampler.`);return;}
  const sampler=samplers[texture.sampler];
  if(sampler.magFilter===undefined||!MAG.has(sampler.magFilter))issues.push(`Texture ${textureIndex} sampler must declare a valid magFilter.`);
  if(sampler.minFilter===undefined||!MIN.has(sampler.minFilter))issues.push(`Texture ${textureIndex} sampler must declare a valid minFilter.`);
  else if(MIP_MIN.has(sampler.minFilter)){mipmappedSamplerCount++;if(!textureMipChainsComplete)issues.push(`Texture ${textureIndex} requests mip filtering without a complete mip chain.`);}
  const wrapS=sampler.wrapS??10497,wrapT=sampler.wrapT??10497;
  if(!WRAP.has(wrapS)||!WRAP.has(wrapT))issues.push(`Texture ${textureIndex} sampler uses an invalid wrap mode.`);
  if(wrapS===10497||wrapT===10497)repeatSamplerCount++;
 });
 return{valid:issues.length===0,issues,mipmappedSamplerCount,repeatSamplerCount};
}
