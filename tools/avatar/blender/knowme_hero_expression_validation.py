"""Canonical facial-expression certification for the KnowMe Hero Avatar.

This module is intentionally Blender-side: it validates real BODY shape-key vertex data.
It does not turn concept art into runtime assets and does not fabricate missing expressions.
"""
from __future__ import annotations

import math

EXPRESSION_MORPHS = (
    "expr_blink_l",
    "expr_blink_r",
    "expr_brow_up_l",
    "expr_brow_up_r",
    "expr_smile_l",
    "expr_smile_r",
    "expr_frown_l",
    "expr_frown_r",
    "expr_jaw_open",
    "expr_mouth_pucker",
)

EPSILON = 1e-5
MAX_EXPRESSION_VERTEX_DELTA_M = 0.12


def validate_expression_morphs(body):
    """Validate canonical expression shape keys against BODY Basis.

    Returns measured evidence suitable for the Hero certification report.  The caller
    remains responsible for server-side verification of that report.
    """
    keys = body.data.shape_keys
    if keys is None or not keys.key_blocks:
        raise RuntimeError("BODY must contain Basis plus canonical facial expression shape keys")

    basis = keys.key_blocks.get("Basis")
    if basis is None or len(basis.data) != len(body.data.vertices):
        raise RuntimeError("BODY expression Basis must preserve canonical vertex topology")

    actual = [key.name for key in keys.key_blocks if key.name.startswith("expr_")]
    missing = [name for name in EXPRESSION_MORPHS if name not in actual]
    unexpected = [name for name in actual if name not in EXPRESSION_MORPHS]
    if missing or unexpected:
        raise RuntimeError(
            f"BODY expression morph set must be exact; missing={missing}, unexpected={unexpected}"
        )

    max_delta = 0.0
    for name in EXPRESSION_MORPHS:
        key = keys.key_blocks[name]
        if len(key.data) != len(basis.data):
            raise RuntimeError(f"Expression morph {name} changes BODY vertex count/order")
        if abs(float(key.value)) > EPSILON:
            raise RuntimeError(f"Expression morph {name} must be neutral (value=0) during certification/export")

        local_max = 0.0
        changed_vertices = 0
        for index, point in enumerate(key.data):
            delta = (point.co - basis.data[index].co).length
            if not math.isfinite(delta):
                raise RuntimeError(f"Expression morph {name} contains non-finite vertex data")
            if delta > EPSILON:
                changed_vertices += 1
            local_max = max(local_max, delta)

        if changed_vertices == 0:
            raise RuntimeError(f"Expression morph {name} is empty")
        if local_max > MAX_EXPRESSION_VERTEX_DELTA_M:
            raise RuntimeError(
                f"Expression morph {name} exceeds safe facial deformation delta ({local_max:.4f}m)"
            )
        max_delta = max(max_delta, local_max)

    return {
        "names": list(EXPRESSION_MORPHS),
        "count": len(EXPRESSION_MORPHS),
        "maxVertexDeltaMeters": max_delta,
    }
