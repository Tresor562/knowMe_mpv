# KnowMe — updates sans téléchargement manuel d'APK

## Ce que cette branche apporte immédiatement

Le client Android existant utilise toujours le flux de versions signées
`GET /mobile-updates/android`. Il vérifie un `versionCode` supérieur,
un SHA-256 et une URL HTTPS puis confie le contrôle du package
`com.knowme.app` et de la version au module natif
`KnowMeApkInstaller`.

Cette branche ajoute une préparation anticipée :
- sur Wi-Fi ou Ethernet **non facturé**, l'APK peut être chargée
  automatiquement dans le cache privé de KnowMe lorsque le client détecte
  une version supérieure ;
- une seule requête de téléchargement est partagée entre la préparation et
  le bouton « Mettre à jour » ;
- en 4G/5G ou connexion facturée, l'APK n'est téléchargée que lorsque
  l'utilisateur appuie sur « Mettre à jour » ;
- un cache incomplet est supprimé ; le SHA-256 est vérifié **par le module
  natif avant d'ouvrir l'installateur Android** ;
- l'APK n'apparaît pas dans le dossier Téléchargements du téléphone ;
- la confirmation Android d'installation reste obligatoire.

Cette amélioration ne change **pas** l'APK déjà installée avant qu'une
nouvelle APK signée et compatible ne soit effectivement installée.

## Solution de long terme : deux couches complémentaires

### 1. OTA pour le code React Native

Intégrer `expo-updates` (version compatible **Expo SDK 53**, actuellement
`0.28.18`) avec **EAS Update** et un `runtimeVersion` basé sur
l'identité de la partie native (pas sur le commit JS). Configurer un
`extra.eas.projectId`, `updates.url` (HTTPS) et deux canaux distincts
`preview` et `production`. Le code natif `expo-updates` doit être
présent dans une **nouvelle APK de transition** installée une première fois.

Lorsque cette APK est installée :
- les correctifs d'interface, logique TypeScript/JavaScript, traductions,
  thèmes, médias embarqués et navigation qui ne changent pas les modules
  natifs passent par OTA ;
- une mise à jour téléchargée est appliquée au démarrage suivant ou
  lors d'un redémarrage sûr, jamais en plein appel, capture audio, upload,
  composition de message ou transaction ;
- une panne ou un bundle incompatible doit permettre de conserver/retourner
  à la dernière version fonctionnelle ;
- tests automatiques de parité et de navigation avant publication,
  contrôle des versions de runtime, diffusion progressive et rollback.

L'activation exige **l'identifiant du projet Expo** et le jeton d'édition
`EXPO_TOKEN` dans les secrets Actions. Ne pas mettre les secrets dans Git.
Mettre à jour `apps/mobile/package.json` et **régénérer le
`pnpm-lock.yaml`** avec pnpm 10 (ne pas fabriquer ce lockfile).

### 2. Mises à jour binaires Android

Tout nouveau module Android, permission, configuration native, changement
de SDK, changement de signature ou évolution majeure de l'architecture
nécessite une nouvelle APK signée (ou une mise à jour Play Store).
La préparer automatiquement côté CI, vérifier l'empreinte de signature,
`versionCode`, SHA-256, compatibilité et manifeste, puis la distribuer
au gestionnaire intégré. Aucun contournement de l'accord Android.

Les certificats des anciennes APK doivent **correspondre**. Une APK signée
avec une autre clé ne peut pas s'installer par-dessus l'application existante
en gardant les données via une mise à jour ordinaire.

## Conditions indispensables pour déclarer la fonction active

1. EAS Update connecté à un projet et canal ;
2. build Android de transition contenant `expo-updates`, signé avec la
   même clé que l'installation cible ;
3. preuve qu'un correctif JS est reçu sans APK, avec conservation des données ;
4. preuve qu'un changement natif déclenche au contraire une mise à jour
   binaire et confirmation Android ;
5. revue des changements sensibles, tests hors ligne, Wi-Fi/4G, corruption,
   manque de stockage et retour arrière ;
6. API VPS et Web déployés indépendamment, vérification des versions
   réellement en production.

**Statut actuel :** la préparation automatique de l'APK est codée
sur cette branche, mais le canal OTA JS n'est pas encore configuré.
Aucune promesse de « toutes les mises à jour sans exception » n'est
techniquement possible sur un Android standard.

Références :
- https://docs.expo.dev/eas-update/getting-started/
- https://docs.expo.dev/eas-update/runtime-versions/
- https://docs.expo.dev/eas-update/deployment/
