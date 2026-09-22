type Skin={inverseBindMatrices?:number;skeleton?:number;joints?:number[]};
type Node={name?:string;children?:number[];mesh?:number;skin?:number};
type Accessor={componentType?:number;count?:number;type?:string;bufferView?:number};
type Gltf={skins?:Skin[];nodes?:Node[];accessors?:Accessor[]};
export type AvatarRigAudit={valid:boolean;issues:string[];skinCount:number;jointCount:number;rootCount:number;skinnedNodeCount:number};

/** Structural rig certification. It deliberately rejects ambiguous rigs: duplicate joints,
 * unnamed joints, cycles, missing inverse-bind matrices and skins without a unique root. */
export function auditAvatarRig(g:Gltf):AvatarRigAudit{
 const issues:string[]=[];const skins=g.skins??[],nodes=g.nodes??[],accessors=g.accessors??[];const allJoints=new Set<number>();let rootCount=0,skinnedNodeCount=0;
 const issue=(m:string)=>issues.push(m);
 nodes.forEach((n,i)=>{if(n.skin!==undefined){skinnedNodeCount++;if(!Number.isSafeInteger(n.skin)||n.skin!<0||n.skin!>=skins.length)issue(`Node ${i} references an invalid skin.`);}});
 skins.forEach((skin,si)=>{
  const joints=skin.joints??[];if(!joints.length){issue(`Skin ${si} must contain joints.`);return;}
  const local=new Set<number>();for(const j of joints){if(!Number.isSafeInteger(j)||j!<0||j!>=nodes.length){issue(`Skin ${si} contains an invalid joint node.`);continue;}if(local.has(j))issue(`Skin ${si} contains duplicate joint ${j}.`);local.add(j);allJoints.add(j);if(!nodes[j]?.name?.trim())issue(`Skin ${si} joint ${j} requires a stable name.`);}
  const names=[...local].map(j=>nodes[j]?.name).filter(Boolean) as string[];if(new Set(names).size!==names.length)issue(`Skin ${si} joint names must be unique.`);
  const ibm=accessors[skin.inverseBindMatrices??-1];if(!ibm||ibm.componentType!==5126||ibm.type!=='MAT4'||ibm.count!==joints.length||ibm.bufferView===undefined)issue(`Skin ${si} requires FLOAT MAT4 inverse bind matrices matching its joint count.`);
  const parents=new Map<number,number>();nodes.forEach((node,parent)=>{for(const child of node.children??[]){if(!Number.isSafeInteger(child)||child!<0||child!>=nodes.length){issue(`Node ${parent} contains an invalid child reference.`);continue;}if(parents.has(child)&&parents.get(child)!==parent)issue(`Node ${child} has multiple parents.`);parents.set(child,parent);}});
  const roots=[...local].filter(j=>!local.has(parents.get(j)??-1));rootCount+=roots.length;if(roots.length!==1)issue(`Skin ${si} must have exactly one joint root.`);
  if(skin.skeleton!==undefined&&(!Number.isSafeInteger(skin.skeleton)||!local.has(skin.skeleton)))issue(`Skin ${si} skeleton root must reference one of its joints.`);
  if(skin.skeleton!==undefined&&roots.length===1&&skin.skeleton!==roots[0])issue(`Skin ${si} skeleton root does not match the hierarchy root.`);
  for(const start of local){const seen=new Set<number>();let cur:number|undefined=start;while(cur!==undefined&&local.has(cur)){if(seen.has(cur)){issue(`Skin ${si} joint hierarchy contains a cycle.`);break;}seen.add(cur);cur=parents.get(cur);}}
 });
 return{valid:issues.length===0,issues,skinCount:skins.length,jointCount:allJoints.size,rootCount,skinnedNodeCount};
}
