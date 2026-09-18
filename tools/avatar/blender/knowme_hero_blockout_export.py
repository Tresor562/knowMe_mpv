"""KnowMe Hero Avatar blockout measurement exporter.

Run inside Blender after opening the real Hero .blend. This script does not create
or fake geometry: it inspects named mesh objects, validates production conventions,
and writes the JSON report consumed by the server-side provenance gate.
"""
from __future__ import annotations
import bpy, json, math
from pathlib import Path

REPORT_VERSION = 1
ASSET_KEY = "knowme.hero.blockout.v1"
SKELETON = "knowme.humanoid.v1"
REQUIRED = ("BODY", "EYE_L", "EYE_R")
OPTIONAL = ("TEETH", "TONGUE", "HAIR_PLACEHOLDER")
ALLOWED = set(REQUIRED + OPTIONAL)


def _mesh_metrics(obj):
    if obj.type != "MESH":
        raise RuntimeError(f"{obj.name} must be a mesh")
    mesh = obj.data
    loop_triangles = mesh.loop_triangles
    mesh.calc_loop_triangles()
    # Boundary/non-manifold edges are forbidden for the production blockout gate.
    manifold = all(len(e.link_faces) == 2 for e in _bmesh_edges(mesh))
    transform_ok = all(abs(v) < 1e-6 for v in obj.location) and all(abs(v) < 1e-6 for v in obj.rotation_euler) and all(abs(v - 1.0) < 1e-6 for v in obj.scale)
    return {
        "role": obj.name,
        "vertices": len(mesh.vertices),
        "triangles": len(loop_triangles),
        "manifold": manifold,
        "unappliedTransforms": not transform_ok,
        "fusedClothingOrAccessories": bool(obj.get("knowme_fused_cosmetic", False)),
    }


def _bmesh_edges(mesh):
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(mesh)
    edges = list(bm.edges)
    # Keep bmesh alive while callers inspect link_faces; cleanup happens after copy.
    class EdgeProxy:
        def __init__(self, count): self.link_faces = range(count)
    result = [EdgeProxy(len(e.link_faces)) for e in edges]
    bm.free()
    return result


def _body_height_m(body):
    corners = [body.matrix_world @ mathutils.Vector(c) for c in body.bound_box]
    return max(v.z for v in corners) - min(v.z for v in corners)


def export_report(output_path=None):
    global mathutils
    import mathutils
    scene = bpy.context.scene
    if scene.unit_settings.system != "METRIC" or abs(scene.unit_settings.scale_length - 1.0) > 1e-6:
        raise RuntimeError("Scene must use metric units with scale_length=1")
    objects = {o.name: o for o in scene.objects if o.name in ALLOWED}
    missing = [name for name in REQUIRED if name not in objects]
    if missing:
        raise RuntimeError("Missing required Hero objects: " + ", ".join(missing))
    body = objects["BODY"]
    metrics = [_mesh_metrics(objects[name]) for name in REQUIRED + OPTIONAL if name in objects]
    report = {
        "reportVersion": REPORT_VERSION,
        "assetKey": ASSET_KEY,
        "unitSystem": "METERS",
        "runtimeUpAxis": "Y",
        "pose": "A_POSE",
        "centeredWorldOrigin": bool(scene.get("knowme_centered_world_origin", False)),
        "groundContactY": 0,
        "bodyHeightMeters": round(_body_height_m(body), 6),
        "skeletonTarget": SKELETON,
        "stableVertexOrder": bool(body.get("knowme_stable_vertex_order", False)),
        "deformationTopologyReady": bool(body.get("knowme_deformation_topology_ready", False)),
        "objects": metrics,
    }
    path = Path(output_path or bpy.path.abspath("//hero-blockout-report.json"))
    path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"KnowMe Hero report written: {path}")
    return report


if __name__ == "__main__":
    export_report()
