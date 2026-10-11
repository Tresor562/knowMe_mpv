# KnowMe — livraison synchronisée Web / Android / API

**Version candidate synchronisée dans le code : KnowMe 1.1.0** (Android `versionCode=2`).
Ce numéro ne constitue pas une preuve de disponibilité dans l'APK installé,
sur le VPS ou sur Vercel.

La synchronisation n'est **pas** simplement une palette de couleurs commune.
Elle impose un contrat de version identique, la même API, les mêmes parcours
fonctionnels, et la validation réelle des gestes/médias/animations sur Android
comme sur le Web.

## Source unique

`packages/link-contract/src/platform-sync.json` est la source de vérité pour
`productVersion`, `contractRevision` et les fonctionnalités attendues sur
les deux plateformes. Il est embarqué dans `@knowme/link-contract`, déjà utilisé
par Web, APK et API. Le portail Web expose `/api/version`; l'API expose
`/platform-sync/version`; le profil Android affiche sa version embarquée.

La même version produit ne signifie **pas** que les applications en production
ont déjà été déployées depuis le même commit : toujours comparer les empreintes
`commit` et tester les APK signés sur téléphone avant toute annonce.

## Réellement intégré dans le code de cette PR

- Raccourcis Android sur l'avatar : Ajouter une story / Voir la photo /
  Changer la photo, avec confirmation de la sauvegarde.
- Pipeline Android d'import de médias depuis Storage Access Framework vers
  cache privé, scan sur serveur, suppression du cache local.
- Éditeur Android de stories texte, photo et vidéo ; affichage de la photo
  téléchargée depuis l'API avec authentification.
- Les URL publiques des avatars sont générées par le même contrat pour
  Web et Android.
- Version du produit partagée entre app.json mobile, package.json Web/API
  et registre de fonctionnalités.
- La CI vérifie la présence des preuves de code Web/Android et les versions.

## Écarts NON TERMINÉS

Le registre liste explicitement chaque écart. Au 11 octobre 2026 :

- La publication et la lecture vidéo native Android sont codées avec un lecteur MP4 local ;
  la validation sur un téléphone réel et les différents codecs restent nécessaires.
- Création de discussions/groupes : sélection multiple et création de groupe nommée
  sont codées des deux côtés, mais les parcours nécessitent encore des tests utilisateurs.
- Animations, menus, transitions et gestes : toujours partiels et non validés
  écran par écran sur des appareils réels.
- Absence de garantie de parité pour toutes les fonctions hors du registre ;
  les nouveaux écrans doivent être inscrits avant de pouvoir être déclarés prêts.
- Les tests sur un téléphone physique, l'installation d'un APK signé identique
  au package déjà installé, et les tests Web en production sont nécessaires.
- La branche GitHub n'effectue **pas** à elle seule de déploiement VPS/Vercel
  ni de reconstruction automatique de l'APK Android installé.

## Contrôles

Sur chaque PR et build :

```bash
node --test scripts/platform-sync-preflight.test.mjs
node scripts/platform-sync-preflight.mjs
```

Avant de promouvoir une release commune :

```bash
node scripts/platform-sync-preflight.mjs --release
```

La commande avec `--release` refuse toute nouvelle release si un parcours
`releaseRequired` est `partial` ou `missing` sur l'une des plateformes.
Elle ne remplace pas les tests end-to-end, la preuve de même SHA dans
les déploiements Web/API et le build signé Android.

## Détection des versions réellement déployées

Le profil Android affiche maintenant **Versions et synchronisation** : les
réponses `/api/version` (Web) et `/platform-sync/version` (API) sont comparées
à la version, au contrat et au commit embarqués dans l'APK.

Pour vérifier un déploiement effectif (après publication, jamais avant) :

```bash
KNOWME_WEB_ORIGIN=https://knowme-nextech.vercel.app \
KNOWME_API_ORIGIN=https://31-56-85-53.sslip.io/knowme-api \
KNOWME_RELEASE_COMMIT=<SHA exact du build> \
node scripts/check-platform-deployment.mjs
```

L'outil échoue si les versions, les contrats ou les SHA diffèrent, ou si les
points de contrôle sont inaccessibles. Aucune déclaration « synchro » ne peut
être déduite d'un numéro de version seul.

La distribution GitHub `publish-knowme-android.yml` ne peut prendre qu'un
APK du même commit exact que son checkout, vérifie son checksum et refuse de
réécrire un tag de version déjà publié. Une qualification stricte est
disponible dans `knowme-unified-release-gate.yml` : elle **échoue tant que
des parcours nécessaires restent partiels**.

**Protocole de livraison :** un commit de référence, builds Web/API/Android
depuis ce commit, tests multimédias sur les deux interfaces, puis déploiements,
vérification des SHA et bascule vers la nouvelle version. En cas d'échec,
ne pas annoncer de synchronisation, ne pas écraser les APK existants et
revenir à la version de production stable.
