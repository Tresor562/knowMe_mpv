"""KnowMe Hero v12 exporter: v11 deformation QA + measured LOD certification."""
from __future__ import annotations
import json
from pathlib import Path
import bpy
import knowme_hero_v11_export as v11
from knowme_hero_lod_validation import validate_hero_lods

REPORT_VERSION = 12


def export_report(output_path=None):
    target = Path(output_path or bpy.path.abspath("//hero-blockout-report.json"))
    report = v11.export_report(str(target))
    lods = validate_hero_lods()
    report.update({
        "reportVersion": REPORT_VERSION,
        "lodsVerified": True,
        "lodCanonicalArmatureName": lods["canonicalArmatureName"],
        "lodShapeKeyNames": lods["shapeKeyNames"],
        "lodMetrics": lods["lodMetrics"],
    })
    target.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"KnowMe Hero v12 report written: {target}")
    return report


if __name__ == "__main__":
    export_report()
