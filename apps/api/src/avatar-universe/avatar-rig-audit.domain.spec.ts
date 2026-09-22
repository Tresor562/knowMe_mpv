import { auditAvatarRig } from './avatar-rig-audit.domain';
const base=()=>({nodes:[{name:'Hips',children:[1]},{name:'Spine'}],accessors:[{componentType:5126,type:'MAT4',count:2,bufferView:0}],skins:[{joints:[0,1],skeleton:0,inverseBindMatrices:0}]});
describe('Avatar rig audit',()=>{
 it('accepts a uniquely rooted named rig with matching inverse bind matrices',()=>expect(auditAvatarRig(base())).toEqual({valid:true,issues:[],skinCount:1,jointCount:2,rootCount:1,skinnedNodeCount:0}));
 it('rejects duplicate joints',()=>{const g:any=base();g.skins[0].joints=[0,0];expect(auditAvatarRig(g).issues.join(' ')).toMatch(/duplicate joint/);});
 it('rejects unnamed joints and duplicate stable names',()=>{const g:any=base();g.nodes[1].name='';expect(auditAvatarRig(g).issues.join(' ')).toMatch(/stable name/);const h:any=base();h.nodes[1].name='Hips';expect(auditAvatarRig(h).issues.join(' ')).toMatch(/names must be unique/);});
 it('requires inverse bind matrices to match the joint count',()=>{const g:any=base();g.accessors[0].count=1;expect(auditAvatarRig(g).issues.join(' ')).toMatch(/inverse bind matrices/);});
 it('rejects multiple hierarchy roots',()=>{const g:any=base();g.nodes[0].children=[];expect(auditAvatarRig(g).issues.join(' ')).toMatch(/exactly one joint root/);});
 it('rejects a declared skeleton node that is not a joint',()=>{const g:any=base();g.nodes.push({name:'SceneRoot'});g.skins[0].skeleton=2;expect(auditAvatarRig(g).issues.join(' ')).toMatch(/must reference one of its joints/);});
 it('rejects cycles in the joint hierarchy',()=>{const g:any=base();g.nodes[1].children=[0];expect(auditAvatarRig(g).issues.join(' ')).toMatch(/cycle/);});
 it('rejects skinned nodes that reference nonexistent skins',()=>{const g:any=base();g.nodes.push({name:'Body',skin:4});expect(auditAvatarRig(g).issues.join(' ')).toMatch(/invalid skin/);});
});
