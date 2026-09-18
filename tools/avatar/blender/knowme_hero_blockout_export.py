"""KnowMe Hero Avatar blockout measurement exporter.

Run inside Blender after opening the real Hero .blend. It inspects evaluated geometry
(the geometry that will actually be exported after modifiers) and writes the v2 JSON
report consumed by the server-side production gate. Blender is Z-up; KnowMe runtime
is Y-up after glTF/GLB export.
"""
from __future__ import annotations
import json, math
from pathlib import Path
import bpy

REPORT_VERSION=2
ASSET_KEY="knowme.hero.blockout.v1"
SKELETON="knowme.humanoid.v1"
REQUIRED=("BODY","EYE_L","EYE_R")
OPTIONAL=("TEETH","TONGUE","HAIR_PLACEHOLDER")
ALLOWED=set(REQUIRED+OPTIONAL)
EPSILON=1e-5
SPATIAL_TOLERANCE_M=0.002
# A-pose is intentionally broad enough for different proportions while rejecting T-pose/down-arm impostors.
A_POSE_MIN_ARM_ANGLE_DEG=25.0
A_POSE_MAX_ARM_ANGLE_DEG=60.0
A_POSE_SIDE_SYMMETRY_DEG=8.0

def _is_manifold(mesh):
    import bmesh
    bm=bmesh.new()
    try:
        bm.from_mesh(mesh)
        return all(e.is_manifold for e in bm.edges)
    finally:
        bm.free()

def _evaluated_mesh(obj, depsgraph):
    evaluated=obj.evaluated_get(depsgraph)
    mesh=evaluated.to_mesh(preserve_all_data_layers=True,depsgraph=depsgraph)
    if mesh is None: raise RuntimeError(f"Unable to evaluate mesh for {obj.name}")
    return evaluated,mesh

def _mesh_metrics(obj,depsgraph):
    if obj.type!="MESH": raise RuntimeError(f"{obj.name} must be a mesh")
    evaluated,mesh=_evaluated_mesh(obj,depsgraph)
    try:
        mesh.calc_loop_triangles()
        transform_ok=all(abs(v)<EPSILON for v in obj.location) and all(abs(v)<EPSILON for v in obj.rotation_euler) and all(abs(v-1.0)<EPSILON for v in obj.scale)
        return {"role":obj.name,"vertices":len(mesh.vertices),"triangles":len(mesh.loop_triangles),"manifold":_is_manifold(mesh),"unappliedTransforms":not transform_ok,"fusedClothingOrAccessories":bool(obj.get("knowme_fused_cosmetic",False))}
    finally:
        evaluated.to_mesh_clear()

def _evaluated_world_bounds(obj,depsgraph):
    evaluated,mesh=_evaluated_mesh(obj,depsgraph)
    try:
        if not mesh.vertices: raise RuntimeError(f"{obj.name} has no evaluated vertices")
        points=[evaluated.matrix_world@v.co for v in mesh.vertices]
        return (min(v.x for v in points),max(v.x for v in points),min(v.z for v in points),max(v.z for v in points))
    finally:
        evaluated.to_mesh_clear()

def _validate_scene_objects(scene):
    unexpected=sorted(o.name for o in scene.objects if o.type=="MESH" and o.name not in ALLOWED)
    if unexpected: raise RuntimeError("Unexpected mesh objects in Hero blockout scene: "+", ".join(unexpected))

def _find_armature(scene):
    armatures=[o for o in scene.objects if o.type=="ARMATURE"]
    if len(armatures)!=1: raise RuntimeError(f"Hero blockout must contain exactly one armature; found {len(armatures)}")
    return armatures[0]

def _pose_bone(armature,*names):
    for name in names:
        bone=armature.pose.bones.get(name)
        if bone is not None: return bone
    raise RuntimeError("Missing canonical Hero pose bone; expected one of: "+", ".join(names))

