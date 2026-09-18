# KnowMe Hero Avatar — Clean A-pose reconstruction reference v2

Status: **source-art / reconstruction reference only; NOT a runtime 3D asset**.

## Provenance

Generated 2026-09-18 as the next controlled iteration after `HERO_AVATAR_REFERENCE_PACK_V1.md`.

Generation id: `e014de55-7cb4-4278-898e-3759886c2eab`.

The raster is concept/reference material only. It MUST NOT be exposed through Cosmetics, counted as a GLB/glTF asset, or used as evidence that topology, UVs, PBR maps, skinning, morph targets, LODs or Android integration exist.

## What materially improved

- Neutral reconstruction-oriented A-pose instead of relaxed arms.
- Base body is visually separated from backpack/equipment and heavy outerwear.
- Front, 3/4, left/right profile, back and rear 3/4 reconstruction cues are present on one controlled board.
- Bare feet and close-fitting neutral sports layer expose limb proportions and deformation landmarks better than the previous street outfit.
- Dedicated face, eye, skin and lip detail references are present.
- Hair silhouette and face identity are clearer for later sculpt/hair-card production.
- Modular outfit families, PBR material targets and body-proportion reference remain explicitly separate from the canonical base mesh.

## Remaining source-art gate issues

This iteration is **not yet sculpt-approved as an exact orthographic reconstruction pack**. Before deriving production topology, normalize the following manually or through individually controlled views:

1. Match camera focal length, camera height and orthographic scale across front/profile/back exports.
2. Lock identical anatomical landmarks across views: crown, chin, acromion, elbow, wrist, ASIS/hip, knee, ankle and floor contact.
3. Remove the remaining tiny `K` garment marks from the canonical anatomy reference; branding belongs to Cosmetics.
4. Verify left/right hand and finger spacing in a production A-pose; generated fingers are reference-only.
5. Normalize hair clump placement between front/profile/back. Runtime hair will use a dedicated mobile hair-card asset and must not be fused to the body mesh.
6. Do not derive hidden anatomy literally from the sports garment silhouette. Sculpt a clean base body under the garment using anatomical landmarks.
7. Expression strip remains illustrative (6/25) and does not satisfy the canonical blendshape contract.

## First real 3D deliverable gate

The next artifact that may advance implementation status must be actual geometry, not another raster board. The Hero blockout must record at minimum:

- unit system: metres; Y-up runtime export;
- neutral A-pose and centered world origin;
- explicit body height target and ground contact;
- separate body, eyes, teeth/tongue where used, and hair placeholder objects;
- manifold/non-manifold report and unapplied-transform report;
- vertex/triangle counts per object;
- no clothing/accessory geometry fused into the canonical body;
- topology suitable for later deformation around shoulders, elbows, hips, knees, mouth and eyes;
- stable vertex order before DNA morph production begins.

No blockout is `runtime-ready` merely because it exists. It must subsequently pass retopology, UV/bake, PBR, `knowme.humanoid.v1`, `knowme.face.v1`, DNA morphs, 25-expression contract, LOD0/1/2 and Android runtime validation.

## Industrialization rule

The outfit examples are silhouette/family references only. Production catalogue growth must come from high-quality modular bases (cut, sleeve, collar, length, material, pattern and accessories) rather than counting trivial recolours as distinct artistic bases. All resulting runtime items remain subject to the authoritative Cosmetics/Ownership/Premium/Wallet pipeline and validated 3D manifest gate.