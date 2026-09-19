# KnowMe Hero Avatar — Blender production handoff

This directory bridges the art DCC and the authoritative Avatar pipeline. It deliberately does **not** generate a Hero mesh. The artist must create/import the real geometry first.

## Scene contract

Use Blender metric units (`METRIC`, scale 1.0). Keep the production body in A-pose. Required mesh object names are `BODY`, `EYE_L`, and `EYE_R`; optional blockout meshes are `TEETH`, `TONGUE`, and `HAIR_PLACEHOLDER`. Clothing, shoes, weapons, backpacks and accessories must remain separate assets and must never be fused into `BODY`.

Before measuring, apply object transforms and set these reviewed custom properties only after the topology review:

- Scene: `knowme_centered_world_origin = true`
- BODY: `knowme_stable_vertex_order = true`
- BODY: `knowme_deformation_topology_ready = true`

Do not set those properties merely to make validation pass. They represent explicit production review decisions.

## Measure the real source

For the current facial-expression pipeline, open the real `.blend`, ensure `tools/avatar/blender` is importable in Blender, then run `knowme_hero_v10_export.py`. It reuses the audited v9 geometry/skinning/UV/PBR/DNA measurements and adds measured canonical `expr_` shape-key evidence. It writes `hero-blockout-report.json` next to the `.blend` by default.

The `dna_` and `expr_` namespaces deliberately coexist on the same `BODY` shape-key stack. DNA certification must not reject canonical expression keys, and expression certification must not accept arbitrary extra `expr_` keys. All DNA and expression values must be neutral (`0`) during certification/export.

The exporter evaluates Blender's dependency graph and measures the **evaluated mesh after modifiers**, rather than only the raw edit mesh. This is intentional: subdivision, mirror, geometry-nodes or other enabled modifiers can change runtime/export geometry and must be reflected in vertex/triangle budgets, manifold checks, body bounds, centering and ground-contact measurements. Object transforms are still required to be applied before approval.

The v10 report adds `expressionsVerified`, `expressionMorphNames`, `measuredExpressionMorphCount`, and `measuredMaxExpressionVertexDeltaMeters`. The API now validates these fields independently in `hero-blockout-report-v10.domain.ts`: the canonical 10-name ordered set is mandatory, count must match exactly, deformation evidence must be finite/non-empty and remain at or below 0.12 m, and arbitrary client fields continue through the inherited exact-key rejection boundary. The v9 geometry/PBR/skinning/DNA gate is reused rather than duplicated.

The provenance stage now consumes the v10 gate too. It hashes the actual `.blend`/GLB bytes and binds that digest to the report, then revalidates expression semantics and deformation budget along with the existing geometry/PBR/DNA evidence. A JSON report by itself is never proof that the Hero mesh exists.

## Next production gates

Next: combined DNA-expression deformation QA (including unsafe combinations and collision/intersection checks); LOD0/LOD1/LOD2 generation; GLB/glTF export; runtime manifest validation; Android GPU/memory/performance QA. The real Hero `.blend`/GLB is still an artistic production dependency and must not be claimed as complete until those source assets actually exist and pass the gates.
