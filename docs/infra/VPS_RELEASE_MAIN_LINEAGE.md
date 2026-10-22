# KnowMe VPS — provenance obligatoire des releases

Le reconciler `ops/sync-knowme-platform-vps.mjs` refuse désormais une APK issue d'une branche de PR, même si cette PR a réussi `quality` et `android-apk`. Une release recevable doit venir d'un commit **déjà intégré à `main`**.

Contrôle avant tout déploiement :
1. Valider comme auparavant la release signée localement et les checks sur le SHA exact.
2. Lire la tête de `main` dans le dépôt canonique `Tresor562/knowMe_mpv`.
3. Accepter le SHA de `main` lui-même, ou un ancien SHA dont la comparaison GitHub prouve que `main` en descend : `status=ahead`, `behind_by=0`, `base_commit=source`, `merge_base_commit=source`.
4. Recontrôler la tête de `main` pour détecter un changement concurrent.
5. Refuser toutes les réponses absentes, ambiguës, divergentes ou réseau indisponible, sans lancer les scripts de déploiement.

Cette politique permet un APK publié légèrement après son commit fusionné, sans autoriser les APK provenant d'une branche isolée. L'import du module dans les tests n'exécute pas le timer. Aucun secret ou nouveau service n'est requis.

Tests : `node --test ops/sync-knowme-platform-vps.test.mjs`.

**Limites :** cette preuve ne remplace pas la protection obligatoire de `main` (issue #703), la vérification du certificat Android, le SHA-256 binaire, la sauvegarde de base de données ou les contrôles en production. Le code GitHub n'est pas installé sur le VPS tant que son déploiement n'a pas été effectivement vérifié.

Retour arrière : revenir au script validé précédent, puis réinstaller la copie approuvée sur le VPS ; aucune migration de base ni changement d'APK n'est nécessaire.