def _arm_angle_from_horizontal(evaluated_armature,side):
    # PoseBone.head/tail are evaluated in armature-object space. Using pose bones here is
    # essential: Armature.data.bones.*_local describes the rest pose and would let a
    # T-pose animation be certified when the rest rig happened to be authored in A-pose.
    bone=_pose_bone(evaluated_armature, f"upper_arm.{side}", f"upper_arm_{side}", f"UpperArm_{side.upper()}")
    head=evaluated_armature.matrix_world@bone.head
    tail=evaluated_armature.matrix_world@bone.tail
    dx=tail.x-head.x; dz=tail.z-head.z
    # An A-pose upper arm must travel away from the torso and downward from the shoulder.
    # abs(dx/dz) alone is insufficient: it would certify a V-up pose or an arm crossing
    # inward over the chest at the same numerical angle.
    if abs(tail.x)<=abs(head.x)+EPSILON:
        raise RuntimeError(f"Hero {side} upper arm points inward instead of away from the torso")
    if dz>=-EPSILON:
        raise RuntimeError(f"Hero {side} upper arm must slope downward from shoulder to elbow")
    if abs(dx)<EPSILON: return 90.0
    return math.degrees(math.atan2(-dz,abs(dx)))

def _validate_a_pose(scene,depsgraph):
    armature=_find_armature(scene)
    evaluated_armature=armature.evaluated_get(depsgraph)
    left=_arm_angle_from_horizontal(evaluated_armature,"l"); right=_arm_angle_from_horizontal(evaluated_armature,"r")
    for side,angle in (("left",left),("right",right)):
        if angle<A_POSE_MIN_ARM_ANGLE_DEG or angle>A_POSE_MAX_ARM_ANGLE_DEG:
            raise RuntimeError(f"Hero {side} upper arm is not in A-pose: {angle:.2f}deg from horizontal; expected {A_POSE_MIN_ARM_ANGLE_DEG}-{A_POSE_MAX_ARM_ANGLE_DEG}deg")
    if abs(left-right)>A_POSE_SIDE_SYMMETRY_DEG: raise RuntimeError(f"Hero A-pose arms are asymmetric by {abs(left-right):.2f}deg")
    return left,right

def export_report(output_path=None):
    scene=bpy.context.scene
    if scene.unit_settings.system!="METRIC" or abs(scene.unit_settings.scale_length-1.0)>EPSILON: raise RuntimeError("Scene must use metric units with scale_length=1")
    _validate_scene_objects(scene)
    objects={o.name:o for o in scene.objects if o.name in ALLOWED}
    missing=[n for n in REQUIRED if n not in objects]
    if missing: raise RuntimeError("Missing required Hero objects: "+", ".join(missing))
    depsgraph=bpy.context.evaluated_depsgraph_get()
    _validate_a_pose(scene,depsgraph)
    body=objects["BODY"]
    x_min,x_max,z_min,z_max=_evaluated_world_bounds(body,depsgraph)
    center_x=(x_min+x_max)/2.0
    if abs(center_x)>SPATIAL_TOLERANCE_M: raise RuntimeError(f"BODY must be centered on world X=0 within {SPATIAL_TOLERANCE_M}m; measured center {center_x:.6f}m")
    if abs(z_min)>SPATIAL_TOLERANCE_M: raise RuntimeError(f"BODY feet must contact Blender Z=0 within {SPATIAL_TOLERANCE_M}m; measured {z_min:.6f}m")
    metrics=[_mesh_metrics(objects[n],depsgraph) for n in REQUIRED+OPTIONAL if n in objects]
    report={"reportVersion":REPORT_VERSION,"assetKey":ASSET_KEY,"unitSystem":"METERS","authoringUpAxis":"Z","runtimeUpAxis":"Y","pose":"A_POSE","centeredWorldOrigin":True,"measuredBodyCenterX":round(center_x,6),"groundContactY":0,"measuredGroundContactMeters":round(z_min,6),"groundContactVerified":True,"bodyHeightMeters":round(z_max-z_min,6),"skeletonTarget":SKELETON,"stableVertexOrder":bool(body.get("knowme_stable_vertex_order",False)),"deformationTopologyReady":bool(body.get("knowme_deformation_topology_ready",False)),"objects":metrics}
    path=Path(output_path or bpy.path.abspath("//hero-blockout-report.json")); path.write_text(json.dumps(report,indent=2,sort_keys=True)+"\n",encoding="utf-8")
    print(f"KnowMe Hero report written: {path}"); return report

if __name__=="__main__": export_report()
