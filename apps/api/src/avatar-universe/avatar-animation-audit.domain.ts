type Accessor={componentType?:number;count?:number;type?:string;bufferView?:number};
type AnimationSampler={input?:number;output?:number;interpolation?:string};
type AnimationChannel={sampler?:number;target?:{node?:number;path?:string}};
type Animation={name?:string;samplers?:AnimationSampler[];channels?:AnimationChannel[]};
type Node={name?:string};
type Gltf={accessors?:Accessor[];nodes?:Node[];animations?:Animation[]};

export type AvatarAnimationAudit={
 valid:boolean; issues:string[]; animationCount:number; channelCount:number;
 animatedNodeCount:number; rotationChannelCount:number; morphWeightChannelCount:number;
};

const PATHS=new Set(['translation','rotation','scale','weights']);
const INTERPOLATIONS=new Set(['LINEAR','STEP','CUBICSPLINE']);
const OUTPUT_WIDTH:Record<string,string>={translation:'VEC3',rotation:'VEC4',scale:'VEC3'};

/** Fail-closed structural certification for glTF avatar animation clips.
 * Binary bounds/finite-number validation remains the parser's responsibility;
 * this audit proves that animation graph references and accessor contracts are coherent.
 */
export function auditAvatarAnimations(g:Gltf):AvatarAnimationAudit{
 const issues:string[]=[];const animations=g.animations??[],accessors=g.accessors??[],nodes=g.nodes??[];
 let channelCount=0,rotationChannelCount=0,morphWeightChannelCount=0;const animatedNodes=new Set<number>();
 const issue=(m:string)=>issues.push(m);
 animations.forEach((animation,ai)=>{
  const samplers=animation.samplers??[],channels=animation.channels??[];
  if(!animation.name?.trim())issue(`Animation ${ai} requires a stable non-empty name.`);
  if(!samplers.length||!channels.length)issue(`Animation ${ai} must contain samplers and channels.`);
  const targets=new Set<string>();
  channels.forEach((channel,ci)=>{
   channelCount++;const si=channel.sampler,ni=channel.target?.node,path=channel.target?.path;
   if(!Number.isSafeInteger(si)||si!<0||si!>=samplers.length){issue(`Animation ${ai} channel ${ci} references an invalid sampler.`);return;}
   if(!Number.isSafeInteger(ni)||ni!<0||ni!>=nodes.length){issue(`Animation ${ai} channel ${ci} references an invalid target node.`);return;}
   if(!path||!PATHS.has(path)){issue(`Animation ${ai} channel ${ci} has an unsupported target path.`);return;}
   if(!nodes[ni as number]?.name?.trim())issue(`Animation ${ai} channel ${ci} target node requires a stable name.`);
   const targetKey=`${ni}:${path}`;if(targets.has(targetKey))issue(`Animation ${ai} contains duplicate channels for node ${ni} ${path}.`);targets.add(targetKey);animatedNodes.add(ni as number);
   if(path==='rotation')rotationChannelCount++;if(path==='weights')morphWeightChannelCount++;
   const sampler=samplers[si as number],input=accessors[sampler.input??-1],output=accessors[sampler.output??-1];
   if(!input||input.componentType!==5126||input.type!=='SCALAR'||!Number.isSafeInteger(input.count)||input.count!<=0)issue(`Animation ${ai} sampler ${si} input must be non-empty FLOAT SCALAR time data.`);
   if(!output||output.componentType!==5126||!Number.isSafeInteger(output.count)||output.count!<=0)issue(`Animation ${ai} sampler ${si} output must use non-empty FLOAT data.`);
   const interpolation=sampler.interpolation??'LINEAR';if(!INTERPOLATIONS.has(interpolation))issue(`Animation ${ai} sampler ${si} uses unsupported interpolation ${interpolation}.`);
   if(output&&path!=='weights'&&output.type!==OUTPUT_WIDTH[path])issue(`Animation ${ai} ${path} output must be ${OUTPUT_WIDTH[path]}.`);
   if(output&&path==='weights'&&!['SCALAR','VEC2','VEC3','VEC4'].includes(output.type??''))issue(`Animation ${ai} weights output has an invalid accessor type.`);
   if(input&&output&&Number.isSafeInteger(input.count)&&Number.isSafeInteger(output.count)){
    const multiplier=interpolation==='CUBICSPLINE'?3:1;
    if(path!=='weights'&&output.count!==input.count*multiplier)issue(`Animation ${ai} sampler ${si} input/output keyframe counts are inconsistent.`);
    if(path==='weights'&&output.count!<input.count*multiplier)issue(`Animation ${ai} weights sampler ${si} has too few output values.`);
   }
  });
 });
 return{valid:issues.length===0,issues,animationCount:animations.length,channelCount,animatedNodeCount:animatedNodes.size,rotationChannelCount,morphWeightChannelCount};
}
