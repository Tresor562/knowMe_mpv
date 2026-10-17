# KnowMe — déploiement continu vérifié sur le VPS

Le Web public et l'API sont servis sur le VPS :

- Web : `https://knowme.31-56-85-53.sslip.io`
- API : `https://31-56-85-53.sslip.io/knowme-api`
- Distribution Android : `/mobile-updates/android` depuis l'API.

Le miroir Android existant surveille les releases signées et vérifie SHA-256,
package, version et certificat Android. Les APK installées interrogent
ce manifeste avec WorkManager (notification non instantanée, sous réserve
de permission Android), puis demandent l'autorisation d'installation.

## Pipeline sans quota Vercel

1. Une modification GitHub déclenche la CI et le build Android. Le build Gradle actif
   n'est pas annulé si d'autres commits arrivent.
2. La publication produit une GitHub Release immuable uniquement après validation
   du commit, de la CI, de l'APK et de sa signature. Elle est réessayée chaque heure.
3. `knowme-android-updates.timer` copie la nouvelle release validée sur le VPS.
4. `knowme-platform-sync.timer` vérifie toutes les dix minutes le manifeste
   local et le commit de la GitHub Release associée. Il refuse toute release sans
   checks GitHub `quality` et `android-apk` réussis sur le même SHA.
5. Le déploiement API exécute les migrations et valide le serveur avec retour
   arrière du conteneur en cas d'échec. Ensuite le Web est construit en
   conteneur bleu/vert sur un port local isolé. Nginx bascule seulement
   après les réponses HTTP 200 et l'égalité des commits API/Web.
6. Les versions et les commits publics sont recontrôlés après la bascule.

Cette voie VPS fonctionne indépendamment du quota quotidien Vercel.
Le projet Vercel peut rester connecté au dépôt, mais sa limite gratuite
ne bloque plus le site Web autonome sur VPS.

## Installer depuis une copie revue

```bash
sudo bash /opt/nex/apps/public/knowme/source/ops/install-knowme-platform-sync-timer.sh
sudo systemctl start knowme-platform-sync.service
sudo systemctl is-active knowme-platform-sync.timer
sudo systemctl show knowme-platform-sync.service -p Result -p ExecMainStatus
sudo journalctl -u knowme-platform-sync.service -n 30 --no-pager
```

Si le script est installé depuis une nouvelle révision Git, conserver les
scripts du timer cohérents avec cette révision. Le timer exige Docker, Git,
Node.js 22+, les fichiers du dépôt et un accès HTTPS GitHub public. Aucune
clé SSH ou jeton GitHub n'est requis par le VPS.

Les anciennes versions Android ne deviennent pas compatibles si elles
n'intègrent pas le module de mise à jour : installer une fois une APK
qui inclut ce module et qui garde le certificat original.

## Sécurité et limites

Aucun commit simplement poussé sur `main` n'est automatiquement exécuté
sur le VPS avant la publication d'une APK signée, du SHA exact validé
et des checks GitHub réussis. Une panne d'un de ces contrôles interrompt
le déploiement (fail closed), sans notifier une APK incorrecte.

Ne jamais annoncer un déploiement terminé sans constater le SHA publié
sur les deux endpoints et vérifier le manifeste APK par HTTPS. Le
fonctionnement des notifications, permissions et installation Android
doit également être testé sur un téléphone réel pour validation finale.
