# KnowMe — livraison automatique Web + APK (canal préversion)

## Déclencheur

Chaque commit envoyé à la branche `main` déclenche :
1. la CI complète (qualité, API, Web, tests) ;
2. le déploiement Web Vercel via la connexion Git existante ;
3. le workflow **KnowMe APK Build Once** sur le même SHA, même si seul le code Web a changé.

Une pull request ne publie jamais d'APK de mise à jour. Les tests et les builds peuvent y tourner pour validation.

## Versions Android sans modification manuelle

`scripts/prepare-android-auto-version.mjs` attribue dans le runner GitHub uniquement :
- un `versionCode` strictement supérieur aux anciens préviews (10000 + numéro de run) ;
- un `versionName` `MAJOR.MINOR.versionCode` ;
- un fichier d'identité avec le SHA Git, la version et le canal.

Il met temporairement en accord le contrat produit, les versions Web/API *du checkout utilisé pour compiler l'APK* et `app.json`. Rien n'est poussé automatiquement dans GitHub ; le site Vercel reste sur la version produit inscrite dans `main`. La **version APK peut donc différer de la version affichée sur le Web** ; les deux builds ont le même commit fonctionnel, pas nécessairement le même numéro de release. Ne pas présenter cela comme une preuve de parité des versions déployées.

Le numéro généré ne doit pas être réutilisé. Une mise à jour APK n'est compatible avec une installation préexistante que si son **certificat Android reste identique**.

## Publication conditionnée à la qualité

`knowme-compatible-preview-update.yml` attend que `quality` et `android-apk` soient réussis pour le même SHA de `main`. Il rejette un commit remplacé, un artefact d'un autre commit, un APK sans manifeste, un SHA256 erroné, un package/version incompatibles ou un certificat différent de celui du canal de préversion déjà diffusé.

Après vérification il publie une GitHub Release `vVERSION-preview`, avec l'APK, l'empreinte et `knowme-update.json`. Aucune release existante n'est écrasée. Les builds de preview ne sont **pas** des releases Play Store ou des APK signés pour un autre canal de production.

## Distribution en interne depuis le VPS

Un administrateur doit avoir effectivement installé l'API de mise à jour et le timer systemd `knowme-android-updates.timer` sur le VPS. Le timer télécharge la release validée, vérifie SHA256/package/version/certificat, puis publie atomiquement le manifeste local.

Les APK compatibles interrogent `/mobile-updates/android` sur le VPS, affichent l'offre de mise à jour pendant l'utilisation et peuvent afficher une notification en tâche de fond via WorkManager (réglé au minimum sur 15 minutes, mais Android peut retarder). L'utilisateur confirme toujours l'installation à l'aide du mécanisme Android.

**Important :** un push GitHub ou une release publiée ne prouve pas que le VPS distribue une nouvelle APK. Vérifier que le timer, le montage, l'endpoint public et l'installation sur un téléphone réel fonctionnent avant de dire aux utilisateurs que la mise à jour est disponible.

## Vérification après configuration

1. Fusionner une pull request après les validations requises.
2. Confirmer que le dernier déploiement Vercel de `main` est `READY` et visible.
3. Vérifier la réussite des workflows `CI`, `KnowMe APK Build Once` et `Publish compatible KnowMe Android preview update`.
4. Confirmer que l'API VPS annonce la versionCode publiée, avec une URL APK sur le VPS et le même SHA256.
5. Depuis une APK préversion **signée avec le même certificat**, tester ouverture et arrière-plan, notification, téléchargement, installation Android et conservation des données.

Si une vérification échoue, ne pas envoyer une notification trompeuse ni forcer une installation. Corriger la configuration ou le build, puis déclencher une nouvelle release.
