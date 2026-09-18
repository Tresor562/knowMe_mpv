"""KnowMe Hero Avatar blockout measurement exporter.

Run inside Blender after opening the real Hero .blend. It inspects real geometry and
writes the v2 JSON report consumed by the server-side production gate. Blender is
Z-up; KnowMe runtime is Y-up after glTF/GLB export.
"""
from __future__ import annotations
import json
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

def _mesh_metrics(obj):
    if obj.type!="MESH": raise RuntimeError(f"{obj.name} must be a mesh")
    mesh=obj.data; mesh.calc_loop_triangles()
    transform_ok=all(abs(v)<EPSILON for v in obj.location) and all(abs(v)<EPSILON for v in obj.rotation_euler) and all(abs(v-1.0)<EPSILON for v in obj.scale)
    return {"role":obj.name,"vertices":len(mesh.vertices),"triangles":len(mesh.loop_triangles),"manifold":_is_manifold(mesh),"unappliedTransforms":not transform_ok,"fusedClothingOrAccessories":bool(obj.get("knowme_fused_cosmetic",False))}

def _is_manifold(mesh):
    import bmesh
    bm=bmesh.new()
    try: bm.from_mesh(mesh); return all(e.is_manifold for e in bm.edges)
    finally: bm.free()

def _world_bounds(obj):
    from mathutils import Vector
    p=[obj.matrix_world@Vector(c) for c in obj.bound_box]
    return (min(v.x for v in p),max(v.x for v in p),min(v.z for v in p),max(v.z for v in p))

def _validate_scene_objects(scene):
    unexpected=sorted(o.name for o in scene.objects if o.type=="MESH" and o.name not in ALLOWED)
    if unexpected: raise RuntimeError("Unexpected mesh objects in Hero blockout scene: "+", ".join(unexpected))

def export_report(output_path=None):
    scene=bpy.context.scene
    if scene.unit_settings.system!="METRIC" or abs(scene.unit_settings.scale_length-1.0)>EPSILON: raise RuntimeError("Scene must use metric units with scale_length=1")
    _validate_scene_objects(scene)
    objects={o.name:o for o in scene.objects if o.name in ALLOWED}
    missing=[n for n in REQUIRED if n not in objects]
    if missing: raise RuntimeError("Missing required Hero objects: "+", ".join(missing))
    body=objects["BODY"]
    x_min,x_max,z_min,z_max=_world_bounds(body)
    center_x=(x_min+x_max)/2.0
    if abs(center_x)>SPATIAL_TOLERANCE_M: raise RuntimeError(f"BODY must be centered on world X=0 within {SPATIAL_TOLERANCE_M}m; measured center {center_x:.6f}m")
    if abs(z_min)>SPATIAL_TOLERANCE_M: raise RuntimeError(f"BODY feet must contact Blender Z=0 within {SPATIAL_TOLERANCE_M}m; measured {z_min:.6f}m")
    metrics=[_mesh_metrics(objects[n]) for n in REQUIRED+OPTIONAL if n in objects]
    report={"reportVersion":REPORT_VERSION,"assetKey":ASSET_KEY,"unitSystem":"METERS","authoringUpAxis":"Z","runtimeUpAxis":"Y","pose":"A_POSE","centeredWorldOrigin":True,"measuredBodyCenterX":round(center_x,6),"groundContactY":0,"measuredGroundContactMeters":round(z_min,6),"groundContactVerified":True,"bodyHeightMeters":round(z_max-z_min,6),"skeletonTarget":SKELETON,"stableVertexOrder":bool(body.get("knowme_stable_vertex_order",False)),"deformationTopologyReady":bool(body.get("knowme_deformation_topology_ready",False)),"objects":metrics}
    path=Path(output_path or bpy.path.abspath("//hero-blockout-report.json")); path.write_text(json.dumps(report,indent=2,sort_keys=True)+"\n",encoding="utf-8")
    print(f"KnowMe Hero report written: {path}"); return report

if __name__=="__main__": export_report()
