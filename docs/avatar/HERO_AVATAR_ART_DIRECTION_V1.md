# KnowMe Hero Avatar — Art Direction & 3D Production Handoff v1

Status: production specification. This document is a handoff for concept, sculpt, retopo, texture, rig and runtime validation. Concept/reference images are never runtime assets.

## 1. Visual north star

KnowMe avatars must read as premium social identities rather than game soldiers or toy mascots. The target is a contemporary, optimistic, globally legible stylized-realism: believable anatomy and materials, simplified enough to remain attractive on small Android screens, with expressive eyes/face and a clean silhouette at distance.

Original-design rule: do not reproduce a protected character, branded outfit, logo, weapon or signature silhouette. References may communicate lighting, construction, material behavior or proportions only.

### Shape language
- Human proportions with mild stylization; no chibi/head exaggeration.
- Friendly, confident neutral expression; avoid permanent smile or aggressive brow.
- Face planes must survive both soft frontal light and rim light.
- Hands, shoulders, neck and jaw need enough topology for close social-camera framing.
- Neutral base must remain identity-agnostic: DNA morphs, skin, hair and cosmetics create identity rather than baked-in stereotypes.

### Material language
- Skin: physically plausible roughness variation; no plastic sheen. Preserve subtle lip/cheek/ear variation without baked dramatic lighting.
- Eyes: clear sclera/iris separation and controlled corneal highlight; avoid oversized anime eyes.
- Hair: authored as mobile hair cards / optimized geometry with clean massing before strand detail.
- Cloth: readable weave/folds through normal/roughness where possible rather than unnecessary geometry.
- Metals: metallic/roughness workflow; no painted fake specular highlights.

## 2. Concept sheet that must exist before sculpt approval

Produce one coherent character sheet using the same face, proportions, hairstyle, skin tone, neutral outfit, camera height and neutral studio lighting in every view. Required exports correspond exactly to the runtime Hero contract:

1. `front` — orthographic-feeling full body, A-pose.
2. `threeQuarterLeft` — full body 45°.
3. `threeQuarterRight` — full body 45°.
4. `profileLeft` — true 90° profile.
5. `profileRight` — true 90° profile.
6. `back` — full body, same camera height.
7. `faceCloseup` — front face, neutral expression.
8. `eyeCloseup` — iris/sclera/lid material and topology reference.
9. `hairCloseup` — massing, hairline and card/strand flow reference.
10. `skinMaterialCloseup` — skin roughness/color breakup reference under neutral light.

Concept generation may accelerate exploration, but the approved sheet must be manually checked for cross-view identity, anatomy, garment continuity, hairline continuity, left/right consistency and absence of accidental logos/text. Generated images are references only.

## 3. Hero technical target

Canonical keys are defined in code, not duplicated here: `HERO_AVATAR_KEY`, `AVATAR_CANONICAL_SKELETON`, and `AVATAR_CANONICAL_FACIAL_RIG` remain authoritative.

- Units: meters; Y-up/runtime orientation must be normalized at export.
- Neutral bind pose: A-pose.
- One UV set for the Hero body runtime contract.
- PBR: metallic/roughness, authored in linear workflow with correctly tagged color textures.
- Skinning: maximum 4 bone influences per vertex.
- Runtime package: GLB/glTF manifest validated by `validateAvatarAssetManifest`.
- LOD0/LOD1/LOD2 are mandatory and must genuinely reduce geometry.
- Hero body must carry every body and face DNA morph required by the canonical manifest contract.
- Facial production must cover every expression in `HERO_AVATAR_EXPRESSIONS`; names are contract data and must not be renamed during DCC export.

## 4. DCC production chain

### Concept → sculpt
Use the approved multi-angle sheet as the source of truth. Establish primary proportions first, then face planes, hands/feet and secondary forms. Do not sculpt clothing into the permanent body mesh.

### Retopology
Create deformation-friendly loops around eyes, mouth, nasolabial area, shoulders, elbows, wrists, hips, knees and ankles. Keep topology symmetrical where it improves morph authoring, but permit intentional texture/detail asymmetry. Avoid hidden high-density areas that do not improve silhouette or deformation.

### UV / baking / texturing
UVs must be non-overlapping where unique skin detail is required, consistently padded, and mip-safe. Bake from approved high poly where useful. Author base color without baked lighting, normal detail, and roughness variation. Texture compression/runtime conversion happens after source masters are archived.

### Rig / blendshapes
Bind to the common KnowMe humanoid skeleton. Validate shoulders, elbows, wrists, hips, knees, neck and jaw at extreme but plausible poses. Build DNA morphs from the neutral approved mesh and facial expressions from the same topology. Combination tests are mandatory: body morph + face morph + expression + garment.

### LOD
LOD1 and LOD2 must preserve silhouette, face readability and skinning stability. Reduce invisible loops and microdetail before damaging the silhouette. Revalidate blendshape/rig compatibility after each generated or hand-authored LOD.

### Export
Export clean GLB/glTF with no cameras, debug lights, hidden sculpt meshes, unused materials, orphan bones or editor-only nodes. Asset manifest metadata must describe the exported file truthfully; validation metadata is not a substitute for inspecting the GLB.

## 5. Hero acceptance poses

Before approval capture the Hero in: neutral A-pose, relaxed idle, arms overhead, elbows fully bent, deep squat, seated pose, walking stride, head turn/up/down, jaw open, smile, frown, blink left/right and cheek puff. Inspect clipping, volume collapse, normal artifacts, eye penetration, lip separation and neck/shoulder deformation.

## 6. Android review gates

Review on a representative low/mid Android device as well as desktop DCC preview. Test cold load, 360° rotation, rapid DNA slider changes, expression playback, animation transitions and at least one full outfit. The existing manifest budgets are hard publication gates, not targets to consume. Prefer materially cheaper assets when visual difference is negligible.

No asset is considered runtime-complete merely because this document or a concept image exists. Completion requires an actual modeled, retopologized, UV-mapped, textured, rig-compatible, LOD-equipped GLB/glTF that passes automated validation and visual QA.

## 7. Modular catalog handoff

After Hero approval, derive catalog families rather than 100 unrelated meshes. Start from carefully authored silhouette families and parameterize meaningful variants:

- Tops: fitted tee, relaxed tee, shirt, hoodie, knit, jacket, cropped/long variants.
- Bottoms: straight/slim/wide trousers, denim family, shorts, skirt families.
- Outerwear: bomber, overshirt, coat and technical shell families.
- Footwear: sneaker, boot, loafer/formal and sandal families.
- Hair: short, medium, long, tied, braided/coiled and textured-volume families using shared scalp/hairline rules.
- Equipment: back, waist, hand and shoulder-compatible families where slots permit.

Variant dimensions may include sleeve, collar, hem, fit, material, palette, pattern and compatible accessories. A variant must still earn its place visually; palette swaps alone must not be used to pretend the catalog has artistic breadth.

## 8. Production source layout

Recommended source hierarchy (masters are not shipped directly):

`avatar/hero/concept/`
`avatar/hero/sculpt/`
`avatar/hero/retopo/`
`avatar/hero/textures/source/`
`avatar/hero/rig/`
`avatar/hero/lod/`
`avatar/hero/export/`
`avatar/catalog/<family>/<asset>/`

Every runtime asset should retain provenance metadata: author/tool version, source revision, export revision, skeleton version, material profile, validation result and checksum. This enables deterministic re-export when the common skeleton or Android budget evolves.
