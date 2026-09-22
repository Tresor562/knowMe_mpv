type Accessor={bufferView?:number;byteOffset?:number;componentType?:number;count?:number;type?:string};
type BufferView={buffer?:number;byteOffset?:number;byteLength?:number;byteStride?:number};
type AnimationSampler={input?:number;output?:number;interpolation?:string};
type AnimationChannel={sampler?:number;target?:{node?:number;path?:string}};
type Animation={name?:string;samplers?:AnimationSampler[];channels?:AnimationChannel[]};
type Gltf={accessors?:Accessor[];bufferViews?:BufferView[];animations?:Animation[]};

export type AvatarAnimationBinaryAudit={
 valid:boolean;issues:string[];keyframeCount:number;maxClipDurationSeconds:number;
 nonFiniteValueCount:number;nonNormalizedQuaternionCount:number;
};

const FLOAT=5126;
const WIDTH:Record<string,number>={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};

function readFloatAccessor(g:Gltf,bin:Uint8Array|undefined,index:number,label:string){
 const a=g.accessors?.[index];if(!a||a.componentType!==FLOAT||!a.type||!WIDTH[a.type]||!Number.isSafeInteger(a.count)||a.count!<0||a.bufferView===undefined)throw new Error(`${label} must be an embedded FLOAT accessor.`);
 const bv=g.bufferViews?.[a.bufferView];if(!bv||bv.buffer!==0||!bin)throw new Error(`${label} must reference the embedded BIN buffer.`);
 const width=WIDTH[a.type],stride=bv.byteStride??width*4;if(stride<width*4||stride%4!==0)throw new Error(`${label} has an invalid byteStride.`);
 const start=(bv.byteOffset??0)+(a.byteOffset??0),end=start+(a.count?((a.count-1)*stride+width*4):0),viewEnd=(bv.byteOffset??0)+(bv.byteLength??0);
 if(start<0||end>bin.byteLength||end>viewEnd)throw new Error(`${label} exceeds its bufferView.`);
 const view=new DataView(bin.buffer,bin.byteOffset,bin.byteLength),rows:number[][]=[];
 for(let i=0;i<a.count;i++){const row:number[]=[];for(let j=0;j<width;j++)row.push(view.getFloat32(start+i*stride+j*4,true));rows.push(row);}return rows;
}

/** Reads actual animation payloads. Structural graph validation is intentionally separate.
 * This gate proves monotonic time, finite payloads and unit quaternions for Android runtime safety. */
export function auditAvatarAnimationBinary(g:Gltf,bin:Uint8Array|undefined):AvatarAnimationBinaryAudit{
 const issues:string[]=[];let keyframeCount=0,maxClipDurationSeconds=0,nonFiniteValueCount=0,nonNormalizedQuaternionCount=0;
 const issue=(m:string)=>issues.push(m);
 (g.animations??[]).forEach((animation,ai)=>{
  let clipEnd=0;const samplers=animation.samplers??[];
  samplers.forEach((sampler,si)=>{
   try{
    const times=readFloatAccessor(g,bin,sampler.input??-1,`Animation ${ai} sampler ${si} input`);
    keyframeCount+=times.length;let previous=-Infinity;
    times.forEach((row,ki)=>{const t=row[0];if(!Number.isFinite(t)){nonFiniteValueCount++;issue(`Animation ${ai} sampler ${si} time ${ki} is not finite.`);}else{if(t<0)issue(`Animation ${ai} sampler ${si} time ${ki} is negative.`);if(t<=previous)issue(`Animation ${ai} sampler ${si} times must be strictly increasing.`);previous=t;clipEnd=Math.max(clipEnd,t);}});
   }catch(e){issue(e instanceof Error?e.message:String(e));}
  });
  for(const [ci,channel] of (animation.channels??[]).entries()){
   const sampler=samplers[channel.sampler??-1];if(!sampler)continue;
   try{
    const rows=readFloatAccessor(g,bin,sampler.output??-1,`Animation ${ai} channel ${ci} output`);
    rows.forEach((row,ri)=>{for(const value of row)if(!Number.isFinite(value)){nonFiniteValueCount++;issue(`Animation ${ai} channel ${ci} output ${ri} contains a non-finite value.`);}
     if(channel.target?.path==='rotation'&&row.length===4&&row.every(Number.isFinite)){
      const norm=Math.hypot(...row);if(Math.abs(norm-1)>1e-3){nonNormalizedQuaternionCount++;issue(`Animation ${ai} channel ${ci} quaternion ${ri} is not normalized.`);}
     }});
   }catch(e){issue(e instanceof Error?e.message:String(e));}
  }
  maxClipDurationSeconds=Math.max(maxClipDurationSeconds,clipEnd);
 });
 return{valid:issues.length===0,issues,keyframeCount,maxClipDurationSeconds,nonFiniteValueCount,nonNormalizedQuaternionCount};
}
