"""Measured QA for dangerous Avatar DNA + facial-expression combinations.

This is a production gate, not an asset generator. It evaluates canonical stress
poses through Blender's dependency graph, rejects non-finite/collapsed geometry,
and uses BVH triangle overlap to detect self-intersections while ignoring triangle
pairs that merely share a vertex.
"""
from __future__ import annotations

import math
from mathutils.bvhtree import BVHTree
import bpy

EPSILON = 1e-6
MAX_COMBINED_VERTEX_DELTA_M = 0.42

# Deterministic stress matrix. Values are runtime-legal shape-key weights.
COMBINATION_CASES = (
    ("body_tall_broad", {"dna_body_height": 1.0, "dna_shoulder_width": 1.0, "dna_torso_mass": 1.0}),
    ("body_compact_hips", {"dna_hip_width": 1.0, "dna_torso_mass": 1.0}),
    ("face_wide_smile", {"dna_face_width": 1.0, "dna_jaw_width": 1.0, "expr_smile_l": 1.0, "expr_smile_r": 1.0}),
    ("face_nose_pucker", {"dna_nose_size": 1.0, "expr_mouth_pucker": 1.0}),
    ("face_eye_blink_brow", {"dna_eye_size": 1.0, "expr_blink_l": 1.0, "expr_blink_r": 1.0, "expr_brow_up_l": 1.0, "expr_brow_up_r": 1.0}),
    ("jaw_frown", {"dna_jaw_width": 1.0, "expr_jaw_open": 1.0, "expr_frown_l": 1.0, "expr_frown_r": 1.0}),
)


def _evaluated_mesh(body):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = body.evaluated_get(depsgraph)
    return evaluated, evaluated.to_mesh()


def _non_adjacent_overlaps(mesh):
    verts = [v.co.copy() for v in mesh.vertices]
    polygons = [tuple(p.vertices) for p in mesh.polygons]
    bvh = BVHTree.FromPolygons(verts, polygons, all_triangles=False, epsilon=0.0)
    if bvh is None:
        return 0
    count = 0
    for left, right in bvh.overlap(bvh):
        if left >= right:
            continue
        if set(polygons[left]).intersection(polygons[right]):
            continue
        count += 1
    return count


def validate_combined_deformations(body):
    keys = body.data.shape_keys
    if keys is None:
        raise RuntimeError("BODY shape keys are required for combined deformation QA")
    key_blocks = keys.key_blocks
    required = {name for _, weights in COMBINATION_CASES for name in weights}
    missing = sorted(name for name in required if key_blocks.get(name) is None)
    if missing:
        raise RuntimeError(f"Combined deformation QA is missing shape keys: {missing}")

    original = {key.name: float(key.value) for key in key_blocks}
    evaluated = neutral = None
    max_delta = 0.0
    max_intersections = 0
    try:
        for key in key_blocks:
            if key.name != "Basis":
                key.value = 0.0
        bpy.context.view_layer.update()
        evaluated, neutral = _evaluated_mesh(body)
        neutral_positions = [v.co.copy() for v in neutral.vertices]
        neutral_count = len(neutral_positions)
        evaluated.to_mesh_clear(); evaluated = neutral = None

        for case_name, weights in COMBINATION_CASES:
            for key in key_blocks:
                if key.name != "Basis":
                    key.value = float(weights.get(key.name, 0.0))
            bpy.context.view_layer.update()
            evaluated, mesh = _evaluated_mesh(body)
            if len(mesh.vertices) != neutral_count:
                raise RuntimeError(f"{case_name} changes evaluated BODY topology")
            local_max = 0.0
            for index, vertex in enumerate(mesh.vertices):
                co = vertex.co
                if not all(math.isfinite(component) for component in co):
                    raise RuntimeError(f"{case_name} contains non-finite evaluated vertices")
                local_max = max(local_max, (co - neutral_positions[index]).length)
            if local_max > MAX_COMBINED_VERTEX_DELTA_M:
                raise RuntimeError(f"{case_name} exceeds combined deformation budget ({local_max:.4f}m)")
            intersections = _non_adjacent_overlaps(mesh)
            if intersections:
                raise RuntimeError(f"{case_name} has {intersections} non-adjacent BODY self-intersections")
            max_delta = max(max_delta, local_max)
            max_intersections = max(max_intersections, intersections)
            evaluated.to_mesh_clear(); evaluated = None
    finally:
        if evaluated is not None:
            evaluated.to_mesh_clear()
        for name, value in original.items():
            key_blocks[name].value = value
        bpy.context.view_layer.update()

    return {
        "caseNames": [name for name, _ in COMBINATION_CASES],
        "caseCount": len(COMBINATION_CASES),
        "maxVertexDeltaMeters": max_delta,
        "maxSelfIntersectionCount": max_intersections,
    }
