import { inspectAvatarGlb } from './avatar-glb-parser.domain';

function glb(json: unknown) {
  const encoded = new TextEncoder().encode(JSON.stringify(json));
  const padded = new Uint8Array(Math.ceil(encoded.length / 4) * 4); padded.set(encoded); padded.fill(0x20, encoded.length);
  const out = new Uint8Array(20 + padded.length); const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, out.length, true);
  view.setUint32(12, padded.length, true); view.setUint32(16, 0x4e4f534a, true); out.set(padded, 20); return out;
}
const doc = () => ({
  asset:{version:'2.0'}, accessors:[{count:6},{count:6},{count:6}],
  materials:[{pbrMetallicRoughness:{}}], textures:[{}],
  nodes:[{name:'root'},{name:'hips'}], skins:[{joints:[0,1]}],
  meshes:[{extras:{targetNames:['bodyMass']},primitives:[{indices:0,attributes:{POSITION:1,JOINTS_0:2,WEIGHTS_0:2},targets:[{POSITION:1}]}]}],
});
describe('Avatar GLB binary inspector',()=>{
  it('derives geometry, skin, PBR and morph observations from GLB bytes',()=>{const x=inspectAvatarGlb(glb(doc()));expect(x.triangles).toBe(2);expect(x.vertices).toBe(6);expect(x.joints).toEqual(['root','hips']);expect(x.morphTargets).toEqual(['bodyMass']);expect(x.maxBonesPerVertex).toBe(4);expect(x.pbrMetallicRoughness).toBe(true);expect(x.sha256).toMatch(/^[a-f0-9]{64}$/);});
  it('rejects forged container length',()=>{const b=glb(doc());new DataView(b.buffer).setUint32(8,b.length-4,true);expect(()=>inspectAvatarGlb(b)).toThrow(/declared length/);});
  it('rejects non triangle primitives',()=>{const x:any=doc();x.meshes[0].primitives[0].mode=1;expect(()=>inspectAvatarGlb(glb(x))).toThrow(/TRIANGLES/);});
  it('rejects non-indexed runtime geometry',()=>{const x:any=doc();delete x.meshes[0].primitives[0].indices;expect(()=>inspectAvatarGlb(glb(x))).toThrow(/indexed/);});
  it('detects second joint set as eight possible influences',()=>{const x:any=doc();x.meshes[0].primitives[0].attributes.JOINTS_1=2;x.meshes[0].primitives[0].attributes.WEIGHTS_1=2;expect(inspectAvatarGlb(glb(x)).maxBonesPerVertex).toBe(8);});
  it('rejects unnamed skin joints',()=>{const x:any=doc();delete x.nodes[1].name;expect(()=>inspectAvatarGlb(glb(x))).toThrow(/stable node names/);});
  it('rejects anonymous morph targets',()=>{const x:any=doc();delete x.meshes[0].extras;expect(()=>inspectAvatarGlb(glb(x))).toThrow(/targetNames/);});
});
