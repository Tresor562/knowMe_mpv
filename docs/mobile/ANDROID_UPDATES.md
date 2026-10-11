# KnowMe — mises à jour Android sans Google Play

## Livré dans cette branche

- APK cible : KnowMe 1.1.0 (`versionCode=2`), package `com.knowme.app`.
- API Nest : `GET /mobile-updates/android` public, sans session ; annonce seulement
  des APK officiels avec une empreinte SHA-256 valide.
- Si aucune version n'est configurée par l'API, découverte automatique des
  `knowme-update.json` publiés sur les **GitHub Releases officiels** de
  `Tresor562/knowMe_mpv` (résultat en cache 15 minutes).
- Contrôle depuis Android au lancement, au retour au premier plan et environ
  toutes les 15 minutes lorsque l'application est ouverte.
- Écran « Mettre à jour » : téléchargement avec progression dans le **cache privé**
  (pas dans Téléchargements), vérification native intégrale du SHA-256,
  du `packageName` et du `versionCode`, puis ouverture de l'installateur Android.
- Permission Android « Installer des applications inconnues » demandée via les
  réglages si nécessaire ; confirmation système obligatoire selon Android.
- Config plugin local pour intégrer le module Java, son `ReactPackage`,
  `FileProvider` et la permission `REQUEST_INSTALL_PACKAGES` à chaque prébuild.
- Workflow de build qui exige une clé de **signature privée stable** et publie
  un APK versionné avec `SHA256` et `knowme-update.json`. Aucune
  publication n'est permise en l'absence de la clé de signature.

## Ce qui n'est PAS encore opérationnel

- Aucun APK signé 1.1.0 n'est livré par ce seul changement de code.
  Vérifier le résultat réel des builds GitHub Actions, approvisionner les
  secrets ci-dessous et déployer l'API avant d'annoncer une disponibilité.
- Aucun mécanisme JavaScript OTA/Expo Updates n'est activé : il reste à relier
  une distribution Expo Update à un vrai projet EAS ou à un serveur
  conforme au protocole Expo Updates, installer la dépendance compatible
  Expo SDK 53, et régénérer proprement le `pnpm-lock.yaml`.
- Pas de notification push lorsque KnowMe est complètement fermé. Cela
  nécessite FCM ou Expo Notifications + consentement + enregistrement du mobile.
- Les anciens APK ne peuvent pas recevoir rétroactivement ce module :
  une **première installation de la nouvelle version** est requise.

## Signature — configuration obligatoire de GitHub Actions

Créer les secrets **Actions** du dépôt sans les committer :

- `KNOWME_ANDROID_KEYSTORE_BASE64` : JKS/PKCS12 de production encodé en base64
- `KNOWME_ANDROID_KEYSTORE_PASSWORD`
- `KNOWME_ANDROID_KEY_ALIAS`
- `KNOWME_ANDROID_KEY_PASSWORD`

La même clé **doit être conservée définitivement** pour toutes les futures
versions du même `com.knowme.app`. Si l'ancien APK est signé avec
une autre clé (notamment la clé debug éphémère d'une CI), Android **ne
permet pas de l'écraser** par le nouveau ; prévoir une migration de données
avant désinstallation et réinstallation. Le système ne contourne pas
les protections Android.

Le build `.github/workflows/knowme-apk-build-once.yml` génère le projet
Android, injecte les composants natifs, applique
`scripts/configure-knowme-android-signing.mjs` puis fabrique
`KnowMe-<version>.apk`. La publication automatique sur GitHub Releases
s'effectue avec `.github/workflows/publish-knowme-android.yml` lorsqu'un
build `main` réussit.

## Configuration optionnelle de l'API

Par défaut l'API recherche les manifestes des Releases publics officiels,
sans configuration d'adresse manuelle (si GitHub est accessible).
Pour désactiver la découverte :

```env
KNOWME_ANDROID_AUTO_DISCOVER_GITHUB=false
```

Pour pointer explicitement vers un APK interne HTTPS déjà publié :

```env
KNOWME_ANDROID_UPDATE_VERSION_CODE=3
KNOWME_ANDROID_UPDATE_VERSION=1.2.0
KNOWME_ANDROID_UPDATE_URL=https://updates.example.com/KnowMe-1.2.0.apk
KNOWME_ANDROID_UPDATE_SHA256=exactement_64_caracteres_hexadecimaux
KNOWME_ANDROID_UPDATE_ALLOWED_HOST=updates.example.com
KNOWME_ANDROID_UPDATE_NOTES=Nouveautés et corrections
KNOWME_ANDROID_UPDATE_REQUIRED=false
```

Les champs incomplets rendent la version indisponible et les clients
n'affichent pas d'installation. Le checksum doit être calculé depuis
l'APK **final signé**, pas depuis le code source ni un APK précédent.

## Tests de sortie indispensables

1. GitHub CI réussit, y compris le prébuild Expo Android et les tests API.
2. Build signé publié depuis une clé permanente, et manifeste accessible.
3. L'API déployée renvoie la bonne version sur `/mobile-updates/android`.
4. Sur Android réel, un APK précédent de **même signature** découvre la version,
   la télécharge, vérifie son empreinte et ouvre l'installateur.
5. Confirmer l'installation via Android puis retrouver les données du compte.
6. Tester absence de réseau, lien erroné, APK altéré, APK d'un autre package,
   downgrade, refus d'autorisation, espace insuffisant et reprise de la session.

## Pour les futures mises à jour d'interface sans APK

Le projet est sur Expo SDK 53 ; utiliser `expo-updates@0.28.18` et
un vrai projet EAS Update ou une implémentation conforme du protocole.
Définir `runtimeVersion` pour chaque version native, séparer `preview`
et `production`, publier les bundles/ressources, puis utiliser
`Updates.checkForUpdateAsync()`, `Updates.fetchUpdateAsync()` et
`Updates.reloadAsync()` au retour au premier plan ou après confirmation.
Aucune mise à jour JS ne peut ajouter un module natif absent du binaire.

Documentation :
- https://docs.expo.dev/eas-update/getting-started/
- https://docs.expo.dev/eas-update/runtime-versions/
- https://developer.android.com/guide/topics/manifest/provider-element
