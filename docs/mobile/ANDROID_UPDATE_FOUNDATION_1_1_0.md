# KnowMe 1.1.0 — base des mises à jour Android sans Play Store

## Implémentation sur cette branche

- `GET /mobile-updates/android` expose uniquement des versions valides. En l'absence d'une version officiellement publiée et signée, la réponse contient `release: null`.
- L'API peut vérifier la publication officielle d'une Release GitHub portant un manifeste `knowme-update.json` ou utiliser une configuration serveur contrôlée.
- L'application Android vérifie au lancement, au retour au premier plan et périodiquement **lorsqu'elle est ouverte**, sans empêcher l'utilisation de la messagerie en cas d'échec réseau.
- Après accord de l'utilisateur, le téléchargement passe par le cache privé de l'application. Le module Android vérifie le SHA-256, le nom de package `com.knowme.app` et un `versionCode` strictement supérieur, puis ouvre **l'installateur officiel Android**.
- Les permissions Android relatives aux APK hors boutique sont respectées ; aucune installation silencieuse ni contournement des protections du système.
- Le plugin Expo est ajouté après le plugin vidéo KnowMe existant et les tests vérifient leur coexistence.
- Le workflow d'assemblage actuel reste inchangé, pour ne pas casser la génération des APK de test.

## Différence entre code, publication et installation

Ce travail est une **fondation logicielle**, pas une distribution signée et validée en production.

1. Les APK actuellement générées avec une clé de signature de test ne garantissent pas la possibilité d'écraser les anciennes APK installées. Pour les mises à jour réelles, les versions successives doivent être signées avec **la même clé de production**.
2. Une ancienne APK qui ne contient pas le module natif ne peut pas recevoir ce mécanisme rétroactivement : une nouvelle installation initiale est indispensable.
3. Pour publier une nouvelle version, stocker la clé de signature pérenne dans les secrets GitHub Actions avec les noms documentés ci-dessous. La clé ne doit jamais entrer dans le dépôt.
4. Mettre en place un workflow de publication sécurisé **après** la preuve de signature stable ; conserver le checksum calculé depuis le fichier APK final.
5. Déployer l'API réellement sur le VPS, vérifier la découverte, puis tester **sur deux versions successives du même téléphone Android** avec sauvegarde des données utilisateur.

Secrets de signature prévus : `KNOWME_ANDROID_KEYSTORE_BASE64`, `KNOWME_ANDROID_KEYSTORE_PASSWORD`, `KNOWME_ANDROID_KEY_ALIAS` et `KNOWME_ANDROID_KEY_PASSWORD`. Le script `scripts/configure-knowme-android-signing.mjs` prévoit une configuration hors dépôt des propriétés de signature Gradle.

## Limites connues

- Pas de notifications push quand l'application est totalement fermée. Cela demanderait FCM/Expo Notifications, la permission correspondante et l'enregistrement de l'appareil.
- Pas d'OTA JS/Expo Updates déployé : ce flux requiert une distribution adaptée à Expo SDK 53, avec `runtimeVersion` et l'infrastructure de livraison des bundles.
- Chaque mise à jour qui touche du code natif nécessite toujours un nouvel APK et l'approbation d'installation Android.
- Pour éviter les régressions, ne pas substituer les anciens fichiers d'APK par les nouvelles versions portant une signature différente.

## Tests requis pour validation finale

- CI API et mobile ;
- prébuild Expo avec le player vidéo et l'installateur ;
- compilation APK release ;
- vérification du SHA-256 et du manifeste ;
- tests réel appareil : upgrade de même signature, refus d'autorisation, paquet invalide, mauvais hash, téléchargement interrompu, internet absent, stockage saturé, conservation de compte.
