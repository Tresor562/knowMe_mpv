"""Measured LOD certification for the KnowMe Hero.

Expected Blender objects: BODY_LOD0, BODY_LOD1, BODY_LOD2. This gate measures
real mesh geometry and rejects placeholder/non-reducing LOD chains. It also
requires the canonical armature on every LOD and preserves the complete Hero
shape-key contract so runtime DNA/expression switching does not silently break.
"""
from __future__ import annotations
import math
import bpy

LOD_NAMES = ("BODY_LOD0", "BODY_LOD1", "BODY_LOD2")
MAX_TRIANGLES = (60000, 30000, 12000)
MIN_REDUCTION_RATIO = (0.0, 0.25, 0.50)  # vs previous LOD
MAX_BONES_PER_VERTEX = 4


def _mesh_metrics(obj):
    mesh = obj.data
    mesh.calc_loop_triangles()
    vertices = len(mesh.vertices)
    triangles = len(mesh.loop_triangles)
    if vertices <= 0 or triangles <= 0:
        raise RuntimeError(f"{obj.name} is empty")
    if triangles > MAX_TRIANGLES[LOD_NAMES.index(obj.name)]:
        raise RuntimeError(f"{obj.name} exceeds mobile triangle budget")
    return vertices, triangles


def _armature(obj):
    modifiers = [m for m in obj.modifiers if m.type == "ARMATURE" and m.object]
    if len(modifiers) != 1:
        raise RuntimeError(f"{obj.name} must have exactly one Armature modifier")
    return modifiers[0].object


def _max_influences(obj):
    maximum = 0
    for vertex in obj.data.vertices:
        active = sum(1 for group in vertex.groups if group.weight > 1e-6)
        maximum = max(maximum, active)
        if active > MAX_BONES_PER_VERTEX:
            raise RuntimeError(f"{obj.name} vertex {vertex.index} has {active} bone influences")
    return maximum


def _shape_keys(obj):
    keys = obj.data.shape_keys
    if keys is None or not keys.key_blocks:
        raise RuntimeError(f"{obj.name} has no shape keys")
    names = tuple(block.name for block in keys.key_blocks)
    if names[0] != "Basis":
        raise RuntimeError(f"{obj.name} first shape key must be Basis")
    for block in keys.key_blocks:
        if len(block.data) != len(obj.data.vertices):
            raise RuntimeError(f"{obj.name}:{block.name} shape-key topology mismatch")
        if not math.isfinite(float(block.value)) or abs(float(block.value)) > 1e-7:
            raise RuntimeError(f"{obj.name}:{block.name} must be neutral at certification")
    return names


def validate_hero_lods():
    objects = []
    for name in LOD_NAMES:
        obj = bpy.context.scene.objects.get(name)
        if obj is None or obj.type != "MESH":
            raise RuntimeError(f"{name} mesh is required")
        objects.append(obj)

    armatures = [_armature(obj) for obj in objects]
    if len({arm.name for arm in armatures}) != 1:
        raise RuntimeError("Hero LODs must share one canonical armature")

    shape_contract = _shape_keys(objects[0])
    metrics = []
    for index, obj in enumerate(objects):
        names = _shape_keys(obj)
        if names != shape_contract:
            raise RuntimeError(f"{obj.name} shape-key contract differs from LOD0")
        vertices, triangles = _mesh_metrics(obj)
        influences = _max_influences(obj)
        metrics.append({"level": index, "objectName": obj.name, "vertices": vertices,
                        "triangles": triangles, "maxBonesPerVertex": influences})

    for index in (1, 2):
        previous = metrics[index - 1]["triangles"]
        current = metrics[index]["triangles"]
        if current >= previous:
            raise RuntimeError("Hero LOD triangle counts must strictly decrease")
        reduction = 1.0 - current / previous
        if reduction < MIN_REDUCTION_RATIO[index]:
            raise RuntimeError(f"{LOD_NAMES[index]} geometry reduction is too small")
        metrics[index]["reductionFromPrevious"] = round(reduction, 6)
    metrics[0]["reductionFromPrevious"] = 0.0

    return {
        "lodsVerified": True,
        "canonicalArmatureName": armatures[0].name,
        "shapeKeyNames": list(shape_contract),
        "lodMetrics": metrics,
    }
