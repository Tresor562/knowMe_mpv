# KnowMe Android — mises à jour depuis l'application (candidate 1.1.2)

## Parcours pour l'utilisateur

Une APK contenant `KnowMeApkInstaller` vérifie l'API publique
`GET /mobile-updates/android` au lancement, au retour dans l'application,
et toutes les quinze minutes **pendant son utilisation**.

- Si le serveur annonce une `versionCode` plus élevée et un manifeste valide,
  un panneau KnowMe propose **Mettre à jour** et **Plus tard**.
- Dans **Profil → Paramètres du profil → Contrôles → Vérifier les mises à jour**,
  une vérification immédiate reste possible après un refus provisoire.
- Un clic télécharge le nouvel APK en cache privé avec progression. Le module natif
  vérifie le SHA-256, le package `com.knowme.app` et la `versionCode`.
- L'installateur officiel Android confirme l'installation. KnowMe **ne peut pas**
  contourner l'autorisation de l'utilisateur et **n'installe pas en silence**.
- La mise à jour conserve l'application et ses données **uniquement si** le système
  accepte la signature et installe bien la nouvelle APK par-dessus l'ancienne.

## Préparation de la distribution signée

Le workflow `.github/workflows/publish-knowme-android-update.yml` est volontairement
manuel et limité à `main`. Son environnement GitHub est `android-updates`.

Configurer dans GitHub Actions (secrets du dépôt ou de cet environnement) :

- `KNOWME_ANDROID_KEYSTORE_BASE64`
- `KNOWME_ANDROID_KEYSTORE_PASSWORD`
- `KNOWME_ANDROID_KEY_ALIAS`
- `KNOWME_ANDROID_KEY_PASSWORD`

**La même clé privée de signature doit servir pour toutes les versions** ;
le dépôt ne doit contenir ni la clé ni les mots de passe. La clé existante,
qui a signé l'APK actuellement installée, est nécessaire à sa mise à jour sans
désinstallation. Une clé nouvellement créée n'est **pas** compatible avec une
APK antérieure signée différemment.

Le workflow refuse de publier si la parité Web/Android de la release n'est pas
satisfaite, si la compilation échoue ou si la signature n'est pas configurée.
Il construit l'APK depuis le code validé, vérifie signature, identité du package,
`versionCode` et SHA-256, puis crée une GitHub Release publique avec
`KnowMe-1.1.2.apk`, `KnowMe-1.1.2.apk.sha256` et `knowme-update.json`.
Une release de même version ne peut pas être remplacée.

## Activation côté serveur

L'API `MobileUpdatesController` vérifie les GitHub Releases publiques et ne
publie que les manifestes complets. Elle nécessite d'être réellement déployée
sur le VPS utilisé par les APK. Une configuration serveur incomplète peut
désactiver la découverte, même si une release publique existe.

La preuve de fonctionnement exige un test en conditions réelles :
1. APK initiale contenant le module de mise à jour, signée avec la clé stable.
2. Publication d'une APK de `versionCode` supérieur, avec **la même clé**.
3. Présentation de l'offre dans l'ancienne APK, téléchargement, confirmation
   Android, réouverture et vérification que les données restent présentes.
4. Tester aussi l'absence d'Internet, un hash erroné, un APK incompatible
   et le refus d'installation depuis cette source.

### Première installation et limites

Il est **impossible d'ajouter rétroactivement du code natif** à une APK
déjà installée. Si celle du téléphone n'a pas le module, il faut installer
une première fois la version compatible. Si ses signatures ne correspondent
pas, Android ne permettra pas de la remplacer tout en gardant les données.
Ne pas inviter à désinstaller sans sauvegarder les données locales.

Aucune notification push n'est envoyée quand l'application est totalement
fermée. Les nouvelles versions sont détectées à l'ouverture de KnowMe.

Statut : **implémentation dans le dépôt**, pas preuve de release signée, de
déploiement API ou d'installation validée sur un téléphone.
