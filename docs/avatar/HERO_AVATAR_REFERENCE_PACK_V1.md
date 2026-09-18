# KnowMe Hero Avatar — Controlled Reference Pack v1

Status: **concept/reference iteration only; not a runtime 3D asset and not sculpt-approved yet**.

## Provenance

Generated on 2026-09-18 after the initial Hero exploration review gate.

Generation id: `90ea491e-23c5-44c8-afcf-e31a4fd5398f`.

The raster remains a source-art/reference artifact. It MUST NOT be exposed through Cosmetics, counted as a GLB/glTF asset, or treated as proof of mesh/UV/rig/LOD completion.

## What this iteration establishes

This iteration deliberately moves from a loose mood board toward a reconstruction-oriented turnaround. It provides one coherent hero identity and explores front, front 3/4, left/right profile, rear 3/4, back, elevated/low-angle checks, face/eye/skin close-ups, hair continuity, expression examples, PBR material cues, modular wardrobe families, equipment families and palette language.

The visual direction is contemporary stylized realism suitable for KnowMe: human and expressive rather than toy-like, readable silhouettes, restrained tech/street language, mobile-conscious materials, and modular pieces designed to become original KnowMe assets rather than copies of protected designs.

## Review gate result

This is a stronger reconstruction reference than the first generated exploration, but it is **not accepted as the final canonical 10-view pack**.

Blocking issues before sculpt approval:

1. The canonical contract expects the exact `HERO_AVATAR_REQUIRED_VIEWS`; elevated and low-angle views shown here are useful QA views but do not replace the required dedicated face/eye/hair/skin reference exports.
2. Generated turnaround panels can still drift in seam placement, backpack geometry, hair clump placement, shoe construction and small garment details. These details must be normalized before topology is derived.
3. The neutral base-body reconstruction reference must remove backpack and branding/wordmarks. Accessories and branded cosmetic variants belong to separate assets, not the canonical anatomy/base garment reference.
4. The turnaround should use a neutral A-pose for body reconstruction. The relaxed arms in this sheet are conceptually useful but insufficient for final rig/topology production.
5. The expression row is illustrative only (6 examples); it does not satisfy the canonical 25-expression/blendshape contract.
6. No geometry, UVs, texture maps, skin weights, skeleton, blendshapes, LOD meshes or runtime GLB/glTF were produced by this image-generation step.

## Locked visual decisions for the next source-art pass

- Preserve the same identity, facial proportions, skin family and hair silhouette.
- Use neutral studio lighting and a reconstruction-friendly lens/camera height.
- Produce body turnaround in neutral A-pose, with no backpack, jewelry, text, logos or asymmetrical removable accessories.
- Keep a minimal close-fitting neutral garment layer so anatomy and deformation landmarks remain readable.
- Preserve realistic skin response while avoiding pore/noise detail that would force oversized mobile textures.
- Treat hair as a silhouette target for a later mobile hair-card/groom conversion, not as literal strand geometry.
- Keep outfit, shoe and equipment concepts as modular cosmetic families separate from the Hero base body.

## Required next production gate

Produce the final canonical A-pose source set as individually controlled references, normalize cross-view landmarks, and only then start the Hero blockout/sculpt. The first 3D deliverable must be real geometry with measurable topology and scale; it must subsequently pass retopology, UV/PBR, canonical skeleton/facial rig, DNA morph, expression, LOD and Android runtime validation before it can be called an implemented Hero Avatar.
