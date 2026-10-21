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

Répertoire hôte : /var/lib/knowme-android-updates
Montage Docker en lecture seule : /srv/knowme-updates
Manifeste atomique : android-preview.json

API manifeste : https://31-56-85-53.sslip.io/knowme-api/mobile-updates/android
API APK : https://31-56-85-53.sslip.io/knowme-api/mobile-updates/android/apk/KnowMe-VERSION-preview.apk

Seule l'APK exactement mentionnée dans le manifeste est publiquement servie.
L'identité du certificat attendu pour les préversions est vérifiée par le
publisher du VPS ; le client Android revérifie digest, version et package.

## Reprise collective des anciennes APK bloquées

Le correctif natif de progression exige une nouvelle APK : le flux de mise à
jour d'une ancienne installation peut donc rester bloqué sur « Lancement… ».
La solution de transition **ne demande aucune désinstallation** et ne tente
pas d'installer silencieusement une application Android.

Après déploiement de cette route sur l'API VPS, communiquer aux utilisateurs du
**canal preview** l'URL fixe (à ouvrir dans Chrome ou un autre navigateur) :

```text
https://31-56-85-53.sslip.io/knowme-api/mobile-updates/android/download
```

Cette adresse renvoie directement l'APK **actuellement validée et servie par le
VPS**, avec son nom de fichier officiel. Elle ne redirige pas vers une URL
externe ni ne repose sur le bouton de téléchargement défaillant des anciennes
APK. Le serveur vérifie un manifeste local, le certificat preview attendu, le
package prévu par la procédure de publication et la taille de l'APK avant de
l'exposer ; SHA-256 et signature sont validés par le publisher, puis Android
vérifie lui-même la compatibilité de signature lors de l'installation.

1. Ouvrir le lien officiel dans le navigateur, puis le fichier téléchargé.
2. Choisir « Mettre à jour » / « Installer » et confirmer dans Android.
3. **Ne pas désinstaller** KnowMe pour contourner une erreur : cela peut effacer
   les données locales. Une incompatibilité de signature (autre canal d'APK),
   de version installée ou une politique de sécurité Android exige un parcours
   de migration distinct, pas une installation forcée.
4. Tester sur un téléphone avec l'ancienne APK avant une annonce à tous.

Cette voie ne peut pas être injectée automatiquement dans un ancien module natif
cassé. Expo OTA est lui-même désactivé tant que sa chaîne de signature vérifiée
n'est pas configurée ; ne jamais autoriser d'OTA non signée pour forcer la
migration. Si la route VPS n'est pas encore déployée, le lien immuable vers
l'APK de la dernière release GitHub qualifiée reste l'alternative de transition.

## 1 — Déployer le code API sur le VPS

Vérifier les sauvegardes PostgreSQL. Depuis une copie Git de ce dépôt à jour
sur le VPS, après validation de la CI, exécuter avec le SHA complet :

KNOWME_DEPLOY_SHA=SHA_40_CARACTERES node ops/deploy-knowme-vps.mjs

Le déploiement monte le répertoire de distribution en lecture seule dans
le conteneur et préserve la procédure de retour arrière de l'API.

La modification GitHub ne redéploie pas automatiquement ce VPS. Vérifier
l'endpoint de santé et le manifeste depuis la connexion HTTPS publique.

## 2 — Synchronisation automatique sans clés GitHub→VPS

Le workflow GitHub qui réclamait des clés SSH a été retiré. Aucune clé
privée VPS ne doit être enregistrée dans GitHub pour distribuer KnowMe.

**Pré-requis** : Node.js 22+, `apksigner`, `aapt` et une copie à jour de
KnowMe dans `/opt/nex/apps/public/knowme/source`. Ces prérequis
s'installent une fois sur le VPS via un accès administrateur existant.

Installer le minuteur local en tant qu'administrateur **après avoir déployé une
copie officielle et validée du dépôt KnowMe** :

```bash
sudo bash /opt/nex/apps/public/knowme/source/ops/install-knowme-android-pull-timer.sh
sudo systemctl is-active knowme-android-updates.timer
sudo systemctl start knowme-android-updates.service
sudo journalctl -u knowme-android-updates.service -n 25 --no-pager
```

Le script installe lui-même les deux scripts de synchronisation dans
`/opt/nex/ops/knowme-android-updates/ops` en lecture seule pour le compte
de service. Il vérifie Node.js 22+, les outils Android et leur accessibilité
depuis ce compte. **Aucune copie manuelle préalable dans /opt/nex/ops n'est
nécessaire.** Il ne demande aucune clé GitHub ni accès SSH de GitHub au VPS.
L'activation du timer ne dispense pas de redéployer l'API VPS avec le montage
`/var/lib/knowme-android-updates` pour rendre le manifeste accessible.

Le timer `knowme-android-updates.timer` consulte toutes les cinq minutes
les préversions publiques de KnowMe sur GitHub. Il ne télécharge que
l'APK officielle et le manifeste correspondant, vérifie la somme SHA-256,
puis vérifie localement le package Android, le `versionCode` et
la signature via `apksigner` / `aapt`. Le manifeste public
`android-preview.json` n'est remplacé qu'une fois les contrôles réussis.

Le compte de service `knowme-updates` n'a pas de shell ni de droits
administrateur ; seul `/var/lib/knowme-android-updates` lui est accessible
en écriture. GitHub ne peut donc pas se connecter directement au VPS.

Après l'installation, le **site et les APK clientes** ne dépendent plus
de GitHub pour consulter ou télécharger une mise à jour : le VPS sert
l'APK. En revanche, **la synchronisation du code source et des nouvelles
préversions sur le VPS reste liée à GitHub**. Cette architecture n'est
pas une indépendance totale de l'ensemble des fournisseurs externes.

Cette configuration n'est active que lorsque l'agent NexControl / une
session d'administration a réellement installé le timer et déployé
l'API mise à jour avec son montage de distribution. Une modification
GitHub seule ne remplace pas une installation sur le VPS.

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
