# Gouvernance des téléchargements et du cache média

## Objectif

KMD-050 ajoute des règles utilisateur pour les copies locales de médias sans modifier le pipeline privé KMD-014. Le serveur conserve les fichiers chiffrés, contrôle l’accès et émet des jetons courts. Les clients décident ensuite, selon une politique synchronisée, si une copie temporaire peut être créée sur l’appareil.

## Frontières de confiance

- les aperçus et téléchargements passent toujours par les contrôles d’accès serveur ;
- un jeton de téléchargement expire après cinq minutes et reste lié au compte et au média ;
- aucune URL signée, aucun jeton et aucun inventaire de fichiers locaux ne sont persistés dans la préférence serveur ou l’export de compte ;
- le nom de fichier ne détermine jamais le type : la politique utilise le MIME validé ;
- le service worker général ne met jamais en cache les routes API, médias privés, requêtes authentifiées ou réponses `no-store`.

## Politique partagée

`@knowme/media-cache-contract` définit :

- les types `IMAGE`, `VIDEO`, `AUDIO`, `FILE` ;
- les réseaux `WIFI`, `CELLULAR`, `ROAMING`, `OFFLINE`, `UNKNOWN` ;
- les valeurs par défaut ;
- la normalisation des listes ;
- la limite locale de 64 à 4096 Mo ;
- les décisions liées à l’économie de données, à l’arrière-plan et au quota.

Valeurs par défaut : tous les types en Wi-Fi, images uniquement en données mobiles, rien en itinérance, arrière-plan désactivé, économie de données respectée et quota de 512 Mo.

## Synchronisation serveur

`UserMediaDownloadPreference` contient uniquement la politique et sa version. Une mise à jour fournit `expectedVersion`. La transaction sérialisable refuse tout écrasement silencieux et renvoie `MEDIA_DOWNLOAD_VERSION_CONFLICT` avec la version courante.

Le choix explicite est audité. Une préférence seulement lue avec les valeurs par défaut ne crée aucune ligne.

## Cache Web

Le cache privé Web utilise une Cache API dédiée `knowme-private-media-v1` et des clés synthétiques basées sur l’identifiant du média. L’URL signée n’est jamais utilisée comme clé ni stockée dans les métadonnées.

Les réponses enregistrent uniquement identifiant, MIME, taille, date de création et dernier accès. Les lectures produisent une URL objet révocable. La purge est explicite et l’éviction supprime d’abord les éléments les moins récemment utilisés.

## Cache Mobile

Le cache Mobile utilise le répertoire temporaire `expo-file-system`, qui peut être nettoyé par le système sous pression de stockage. Un index AsyncStorage contient uniquement les métadonnées locales et les URI internes au bac à sable de l’application.

`@react-native-community/netinfo` fournit la classe réseau et l’indicateur de connexion coûteuse lorsqu’ils sont disponibles. Une plateforme qui ne peut pas déterminer le réseau retombe sur `UNKNOWN`, donc sur un aperçu sans téléchargement automatique.

## Cycle de vie

Une préférence persistée apparaît dans l’export version 11 sous `mediaDownloadPolicy`. L’export déclare explicitement que l’inventaire local et les URL signées sont absents.

La suppression du compte efface la préférence dans la transaction de compte. Les copies locales restent sous le contrôle du client et doivent être purgées lors de la déconnexion/suppression locale ; aucune copie ne peut ensuite être renouvelée car les sessions et droits serveur sont révoqués.

## Règles d’intégration

Tout écran qui souhaite créer une copie locale doit :

1. obtenir la préférence synchronisée ;
2. fournir le MIME validé et la taille attendue ;
3. demander une décision au contrat partagé ;
4. obtenir un jeton court seulement si la décision autorise le téléchargement ;
5. stocker le corps sous une clé locale synthétique ;
6. mettre à jour l’inventaire et appliquer le quota ;
7. proposer suppression individuelle et purge complète.

Aucun composant ne doit appeler directement une URL média puis la placer dans le cache général du navigateur ou dans un stockage permanent non gouverné.
