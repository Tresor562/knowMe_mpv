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

Open the real `.blend`, load `knowme_hero_blockout_export.py` in Blender's scripting workspace and run it. It writes `hero-blockout-report.json` next to the `.blend` by default.

The exporter evaluates Blender's dependency graph and measures the **evaluated mesh after modifiers**, rather than only the raw edit mesh. This is intentional: subdivision, mirror, geometry-nodes or other enabled modifiers can change runtime/export geometry and must be reflected in vertex/triangle budgets, manifold checks, body bounds, centering and ground-contact measurements. Object transforms are still required to be applied before approval.

The resulting report is input to the API's `validateHeroBlockoutReport`. The subsequent provenance stage must hash the actual `.blend`/GLB bytes and bind that digest to the report. A JSON report by itself is never proof that the Hero mesh exists.

## Next production gates

After the first measured blockout passes: sculpt/retopology review; UV and bake validation; PBR texture validation; canonical humanoid rig and skin weights; Avatar DNA morph targets; facial blendshapes; LOD0/LOD1/LOD2 generation; GLB/glTF export; runtime manifest validation; Android GPU/memory/performance QA. Do not publish the Hero or derived cosmetics until their applicable gates pass.
