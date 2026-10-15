# KnowMe Android — restauration de la mise à jour intégrée (1.1.2)

## État constaté le 15 octobre 2026

L'APK déjà installée et signalée par l'utilisateur affiche **1.1.1** et le commit `ff5b7e73`. Le Web est sur `2d448a51` et l'API sur `449ded7f`. L'action **Revérifier** de `Versions et synchronisation` compare ces éléments, mais **n'installe aucun APK**.

Le code de l'APK installée contient la fenêtre `MobileUpdateNotice`, qui peut consulter `GET /mobile-updates/android` au lancement et au retour au premier plan. Cette fenêtre n'apparaît que si une release **plus récente, identifiable et vérifiable** est publiée. Aucun GitHub Release n'était publié lors du diagnostic.

## Correctif proposé

- `apps/mobile/src/MobilePlatformSyncStatus.tsx` propose une action distincte **Vérifier les mises à jour**. Elle délègue au contrôleur central de mise à jour, sans ouvrir un deuxième installateur.
- `MobileUpdateNotice` permet une vérification manuelle qui ne dépend pas du throttle automatique et rouvre la fenêtre de mise à jour lorsqu'une release est trouvée.
- Le candidat Android passe à **1.1.2**, `versionCode: 4` (l'APK précédemment installée utilise `versionCode: 3`).
- Le workflow `publish-knowme-android.yml` **reconstruit et signe** la release, compare l'empreinte SHA-256 du certificat de signature à une empreinte épinglée, vérifie le `packageName`, le numéro de version et le hash, puis publie dans la même GitHub Release l'APK, le SHA-256 et `knowme-update.json`.
- Le manifeste GitHub est compatible avec `apps/api/src/mobile-updates/mobile-updates.controller.ts`, qui peut annoncer la mise à jour sans intervention du Play Store.

## Prérequis stricts avant publication

1. Récupérer **l'APK réellement installée** (ou sa signature certifiée) et confirmer son certificat SHA-256 et `versionCode`. La capture ne donne que les commits et la version affichée.
2. Fournir une **clé privée de signature Android pérenne qui correspond à ce certificat déjà installé**. Un certificat public ou une empreinte ne permet pas de fabriquer la clé privée. Si l'ancienne APK a été signée avec une clé de test temporaire/perdue, Android refusera la mise à jour in situ sous une nouvelle clé; préserver les données impose alors une procédure de migration sauvegardée et vérifiée.
3. Configurer dans les **GitHub Actions secrets** :
   - `KNOWME_ANDROID_KEYSTORE_BASE64` : keystore privé encodé base64, jamais commité;
   - `KNOWME_ANDROID_KEYSTORE_PASSWORD`, `KNOWME_ANDROID_KEY_ALIAS`, `KNOWME_ANDROID_KEY_PASSWORD`;
   - `KNOWME_ANDROID_EXPECTED_CERT_SHA256` : empreinte du **certificat de l'APK déjà installée** sans séparateurs. Le workflow refuse tout décalage entre ce pin et la clé de release.
4. Résoudre les contrôles de release applicables : `node scripts/platform-sync-preflight.mjs --release` bloque actuellement `animations.interactions`, encore indiqué comme `partial`. Ne **jamais** marquer artificiellement une fonctionnalité « implemented » pour contourner le contrôle.
5. Exécuter la CI et le build sur le SHA destiné à la release; déclencher le workflow uniquement après approbation et qualification.
6. Vérifier que l'API déployée sert `GET /mobile-updates/android`, avec la découverte de GitHub activée et aucune configuration manuelle d'update incomplète. Si nécessaire, mettre à jour l'API du VPS, indépendamment du site Vercel.
7. Tester **avec deux APK successives** sur téléphone réel : conservation du compte et des données, récupération de la release, permissions Android, certificat correspondant, progression téléchargement, annulation, redémarrage, profils/amis.

## Comportement final

Au prochain lancement de KnowMe ou au retour au premier plan, l'APK existante compatible vérifie périodiquement le flux. Si une release signée et de `versionCode` supérieur y figure, KnowMe propose une fenêtre et le bouton « Mettre à jour ». À l'appui, KnowMe télécharge dans son **cache privé**, vérifie le SHA-256, le package et la version, puis ouvre **l'installateur officiel Android**. Android doit toujours demander la confirmation de l'utilisateur; **l'installation silencieuse n'est pas promise**.

**Une branche / un artefact de CI / un déploiement Web ne constitue pas une mise à jour Android distribuée.** Le workflow échoue fermé si l'identité de signature ou le contrôle produit ne sont pas établis.
