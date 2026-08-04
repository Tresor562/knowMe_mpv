# KnowMe — Game Platform autoritaire

## Objectif

KMD-052 fournit une fondation de jeux déterministes où le serveur possède l’état officiel, valide chaque action et produit un replay vérifiable.

Cette fondation ne contient ni mise, ni pari, ni cash prize, ni achat de puissance, ni récompense économique. Les KnowCoins, paiements, abonnements et achats ne participent pas au résultat d’une partie.

## Frontière d’autorité

Le client peut uniquement demander une action de jeu contenant :

- un type d’action autorisé par l’adaptateur du jeu ;
- une charge utile bornée et validée ;
- la séquence serveur attendue ;
- une clé d’idempotence propre au joueur et à la partie.

Le client ne peut jamais fournir :

- un score ;
- un gagnant ;
- un résultat final ;
- un nouvel état de partie ;
- une graine aléatoire ;
- un solde, une mise ou une récompense.

## Catalogue immuable

Chaque définition de jeu possède une clé, une version, un moteur, des limites de joueurs, des règles, une configuration initiale et un checksum SHA-256.

Une version existante ne peut pas être modifiée silencieusement. Toute évolution fonctionnelle crée une nouvelle version. Le démarrage échoue si le code embarqué tente de remplacer une définition persistée avec un checksum différent.

## Sessions et concurrence

Une session persiste :

- la définition exacte utilisée ;
- une graine serveur ;
- l’état initial et l’état courant ;
- un hash canonique de l’état ;
- une séquence monotone ;
- une version de concurrence optimiste ;
- la position dont c’est le tour ;
- le statut, le résultat et les échéances.

Les actions sont traitées dans une transaction `Serializable`. L’écriture exige la séquence et la version observées. Une action concurrente ou obsolète retourne `GAME_SEQUENCE_CONFLICT` et doit être rejouée après resynchronisation.

## Idempotence

La création est unique par `(ownerId, creationKey)`.

Une action est unique par `(sessionId, actorId, idempotencyKey)`. Le reçu persistant permet de répondre à une répétition réseau sans rejouer le moteur ni créer une seconde action.

## Pulse Duel V1

Le premier adaptateur de référence est `PULSE_DUEL_V1` :

- deux joueurs ;
- cinq manches ;
- chacun choisit un nombre de 1 à 9 ;
- le premier choix reste caché dans l’état public ;
- la cible de manche est dérivée de la graine serveur et du numéro de manche ;
- le serveur attribue le point au choix le plus proche ;
- le serveur calcule seul le score et le résultat final.

Ce jeu sert à valider la plateforme. Les futurs jeux doivent implémenter le même contrat d’adaptateur sans contourner l’autorité serveur.

## Replays

Une partie terminale possède un snapshot contenant la définition, la graine, les états initial/final, le résultat, le nombre d’actions et un checksum.

La graine n’est jamais exposée pendant une partie active ni dans l’export de compte. Elle devient visible aux participants uniquement dans le replay terminal afin de reproduire les cibles et vérifier le résultat.

Les actions du replay sont ordonnées par séquence et incluent les hashes avant/après. Aucun spectateur non participant ne peut lire la partie ou le replay.

## Expiration et exploitation

Le worker `GameSessionMaintenanceService` ferme par lots les invitations et parties arrivées à expiration. Il évite les exécutions concurrentes dans un même processus et les mises à jour conditionnelles rendent la fermeture sûre entre plusieurs instances.

Variables :

- `GAME_PLATFORM_MAINTENANCE_ENABLED` ;
- `GAME_PLATFORM_MAINTENANCE_INTERVAL_MS` ;
- `GAME_PLATFORM_MAINTENANCE_BATCH_SIZE`.

Le tableau administrateur exige `games.manage`. Les annulations administratives sont persistées dans `GameGovernanceEvent` et dans l’audit général.

## Cycle de vie des comptes

L’export inclut les participations, résumés de sessions et actions rédigées par l’utilisateur, mais exclut les graines actives.

Lors d’une suppression :

1. les parties ouvertes reçoivent un résultat terminal reproductible ;
2. les replays sont créés avant l’anonymisation ;
3. les actions et événements nécessaires aux autres joueurs sont anonymisés ;
4. la participation de l’utilisateur est supprimée ;
5. les sessions sans aucun participant restant sont entièrement supprimées.

## Surfaces clientes

Web et Mobile consomment les mêmes endpoints. Ils affichent uniquement l’état public et transmettent des intentions. Ils ne calculent jamais le score, la cible, le gagnant ou une récompense locale.

## Hors périmètre KMD-052

- matchmaking automatique ;
- tournois ;
- spectateurs ;
- chat de partie ;
- classement ELO ;
- jeu d’affinité avancé ;
- récompenses XP ou KnowCoins ;
- monétisation, mises ou objets donnant un avantage.
