# KnowMe Hero Avatar — Concept Provenance & Review Gate v1

Status: generated exploration exists; **not approved as runtime art and not a 3D asset**.

## Generated exploration

A first Hero Avatar concept exploration was generated after `HERO_AVATAR_ART_DIRECTION_V1.md` was locked. It is intended to accelerate visual discussion only. It depicts a contemporary stylized-realistic social avatar, multi-angle body views, face/eye/skin close-ups, expression examples, PBR material cues and modular wardrobe/accessory ideas.

Generation provenance (2026-09-18): `gen_id=db3826f7-816b-4493-ab7c-ee150462b403`.

The generated raster is retained in the conversation artifact store for review; it is deliberately **not committed as a runtime asset**. A concept image may be copied into the source-art archive only after human review and with its provenance retained.

## Review result

This exploration is useful for mood, silhouette, material language and modularity, but it does **not** satisfy the canonical Hero reference contract yet.

Blocking issues before sculpt:

1. The sheet does not provide all 10 canonical views as separate controlled exports (`front`, both 3/4, both true profiles, `back`, face, eye, hair and skin close-ups).
2. Camera/framing and pose are not sufficiently controlled for model-sheet reconstruction.
3. Cross-view garment and small-detail continuity is not guaranteed by a generated composite.
4. Visible wordmarks/logos and decorative symbols must be removed from the neutral Hero reference; the base avatar must not bake branding into clothing or anatomy.
5. Expression examples are illustrative, not the complete 25-expression/blendshape set required by `HERO_AVATAR_EXPRESSIONS`.
6. The image contains visual wardrobe ideas, but none are meshes, UVs, PBR texture sets, rigs, LODs or GLB/glTF runtime assets.

## Approval gate

Before sculpt approval, create or curate ten individual source references matching `HERO_AVATAR_REQUIRED_VIEWS`. Each must use the same identity, body proportions, neutral A-pose where applicable, neutral outfit, hairstyle/hairline, skin tone, lens/camera height and neutral studio lighting. Record provenance for every source image.

Human review must explicitly pass: identity continuity, anatomy, left/right consistency, garment seam/panel continuity, hairline continuity, absence of accidental text/logos, neutral lighting, reconstruction usefulness, and originality.

Only after that approval may the Hero move to sculpt/retopo. Even then, the concept is reference only: runtime completion still requires real geometry, UVs, PBR maps, canonical skeleton/facial rig, DNA morphs, expressions, LOD0/1/2, GLB/glTF export, automated manifest validation and visual QA on Android.

## Production next step

Produce the controlled ten-view reference pack, then establish the neutral Hero blockout from those views. Do not industrialize the 100+ cosmetic catalog before the base body's topology, silhouette, skeleton compatibility and DNA morph behavior are stable.
