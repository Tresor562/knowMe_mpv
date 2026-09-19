# KnowMe Hero Avatar — Blender production handoff

This directory bridges the art DCC and the authoritative Avatar pipeline. It deliberately does **not** generate a Hero mesh. The artist must create/import the real geometry first.

## Scene contract

Use Blender metric units (`METRIC`, scale 1.0). Keep the production body in A-pose. Required mesh object names are `BODY`, `EYE_L`, and `EYE_R`; optional blockout meshes are `TEETH`, `TONGUE`, and `HAIR_PLACEHOLDER`. Clothing, shoes, weapons, backpacks and accessories must remain separate assets and must never be fused into `BODY`.

Before measuring, apply object transforms and set these reviewed custom properties only after the topology review: scene `knowme_centered_world_origin = true`; BODY `knowme_stable_vertex_order = true`; BODY `knowme_deformation_topology_ready = true`. Do not set them merely to make validation pass.

## Measure the real source

Open the real `.blend`, ensure `tools/avatar/blender` is importable, then run `knowme_hero_v11_export.py`. It reuses v10 geometry/skinning/UV/PBR/DNA/expression certification and adds measured combined-deformation stress QA. It writes `hero-blockout-report.json` next to the `.blend` by default.

The `dna_` and `expr_` namespaces coexist on the same `BODY` shape-key stack. Individual DNA and expression gates verify canonical names, topology, finite data, non-empty deformation and neutral export values. v11 then evaluates six deterministic runtime-legal stress combinations through Blender's dependency graph. For every case it requires stable evaluated topology and finite vertices, enforces a 0.42 m maximum combined displacement, builds a BVH over the evaluated BODY, and rejects non-adjacent triangle self-intersections. Triangle pairs sharing vertices are ignored so ordinary manifold adjacency is not misclassified as a collision.

The v11 report adds `combinedDeformationsVerified`, `combinationCaseNames`, `measuredCombinationCaseCount`, `measuredMaxCombinedVertexDeltaMeters`, and `measuredMaxSelfIntersectionCount`. `hero-blockout-report-v11.domain.ts` independently requires the canonical ordered stress matrix, exact count, finite displacement within budget and exactly zero measured self-intersections. The provenance gate consumes v11 as well, so JSON evidence is revalidated when bound to source bytes.

This is a certification pipeline, not proof that the artistic Hero exists. The real Hero `.blend`/GLB remains a production dependency until actual source geometry is created and passes these gates.

## Next production gates

Next: LOD0/LOD1/LOD2 generation and topology/skin/morph preservation policy; GLB/glTF export and runtime manifest validation; Android GPU/memory/performance QA; then modular cosmetic compatibility against the common skeleton. Do not publish the Hero or derived cosmetics until their applicable gates pass.
