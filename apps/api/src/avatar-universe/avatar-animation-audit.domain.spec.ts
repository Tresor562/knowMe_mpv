import { auditAvatarAnimations } from './avatar-animation-audit.domain';

const base=()=>({
 nodes:[{name:'Root'},{name:'Hips'}],
 accessors:[
  {componentType:5126,type:'SCALAR',count:2,bufferView:0},
  {componentType:5126,type:'VEC4',count:2,bufferView:1},
  {componentType:5126,type:'VEC3',count:2,bufferView:2},
 ],
 animations:[{name:'idle',samplers:[{input:0,output:1,interpolation:'LINEAR'}],channels:[{sampler:0,target:{node:1,path:'rotation'}}]}],
});

describe('Avatar glTF animation audit',()=>{
 it('accepts a named FLOAT quaternion rotation clip',()=>expect(auditAvatarAnimations(base())).toMatchObject({valid:true,animationCount:1,channelCount:1,animatedNodeCount:1,rotationChannelCount:1}));
 it('rejects anonymous clips because runtime clip identity must be stable',()=>{const g=base();g.animations[0].name='';expect(auditAvatarAnimations(g).issues.join(' ')).toMatch(/stable non-empty name/);});
 it('rejects invalid sampler and node references',()=>{const g:any=base();g.animations[0].channels=[{sampler:9,target:{node:1,path:'rotation'}},{sampler:0,target:{node:9,path:'rotation'}}];const x=auditAvatarAnimations(g);expect(x.valid).toBe(false);expect(x.issues.join(' ')).toMatch(/invalid sampler/);expect(x.issues.join(' ')).toMatch(/invalid target node/);});
 it('rejects non-FLOAT or non-SCALAR animation time accessors',()=>{const g:any=base();g.accessors[0]={componentType:5123,type:'VEC2',count:2};expect(auditAvatarAnimations(g).issues.join(' ')).toMatch(/FLOAT SCALAR/);});
 it('rejects rotation outputs that are not FLOAT VEC4',()=>{const g:any=base();g.accessors[1]={componentType:5126,type:'VEC3',count:2};expect(auditAvatarAnimations(g).issues.join(' ')).toMatch(/rotation output must be VEC4/);});
 it('rejects duplicate channels targeting the same node property',()=>{const g:any=base();g.animations[0].channels.push({sampler:0,target:{node:1,path:'rotation'}});expect(auditAvatarAnimations(g).issues.join(' ')).toMatch(/duplicate channels/);});
 it('enforces CUBICSPLINE output cardinality',()=>{const g:any=base();g.animations[0].samplers[0].interpolation='CUBICSPLINE';expect(auditAvatarAnimations(g).issues.join(' ')).toMatch(/keyframe counts are inconsistent/);g.accessors[1].count=6;expect(auditAvatarAnimations(g).valid).toBe(true);});
 it('rejects unnamed animation target nodes',()=>{const g=base();g.nodes[1].name='';expect(auditAvatarAnimations(g).issues.join(' ')).toMatch(/target node requires a stable name/);});
 it('rejects unsupported interpolation and target paths',()=>{const g:any=base();g.animations[0].samplers[0].interpolation='BEZIER';g.animations[0].channels[0].target.path='matrix';const x=auditAvatarAnimations(g);expect(x.valid).toBe(false);expect(x.issues.join(' ')).toMatch(/unsupported target path/);});
});
