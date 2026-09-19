"""KnowMe Hero Avatar production measurement exporter.

Run inside Blender after opening the real Hero .blend. It inspects evaluated geometry,
skinning, UVs, PBR maps and canonical Avatar DNA morph targets and writes the v9 report.
Generated concept art is never treated as runtime 3D.
"""
from __future__ import annotations
import json, math
from pathlib import Path
import bpy

REPORT_VERSION=9
ASSET_KEY="knowme.hero.blockout.v1"
SKELETON="knowme.humanoid.v1"
REQUIRED=("BODY","EYE_L","EYE_R")
OPTIONAL=("TEETH","TONGUE","HAIR_PLACEHOLDER")
ALLOWED=set(REQUIRED+OPTIONAL)
DNA_MORPHS=("dna_body_height","dna_shoulder_width","dna_torso_mass","dna_hip_width","dna_face_width","dna_jaw_width","dna_nose_size","dna_eye_size")
EPSILON=1e-5
SPATIAL_TOLERANCE_M=0.002
UV_TOLERANCE=1e-5
A_POSE_MIN_ARM_ANGLE_DEG=25.0
A_POSE_MAX_ARM_ANGLE_DEG=60.0
A_POSE_SIDE_SYMMETRY_DEG=8.0
MAX_BODY_BONE_INFLUENCES=4
MAX_BODY_WEIGHT_SUM_ERROR=0.02
MAX_MATERIALS_PER_OBJECT=2
MAX_TEXTURE_DIMENSION=2048
MAX_TOTAL_TEXTURE_PIXELS=4*2048*2048
MAX_DNA_VERTEX_DELTA_M=0.35

def _is_manifold(mesh):
 import bmesh; bm=bmesh.new()
 try: bm.from_mesh(mesh); return all(e.is_manifold for e in bm.edges)
 finally: bm.free()

def _evaluated_mesh(obj,depsgraph):
 evaluated=obj.evaluated_get(depsgraph); mesh=evaluated.to_mesh(preserve_all_data_layers=True,depsgraph=depsgraph)
 if mesh is None: raise RuntimeError(f"Unable to evaluate mesh for {obj.name}")
 return evaluated,mesh

def _mesh_metrics(obj,depsgraph):
 if obj.type!="MESH": raise RuntimeError(f"{obj.name} must be a mesh")
 evaluated,mesh=_evaluated_mesh(obj,depsgraph)
 try:
  mesh.calc_loop_triangles(); transform_ok=all(abs(v)<EPSILON for v in obj.location) and all(abs(v)<EPSILON for v in obj.rotation_euler) and all(abs(v-1.0)<EPSILON for v in obj.scale)
  return {"role":obj.name,"vertices":len(mesh.vertices),"triangles":len(mesh.loop_triangles),"manifold":_is_manifold(mesh),"unappliedTransforms":not transform_ok,"fusedClothingOrAccessories":bool(obj.get("knowme_fused_cosmetic",False))}
 finally: evaluated.to_mesh_clear()

def _evaluated_world_bounds(obj,depsgraph):
 evaluated,mesh=_evaluated_mesh(obj,depsgraph)
 try:
  if not mesh.vertices: raise RuntimeError(f"{obj.name} has no evaluated vertices")
  points=[evaluated.matrix_world@v.co for v in mesh.vertices]; return min(v.x for v in points),max(v.x for v in points),min(v.z for v in points),max(v.z for v in points)
 finally: evaluated.to_mesh_clear()

def _validate_scene_objects(scene):
 unexpected=sorted(o.name for o in scene.objects if o.type=="MESH" and o.name not in ALLOWED)
 if unexpected: raise RuntimeError("Unexpected mesh objects in Hero scene: "+", ".join(unexpected))

def _find_armature(scene):
 armatures=[o for o in scene.objects if o.type=="ARMATURE"]
 if len(armatures)!=1: raise RuntimeError(f"Hero must contain exactly one armature; found {len(armatures)}")
 return armatures[0]

