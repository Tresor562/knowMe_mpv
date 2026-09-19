# KnowMe Hero Avatar — Blender production handoff

This directory bridges the art DCC and the authoritative Avatar pipeline. It deliberately does **not** generate a Hero mesh. The artist must create/import the real geometry first.

## Scene contract

Use Blender metric units (`METRIC`, scale 1.0). Keep the production body in A-pose. Required v11 source meshes are `BODY`, `EYE_L`, and `EYE_R`; optional blockout meshes are `TEETH`, `TONGUE`, and `HAIR_PLACEHOLDER`. Clothing, shoes, weapons, backpacks and accessories must remain separate assets and must never be fused into `BODY`.

Before measuring, apply object transforms and set these reviewed custom properties only after the topology review: scene `knowme_centered_world_origin = true`; BODY `knowme_stable_vertex_order = true`; BODY `knowme_deformation_topology_ready = true`. Do not set them merely to make validation pass.

## Hero v12 certification

Open the real `.blend`, ensure `tools/avatar/blender` is importable, then run `knowme_hero_v12_export.py`. v12 preserves the full v11 geometry/skinning/UV/PBR/DNA/expression/combined-deformation gate and adds measured LOD certification.

The source certification mesh remains `BODY`. Production LOD meshes must additionally exist as `BODY_LOD0`, `BODY_LOD1`, and `BODY_LOD2`. They must all use the same armature, keep at most four active bone influences per vertex and carry the exact same ordered `Basis` + canonical DNA + canonical expression shape-key contract. Every shape key must be neutral during certification. This intentionally favors runtime correctness over destructive decimation that silently drops Avatar DNA or facial animation.

LOD geometry is measured from Blender loop triangles, not trusted metadata. Mobile ceilings are 60k / 30k / 12k triangles for LOD0/1/2. Counts must strictly decrease; LOD1 must reduce at least 25% from LOD0 and LOD2 at least 50% from LOD1. The report records vertices, triangles, active influence maxima and measured reduction ratios for each level. `hero-blockout-report-v12.domain.ts` independently recomputes reduction ratios and rejects forged metrics, wrong object identities, missing shape keys, non-canonical ordering and skinning over four influences.

The provenance gate consumes v12, so LOD evidence is revalidated when a report is bound to source bytes. This is still a certification pipeline, not proof that the artistic Hero exists. The real Hero `.blend`/GLB remains a production dependency until actual source geometry is created and passes these gates.

## Next production gates

Next: deterministic GLB/glTF export for the certified LOD set, runtime manifest generation/validation, Android GPU/memory/performance QA, then modular cosmetic compatibility against the common skeleton. Do not publish the Hero or derived cosmetics until their applicable gates pass.
