# KnowMe — Blender Asset Factory

Générateur Blender 4.0+ sans abonnement. Il fabrique un personnage 3D original avec une vraie armature (7 os, animations Idle / Wave / Celebrate), et une couronne 3D animée (Orbit / Reveal). Les maillages possèdent leurs matériaux physiques et sont exportés en GLB, accompagnés de leurs sources .blend. Il ne s'agit pas d'images PNG animées.

## Reproduction locale sur Ubuntu 24.04

    sudo apt-get update && sudo apt-get install -y blender ffmpeg
    mkdir -p artifacts/knowme-3d
    blender -b --factory-startup --python-exit-code 42 --python tools/asset_factory/build.py -- --kind mascot --out artifacts/knowme-3d
    blender -b --factory-startup --python-exit-code 42 --python tools/asset_factory/build.py -- --kind crown --out artifacts/knowme-3d
    python3 tools/asset_factory/verify.py artifacts/knowme-3d

Le workflow GitHub Actions « KnowMe Blender Asset Factory » exécute ces commandes lorsqu'une PR modifie ce dossier, après fusion sur main, ou sur demande manuelle depuis main.

## Livrables par exécution

- mascot.blend et crown.blend : vrais projets de modélisation avec os, actions et matériaux éditables.
- mascot.glb et crown.glb : modèles 3D mobiles animés glTF 2.0.
- mascot.webm et crown.webm : animations précalculées pour appareils modestes (12 fps dans la démo).
- mascot.png et crown.png : images de repli.
- Fichiers JSON de manifeste et empreintes SHA-256.

Les artefacts sont accessibles dans Actions > exécution du workflow > Artifacts, puis expirent après 7 jours. Il ne s'agit pas de stockage média permanent ou d'une publication Web/APK.

## Qualité et limites

Ceci est un socle 3D procédural vérifiable, pas encore un rendu de niveau artistique Duolingo ou Telegram. Un artiste pourra retravailler les sculptures, UV, textures, expressions et animations dans les .blend. Le GLB fournit de vrais modèles manipulables et des clips, le WebM est seulement une vidéo rendue. Le rendu Cycles CPU est compatible avec les runners standard mais reste coûteux : workflow limité aux changements spécifiques du dossier.

Workstream: infra (#698), intégration visuelle future à coordonner avec design (#699) et marketplace (#697). Aucun déploiement, changement de base de données, d'APK ou d'écran dans cette PR.
