"""KnowMe Hero Avatar blockout measurement exporter.

Run inside Blender after opening the real Hero .blend. This script does not create
or fake geometry: it inspects named mesh objects, validates production conventions,
and writes the JSON report consumed by the server-side provenance gate.

Authoring convention: Blender is Z-up. The runtime contract is Y-up after glTF/GLB
export. Measurements in this report are therefore taken in Blender world Z and
explicitly report both authoring and runtime axes.
"""
from __future__ import annotations

import json
from pathlib import Path

import bpy

REPORT_VERSION = 1
ASSET_KEY = "knowme.hero.blockout.v1"
SKELETON = "knowme.humanoid.v1"
REQUIRED = ("BODY", "EYE_L", "EYE_R")
OPTIONAL = ("TEETH", "TONGUE", "HAIR_PLACEHOLDER")
ALLOWED = set(REQUIRED + OPTIONAL)
EPSILON = 1e-5
GROUND_TOLERANCE_M = 0.002


def _mesh_metrics(obj):
    if obj.type != "MESH":
        raise RuntimeError(f"{obj.name} must be a mesh")
    mesh = obj.data
    mesh.calc_loop_triangles()
    manifold = _is_manifold(mesh)
    transform_ok = (
        all(abs(v) < EPSILON for v in obj.location)
        and all(abs(v) < EPSILON for v in obj.rotation_euler)
        and all(abs(v - 1.0) < EPSILON for v in obj.scale)
    )
    return {
        "role": obj.name,
        "vertices": len(mesh.vertices),
        "triangles": len(mesh.loop_triangles),
        "manifold": manifold,
        "unappliedTransforms": not transform_ok,
        "fusedClothingOrAccessories": bool(obj.get("knowme_fused_cosmetic", False)),
    }


def _is_manifold(mesh):
    import bmesh

    bm = bmesh.new()
    try:
        bm.from_mesh(mesh)
        return all(e.is_manifold for e in bm.edges)
    finally:
        bm.free()


def _world_z_bounds(obj):
    from mathutils import Vector

    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return min(p.z for p in points), max(p.z for p in points)


def _body_height_m(body):
    z_min, z_max = _world_z_bounds(body)
    return z_max - z_min


def _validate_scene_objects(scene):
    # A named cosmetic or unknown mesh must not silently disappear from the report.
    unexpected = sorted(
        obj.name
        for obj in scene.objects
        if obj.type == "MESH" and obj.name not in ALLOWED
    )
    if unexpected:
        raise RuntimeError(
            "Unexpected mesh objects in Hero blockout scene: " + ", ".join(unexpected)
        )


def export_report(output_path=None):
    scene = bpy.context.scene
    if scene.unit_settings.system != "METRIC" or abs(scene.unit_settings.scale_length - 1.0) > EPSILON:
        raise RuntimeError("Scene must use metric units with scale_length=1")

    _validate_scene_objects(scene)
    objects = {o.name: o for o in scene.objects if o.name in ALLOWED}
    missing = [name for name in REQUIRED if name not in objects]
    if missing:
        raise RuntimeError("Missing required Hero objects: " + ", ".join(missing))

    body = objects["BODY"]
    z_min, _ = _world_z_bounds(body)
    ground_contact = abs(z_min) <= GROUND_TOLERANCE_M
    centered = bool(scene.get("knowme_centered_world_origin", False))
    if not centered:
        raise RuntimeError("Hero scene must be reviewed and marked centered at world origin")
    if not ground_contact:
        raise RuntimeError(
            f"BODY feet must contact Blender Z=0 within {GROUND_TOLERANCE_M}m; measured {z_min:.6f}m"
        )

    metrics = [_mesh_metrics(objects[name]) for name in REQUIRED + OPTIONAL if name in objects]
    report = {
        "reportVersion": REPORT_VERSION,
        "assetKey": ASSET_KEY,
        "unitSystem": "METERS",
        "authoringUpAxis": "Z",
        "runtimeUpAxis": "Y",
        "pose": "A_POSE",
        "centeredWorldOrigin": centered,
        # Kept for server contract compatibility: runtime Y=0 corresponds to Blender Z=0.
        "groundContactY": 0,
        "groundContactVerified": ground_contact,
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
