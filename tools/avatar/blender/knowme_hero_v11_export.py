"""KnowMe Hero v11 exporter: v10 certification + combined DNA/expression stress QA."""
from __future__ import annotations
import json
from pathlib import Path
import bpy
import knowme_hero_v10_export as v10
from knowme_hero_combination_validation import validate_combined_deformations

REPORT_VERSION = 11


def export_report(output_path=None):
    body = bpy.context.scene.objects.get("BODY")
    if body is None or body.type != "MESH":
        raise RuntimeError("BODY mesh is required for Hero v11 certification")
    combinations = validate_combined_deformations(body)
    target = Path(output_path or bpy.path.abspath("//hero-blockout-report.json"))
    report = v10.export_report(str(target))
    report.update({
        "reportVersion": REPORT_VERSION,
        "combinedDeformationsVerified": True,
        "combinationCaseNames": combinations["caseNames"],
        "measuredCombinationCaseCount": combinations["caseCount"],
        "measuredMaxCombinedVertexDeltaMeters": round(combinations["maxVertexDeltaMeters"], 6),
        "measuredMaxSelfIntersectionCount": combinations["maxSelfIntersectionCount"],
    })
    target.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"KnowMe Hero v11 report written: {target}")
    return report


if __name__ == "__main__":
    export_report()
