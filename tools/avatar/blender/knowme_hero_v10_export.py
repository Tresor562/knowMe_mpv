"""KnowMe Hero v10 certification exporter.

Extends the measured v9 Hero pipeline with real canonical facial-expression
shape-key evidence. This wrapper exists to keep the already-audited v9
geometry/PBR/skinning exporter stable while v10 is introduced.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import bpy

import knowme_hero_blockout_export as base
from knowme_hero_expression_validation import validate_expression_morphs

REPORT_VERSION = 10


def _validate_dna_morphs_with_expression_namespace(body):
    """Validate DNA while allowing the separately-certified expr_ namespace."""
    keys = body.data.shape_keys
    if keys is None or not keys.key_blocks:
        raise RuntimeError("BODY must contain Basis plus canonical Avatar DNA shape keys")
    basis = keys.key_blocks.get("Basis")
    if basis is None or len(basis.data) != len(body.data.vertices):
        raise RuntimeError("BODY DNA Basis must preserve canonical vertex topology")

    actual = [key.name for key in keys.key_blocks if key.name.startswith("dna_")]
    missing = [name for name in base.DNA_MORPHS if name not in actual]
    unexpected = [name for name in actual if name not in base.DNA_MORPHS]
    if missing or unexpected:
        raise RuntimeError(
            f"BODY DNA morph set must be exact; missing={missing}, unexpected={unexpected}"
        )

    max_delta = 0.0
    for name in base.DNA_MORPHS:
        key = keys.key_blocks[name]
        if len(key.data) != len(basis.data):
            raise RuntimeError(f"DNA morph {name} changes BODY vertex count/order")
        if abs(float(key.value)) > base.EPSILON:
            raise RuntimeError(f"DNA morph {name} must be neutral (value=0) during certification/export")
        local_max = 0.0
        for index, point in enumerate(key.data):
            delta = (point.co - basis.data[index].co).length
            if not math.isfinite(delta):
                raise RuntimeError(f"DNA morph {name} contains non-finite vertex data")
            local_max = max(local_max, delta)
        if local_max <= base.EPSILON:
            raise RuntimeError(f"DNA morph {name} is empty")
        if local_max > base.MAX_DNA_VERTEX_DELTA_M:
            raise RuntimeError(f"DNA morph {name} exceeds safe deformation delta ({local_max:.4f}m)")
        max_delta = max(max_delta, local_max)

    return {
        "names": list(base.DNA_MORPHS),
        "count": len(base.DNA_MORPHS),
        "maxVertexDeltaMeters": max_delta,
    }


def export_report(output_path=None):
    body = bpy.context.scene.objects.get("BODY")
    if body is None or body.type != "MESH":
        raise RuntimeError("BODY mesh is required for Hero v10 expression certification")

    # Measure expressions before invoking the rest of the production gate.
    expressions = validate_expression_morphs(body)

    # v9 treated every non-Basis shape key as DNA. v10 deliberately namespaces
    # dna_ and expr_ so both canonical sets can coexist on the same runtime mesh.
    original_validator = base._validate_dna_morphs
    original_version = base.REPORT_VERSION
    base._validate_dna_morphs = _validate_dna_morphs_with_expression_namespace
    base.REPORT_VERSION = REPORT_VERSION
    try:
        target = Path(output_path or bpy.path.abspath("//hero-blockout-report.json"))
        report = base.export_report(str(target))
    finally:
        base._validate_dna_morphs = original_validator
        base.REPORT_VERSION = original_version

    report.update(
        {
            "expressionsVerified": True,
            "expressionMorphNames": expressions["names"],
            "measuredExpressionMorphCount": expressions["count"],
            "measuredMaxExpressionVertexDeltaMeters": round(
                expressions["maxVertexDeltaMeters"], 6
            ),
        }
    )
    target.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"KnowMe Hero v10 report written: {target}")
    return report


if __name__ == "__main__":
    export_report()
