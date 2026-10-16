# KnowMe 1.1.5 — transition Android OTA

## Objectif et portée réelle

KnowMe 1.1.4-preview est la dernière APK officiellement publiée au début
de cette livraison. Elle n'embarque pas `expo-updates` ; elle ne peut donc
**pas** recevoir de code JS sans installer au préalable une version Android
native compatible.

La candidate **1.1.5 (versionCode 7)** apporte :
- `expo-updates@0.28.18` (compatibilité Expo SDK 53) ;
- runtime strict `knowme-android-sdk53-native7` ;
- canal `preview` (production n'accède pas aux préversions) ;
- serveur propre `GET /mobile-updates/expo` implémentant une réponse
  `application/expo+json` selon Expo Updates v1, ou `204` sans OTA ;
- chargement OTA en arrière-plan au démarrage / retour au premier plan et
  activation au prochain démarrage sûr ;
- gestionnaire natif existant + préchargement privé d'APK sur Wi-Fi non facturé.

L'URL de découverte de l'APK et celle de l'OTA sont distinctes :
- `GET /mobile-updates/android` : nouvelle APK native signée ;
- `GET /mobile-updates/expo` : bundle JavaScript compatible uniquement.

## Sécurité et versionnage

- Les assets OTA sont versionnés et chargés depuis une GitHub Release
  immuable de `Tresor562/knowMe_mpv` ;
- le serveur vérifie la plateforme, le canal, le runtime, l'identité de
  release et les adresses des assets avant de servir un manifeste ;
- chaque asset porte une empreinte SHA-256; Expo vérifie les données au
  téléchargement ;
- le workflow OTA refuse de publier si la configuration native, les
  plugins, le lockfile ou les dépendances ont changé depuis l'APK native
  1.1.5 signée et publiée ;
- arrêt d'urgence serveur : `KNOWME_EXPO_OTA_ENABLED=false` (bloque
  de nouvelles récupérations ; les bundles déjà téléchargés peuvent
  rester en cache) ;
- les changements de permissions, de module Android, d'Expo SDK ou
  d'architecture nécessitent une **nouvelle APK** et un nouveau
  `runtimeVersion` ;
- la clé de signature de la nouvelle APK doit rester identique à celle
  de la version précédemment installée pour permettre une mise à jour
  sans désinstallation. Android conserve le consentement final.

## Livraison et preuves obligatoires

1. Le workflow `knowme-ota-resolve-lock.yml` régénère le vrai
   `pnpm-lock.yaml` ; aucun verrou transcrit manuellement.
2. CI, tests API, TypeScript mobile et build Gradle de l'APK 1.1.5 doivent
   réussir sur le même commit.
3. Une préversion signée `v1.1.5-preview` avec manifeste de mise à jour
   doit être réellement publiée, sinon ne pas proposer cette APK.
4. Le nouveau code API doit être déployé sur le VPS utilisé par KnowMe.
5. `knowme-expo-ota-preview.yml` exporte un bundle JS Android, le
   transforme en manifeste et ne le publie qu'après vérification de
   la release native correspondante.
6. Tester sur téléphone : 1.1.4 vers 1.1.5 (Android), puis
   changement visible 1.1.5 vers 1.1.5+OTA **sans installer d'APK**,
   redémarrage sûr, persistance de connexion, offline, corruption,
   absence de canal production et retour arrière.

## Limitations techniques honnêtes

Une APK déjà installée ne peut pas recevoir rétroactivement un nouveau
module natif. Même après cette transition, il n'existe pas de mise à jour
silencieuse universelle de toutes les fonctions Android : l'installateur
officiel exige une confirmation pour les changements natifs.

État de cette branche = implémentation candidate. Pas de revendication de
livraison ou de validation sur téléphone avant preuves effectives.