def _validate_body_skinning(body,armature):
 modifiers=[m for m in body.modifiers if m.type=="ARMATURE"]
 if len(modifiers)!=1 or modifiers[0].object!=armature: raise RuntimeError("BODY must have exactly one Armature modifier targeting the canonical Hero armature")
 deform_bones={b.name for b in armature.data.bones if b.use_deform}; group_by_index={g.index:g.name for g in body.vertex_groups}
 if not deform_bones: raise RuntimeError("Hero armature has no deform bones")
 unweighted=[]; too_many=[]; max_influences=0; max_sum_error=0.0
 for vertex in body.data.vertices:
  weights=[g.weight for g in vertex.groups if group_by_index.get(g.group) in deform_bones and g.weight>EPSILON]; count=len(weights); max_influences=max(max_influences,count)
  if count==0: unweighted.append(vertex.index); continue
  if count>MAX_BODY_BONE_INFLUENCES: too_many.append(vertex.index)
  max_sum_error=max(max_sum_error,abs(sum(weights)-1.0))
 if unweighted: raise RuntimeError(f"BODY has {len(unweighted)} vertices without canonical deform-bone weights")
 if too_many: raise RuntimeError(f"BODY has {len(too_many)} vertices exceeding {MAX_BODY_BONE_INFLUENCES} deform-bone influences")
 if max_sum_error>MAX_BODY_WEIGHT_SUM_ERROR: raise RuntimeError(f"BODY deform weights are not normalized; maximum sum error is {max_sum_error:.6f}")
 return {"unweighted":0,"maxInfluences":max_influences,"maxWeightSumError":max_sum_error}

def _validate_body_uv(body):
 mesh=body.data; layers=list(mesh.uv_layers)
 if not layers or mesh.uv_layers.active is None: raise RuntimeError("BODY must have an active UV map before Hero certification")
 active=mesh.uv_layers.active; out=[]
 if len(active.data)!=len(mesh.loops): raise RuntimeError("BODY active UV map does not cover every mesh loop")
 for i,x in enumerate(active.data):
  u=float(x.uv.x); v=float(x.uv.y)
  if not math.isfinite(u) or not math.isfinite(v): raise RuntimeError(f"BODY UV map contains non-finite coordinates at loop {i}")
  if u < -UV_TOLERANCE or u > 1+UV_TOLERANCE or v < -UV_TOLERANCE or v > 1+UV_TOLERANCE: out.append(i)
 if out: raise RuntimeError(f"BODY active UV map has {len(out)} loops outside the mobile 0-1 UV tile")
 return {"layers":len(layers),"outOfBoundsLoops":0}

def _validate_dna_morphs(body):
 keys=body.data.shape_keys
 if keys is None or not keys.key_blocks: raise RuntimeError("BODY must contain Basis plus canonical Avatar DNA shape keys")
 basis=keys.key_blocks.get("Basis")
 if basis is None or len(basis.data)!=len(body.data.vertices): raise RuntimeError("BODY DNA Basis must preserve canonical vertex topology")
 actual=[k.name for k in keys.key_blocks if k.name!="Basis"]
 missing=[name for name in DNA_MORPHS if name not in actual]; unexpected=[name for name in actual if name not in DNA_MORPHS]
 if missing or unexpected: raise RuntimeError(f"BODY DNA morph set must be exact; missing={missing}, unexpected={unexpected}")
 max_delta=0.0
 for name in DNA_MORPHS:
  key=keys.key_blocks[name]
  if len(key.data)!=len(basis.data): raise RuntimeError(f"DNA morph {name} changes BODY vertex count/order")
  if abs(float(key.value))>EPSILON: raise RuntimeError(f"DNA morph {name} must be neutral (value=0) during certification/export")
  local_max=0.0
  for i,point in enumerate(key.data):
   delta=(point.co-basis.data[i].co).length
   if not math.isfinite(delta): raise RuntimeError(f"DNA morph {name} contains non-finite vertex data")
   local_max=max(local_max,delta)
  if local_max<=EPSILON: raise RuntimeError(f"DNA morph {name} is empty")
  if local_max>MAX_DNA_VERTEX_DELTA_M: raise RuntimeError(f"DNA morph {name} exceeds safe deformation delta ({local_max:.4f}m)")
  max_delta=max(max_delta,local_max)
 return {"names":list(DNA_MORPHS),"count":len(DNA_MORPHS),"maxVertexDeltaMeters":max_delta}

def _upstream_images(socket,visited=None):
 if socket is None or not socket.is_linked:return []
 visited=set() if visited is None else visited; found=[]
 for link in socket.links:
  node=link.from_node
  if node.as_pointer() in visited:continue
  visited.add(node.as_pointer())
  if node.type=='TEX_IMAGE' and node.image is not None:found.append(node.image);continue
  for input_socket in node.inputs:found.extend(_upstream_images(input_socket,visited))
 return found

