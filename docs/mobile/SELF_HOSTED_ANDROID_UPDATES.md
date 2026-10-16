# KnowMe — mises à jour Android hébergées sur le VPS (sans Firebase)

## Objectif et limites

Le téléphone reçoit les métadonnées depuis l'API KnowMe sur le VPS, télécharge
l'APK depuis ce même VPS, vérifie SHA-256, package et numéro de version, puis
ouvre l'installateur Android officiel après accord de l'utilisateur.
Aucun jeton Firebase/FCM, service push tiers, Vercel ni GitHub Releases n'est
consulté par les APK produites avec ce mécanisme.

Notifications : lorsque KnowMe est ouvert, Socket.IO signale les nouvelles
versions aux comptes connectés. Quand l'application est fermée, WorkManager
vérifie périodiquement (15 min au minimum ; Android peut différer l'exécution)
et peut afficher une notification. Une application arrêtée de force ne peut
pas garantir une notification immédiate sans un service système de push.

Les anciennes APK, dont la version 1.1.6, continuent à dépendre de leur
ancien mécanisme de transition jusqu'à ce qu'une version compatible contenant
cette mise à jour soit installée. NE PAS DÉSINSTALLER la version installée.

## Stockage et endpoints

Répertoire hôte : /var/lib/nex/runtime/knowme/updates
Montage Docker en lecture seule : /srv/knowme-updates
Manifeste atomique : android-preview.json

API manifeste : https://31-56-85-53.sslip.io/knowme-api/mobile-updates/android
API APK : https://31-56-85-53.sslip.io/knowme-api/mobile-updates/android/apk/KnowMe-VERSION-preview.apk

Seule l'APK exactement mentionnée dans le manifeste est publiquement servie.
L'identité du certificat attendu pour les préversions est vérifiée par le
publisher du VPS ; le client Android revérifie digest, version et package.

## 1 — Déployer le code API sur le VPS

Vérifier les sauvegardes PostgreSQL. Depuis une copie Git de ce dépôt à jour
sur le VPS, après validation de la CI, exécuter avec le SHA complet :

KNOWME_DEPLOY_SHA=SHA_40_CARACTERES node ops/deploy-knowme-vps.mjs

Le déploiement monte le répertoire de distribution en lecture seule dans
le conteneur et préserve la procédure de retour arrière de l'API.

La modification GitHub ne redéploie pas automatiquement ce VPS. Vérifier
l'endpoint de santé et le manifeste depuis la connexion HTTPS publique.

## 2 — Configurer l'envoi automatique des APK compilées vers le VPS

Installer Node.js 22+ ainsi que les Android SDK build-tools, pour disposer
de apksigner et aapt sur le VPS (vérification indépendante du runner CI).
Le compte SSH de publication doit pouvoir écrire dans le répertoire hôte
/var/lib/nex/runtime/knowme/updates, qui reste monté en lecture seule côté
API. Préférer un compte de publication dédié et accès limité.

Dans les GitHub Actions Secrets (NE JAMAIS les envoyer dans le chat) :

- KNOWME_VPS_HOST : l'hôte SSH vérifié du VPS.
- KNOWME_VPS_SSH_USER : compte autorisé à publier les APK.
- KNOWME_VPS_SSH_PRIVATE_KEY : clé privée dédiée.
- KNOWME_VPS_HOST_KEY : ligne known_hosts obtenue et validée hors bande.

Le workflow .github/workflows/knowme-vps-android-update.yml attend la
réussite des tests et de la compilation sur le même commit, vérifie la
signature historique des préversions, puis transmet l'APK sur le VPS par SSH.
Il ne fait rien si un des quatre secrets est absent. Le VPS doit lui-même
posséder apksigner et aapt dans le PATH du compte SSH (ou via
KNOWME_APKSIGNER_PATH et KNOWME_AAPT_PATH).

La publication manuelle reste possible sans CI externe :

node ops/publish-knowme-android-vps.mjs /tmp/KnowMe-1.1.8-preview.apk 1.1.8 10

Ce script refuse les signatures incorrectes, les versions régressives,
les collisions de versionCode et les APK dont l'identité ne correspond
pas. Il vérifie l'empreinte et remplace le manifeste atomiquement.

## 3 — Vérifications après mise en service

1. L'API doit répondre avec l'URL du VPS et un versionCode croissant.
2. Le téléchargement de l'APK depuis le VPS doit donner un fichier de la
   taille et du SHA-256 annoncés.
3. Sur un appareil Android réel, vérifier notification, autorisations,
   téléchargement, installation et conservation des données.
4. Vérifier le retour arrière côté serveur après erreur de déploiement.

Le site Web KnowMe demeure actuellement sur Vercel ; cette procédure rend
autonome le canal de distribution Android, pas nécessairement l'ensemble
des services Web ou du DNS. Ne jamais déclarer le canal « opérationnel »
sans preuve de déploiement effectif du VPS.
