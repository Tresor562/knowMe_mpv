# KMD-052 — Livraison Game Platform autoritaire

## Résultat

KMD-052 introduit la première fondation de jeux KnowMe dont l’état, les tours, le score et le résultat sont entièrement contrôlés par l’API NestJS.

## Livré

- schéma multi-fichiers Prisma pour définitions, sessions, participants, actions, reçus, replays et gouvernance ;
- catalogue embarqué versionné avec checksum immuable ;
- registre d’adaptateurs de moteurs ;
- moteur déterministe `PULSE_DUEL_V1` ;
- création idempotente et invitations nominatives ;
- activation atomique lorsque tous les joueurs ont rejoint ;
- validation des actions par tour, séquence, version et hash d’état ;
- refus des scores, gagnants, états ou résultats fournis par le client ;
- reçus d’idempotence persistants ;
- état public masquant le premier choix ;
- abandon, annulation, expiration et gouvernance auditée ;
- replays terminaux avec checksum et graine révélée uniquement après fermeture ;
- notifications d’invitation, de tour et de fin ;
- export de compte sans graine active ;
- suppression avec replay terminal préalable et anonymisation ;
- worker de maintenance borné ;
- permission `games.manage` ;
- API utilisateur et administrateur ;
- expérience Web `/games` ;
- expérience Mobile native intégrée au profil ;
- tests unitaires et E2E ;
- documentation d’architecture et configuration d’exploitation.

## Garanties permanentes

- aucune mise et aucune récompense économique ;
- aucun calcul de score ou de gagnant dans Web/Mobile ;
- aucune modification silencieuse d’une version de jeu persistée ;
- aucune action appliquée deux fois ;
- aucune lecture de session ou de replay par un non-participant ;
- aucune graine active dans les vues ou exports ;
- aucun rôle, badge, entitlement ou privilège administratif attribué par un jeu.

## Validation attendue

La livraison ne peut être fusionnée qu’après succès de :

1. génération Prisma ;
2. application du schéma PostgreSQL ;
3. builds API, Web et Mobile ;
4. tests unitaires ;
5. E2E complet, incluant la suppression de compte et le replay terminal.

## Suite réservée

KMD-053 pourra construire un **jeu d’affinité explicable** au-dessus de cette plateforme, sans ajouter de logique de résultat dans les clients et sans récompense économique.