def _is_srgb(image): return getattr(image.colorspace_settings,'name','').lower() in {'srgb','s-rgb'}
def _is_non_color(image): return getattr(image.colorspace_settings,'name','').lower() in {'non-color','non-colour','raw'}

def _validate_pbr_materials(objects):
 material_count=0; images={}; body_base=False; body_normal=False; body_orm=False; color_spaces=True
 for role,obj in objects.items():
  slots=[s.material for s in obj.material_slots if s.material is not None]
  if not slots:raise RuntimeError(f"{role} must have a runtime PBR material")
  if len(slots)>MAX_MATERIALS_PER_OBJECT:raise RuntimeError(f"{role} exceeds mobile material-slot budget")
  material_count+=len(slots)
  for material in slots:
   if not material.use_nodes or material.node_tree is None:raise RuntimeError(f"{role}/{material.name} must use node-based PBR")
   principled=[n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED']; outputs=[n for n in material.node_tree.nodes if n.type=='OUTPUT_MATERIAL' and n.is_active_output]
   if len(principled)!=1 or len(outputs)!=1:raise RuntimeError(f"{role}/{material.name} must have exactly one Principled BSDF and one active Material Output")
   p=principled[0]; surface=outputs[0].inputs.get('Surface')
   if surface is None or not surface.is_linked or surface.links[0].from_node!=p:raise RuntimeError(f"{role}/{material.name} Principled BSDF must directly drive Material Output Surface")
   base_images=_upstream_images(p.inputs.get('Base Color')); normal_images=_upstream_images(p.inputs.get('Normal')); rough_images=_upstream_images(p.inputs.get('Roughness')); metallic_images=_upstream_images(p.inputs.get('Metallic'))
   if role=='BODY':
    body_base=bool(base_images); body_normal=bool(normal_images); body_orm=bool({i.as_pointer() for i in rough_images}&{i.as_pointer() for i in metallic_images})
    if not body_base or not all(_is_srgb(i) for i in base_images):color_spaces=False
    if not body_normal or not all(_is_non_color(i) for i in normal_images):color_spaces=False
    if not body_orm or not all(_is_non_color(i) for i in rough_images+metallic_images):color_spaces=False
   for node in material.node_tree.nodes:
    if node.type!='TEX_IMAGE' or node.image is None:continue
    image=node.image; w,h=int(image.size[0]),int(image.size[1])
    if w<=0 or h<=0:raise RuntimeError(f"{image.name} has invalid texture dimensions")
    if w>MAX_TEXTURE_DIMENSION or h>MAX_TEXTURE_DIMENSION:raise RuntimeError(f"{image.name} exceeds Android texture dimension budget")
    images[image.as_pointer()]=(w,h)
 if not body_base or not body_normal or not body_orm or not color_spaces:raise RuntimeError("BODY requires valid Base Color, Normal and packed ORM PBR maps")
 total_pixels=sum(w*h for w,h in images.values())
 if total_pixels>MAX_TOTAL_TEXTURE_PIXELS:raise RuntimeError("Hero textures exceed Android pixel budget")
 return {"materialSlots":material_count,"maxPerObject":max(len([s for s in o.material_slots if s.material]) for o in objects.values()),"textureCount":len(images),"maxTextureDimension":max(max(x) for x in images.values()) if images else 0,"totalTexturePixels":total_pixels,"bodyBaseColorTexture":body_base,"bodyNormalTexture":body_normal,"bodyOrmTexture":body_orm,"textureColorSpaces":color_spaces}

def _pose_bone(armature,*names):
 for name in names:
  bone=armature.pose.bones.get(name)
  if bone is not None:return bone
 raise RuntimeError("Missing canonical Hero pose bone; expected one of: "+", ".join(names))

def _arm_angle_from_horizontal(armature,side):
 bone=_pose_bone(armature,f"upper_arm.{side}",f"upper_arm_{side}",f"UpperArm_{side.upper()}"); head=armature.matrix_world@bone.head; tail=armature.matrix_world@bone.tail
 dx=tail.x-head.x; dz=tail.z-head.z; expected=-1.0 if side=="l" else 1.0
 if dx*expected<=EPSILON or dz>=-EPSILON:raise RuntimeError(f"Hero {side} upper arm violates canonical A-pose")
 return 90.0 if abs(dx)<EPSILON else math.degrees(math.atan2(-dz,abs(dx)))

def _validate_a_pose(scene,depsgraph):
 evaluated=_find_armature(scene).evaluated_get(depsgraph); left=_arm_angle_from_horizontal(evaluated,"l"); right=_arm_angle_from_horizontal(evaluated,"r")
 if not(A_POSE_MIN_ARM_ANGLE_DEG<=left<=A_POSE_MAX_ARM_ANGLE_DEG and A_POSE_MIN_ARM_ANGLE_DEG<=right<=A_POSE_MAX_ARM_ANGLE_DEG) or abs(left-right)>A_POSE_SIDE_SYMMETRY_DEG:raise RuntimeError("Hero upper arms are outside canonical A-pose")
 return left,right

def export_report(output_path=None):
 scene=bpy.context.scene
 if scene.unit_settings.system!="METRIC" or abs(scene.unit_settings.scale_length-1)>EPSILON:raise RuntimeError("Scene must use metric units with scale_length=1")
 _validate_scene_objects(scene); objects={o.name:o for o in scene.objects if o.name in ALLOWED}; missing=[n for n in REQUIRED if n not in objects]
 if missing:raise RuntimeError("Missing required Hero objects: "+", ".join(missing))
 body=objects["BODY"]; armature=_find_armature(scene); skinning=_validate_body_skinning(body,armature); uv=_validate_body_uv(body); dna=_validate_dna_morphs(body); pbr=_validate_pbr_materials(objects); depsgraph=bpy.context.evaluated_depsgraph_get(); left,right=_validate_a_pose(scene,depsgraph)
 x0,x1,z0,z1=_evaluated_world_bounds(body,depsgraph); center=(x0+x1)/2
 if abs(center)>SPATIAL_TOLERANCE_M:raise RuntimeError("BODY must be centered on world X=0")
 if abs(z0)>SPATIAL_TOLERANCE_M:raise RuntimeError("BODY feet must contact Blender Z=0")
 metrics=[_mesh_metrics(objects[n],depsgraph) for n in REQUIRED+OPTIONAL if n in objects]
 report={"reportVersion":REPORT_VERSION,"assetKey":ASSET_KEY,"unitSystem":"METERS","authoringUpAxis":"Z","runtimeUpAxis":"Y","pose":"A_POSE","poseVerified":True,"measuredLeftUpperArmAngleDeg":round(left,4),"measuredRightUpperArmAngleDeg":round(right,4),"centeredWorldOrigin":True,"measuredBodyCenterX":round(center,6),"groundContactY":0,"measuredGroundContactMeters":round(z0,6),"groundContactVerified":True,"bodyHeightMeters":round(z1-z0,6),"skeletonTarget":SKELETON,"stableVertexOrder":bool(body.get("knowme_stable_vertex_order",False)),"deformationTopologyReady":bool(body.get("knowme_deformation_topology_ready",False)),"skinningVerified":True,"measuredUnweightedBodyVertices":skinning["unweighted"],"measuredMaxBodyBoneInfluences":skinning["maxInfluences"],"measuredMaxBodyWeightSumError":round(skinning["maxWeightSumError"],6),"uvVerified":True,"measuredBodyUvLayers":uv["layers"],"measuredBodyUvOutOfBoundsLoops":uv["outOfBoundsLoops"],"pbrMaterialsVerified":True,"measuredMaterialSlots":pbr["materialSlots"],"measuredMaxMaterialsPerObject":pbr["maxPerObject"],"texturesVerified":True,"bodyBaseColorTextureVerified":pbr["bodyBaseColorTexture"],"bodyNormalTextureVerified":pbr["bodyNormalTexture"],"bodyOrmTextureVerified":pbr["bodyOrmTexture"],"textureColorSpacesVerified":pbr["textureColorSpaces"],"measuredTextureCount":pbr["textureCount"],"measuredMaxTextureDimension":pbr["maxTextureDimension"],"measuredTotalTexturePixels":pbr["totalTexturePixels"],"dnaMorphsVerified":True,"dnaMorphNames":dna["names"],"measuredDnaMorphCount":dna["count"],"measuredMaxDnaVertexDeltaMeters":round(dna["maxVertexDeltaMeters"],6),"objects":metrics}
 path=Path(output_path or bpy.path.abspath("//hero-blockout-report.json")); path.write_text(json.dumps(report,indent=2,sort_keys=True)+"\n",encoding="utf-8"); print(f"KnowMe Hero report written: {path}"); return report

if __name__=="__main__":export_report()
