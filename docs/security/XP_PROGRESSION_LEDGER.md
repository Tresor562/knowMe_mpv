# KMD-017 — Registre XP et niveaux autoritaires

## Objectif

La progression KnowMe doit récompenser une participation saine sans devenir une monnaie, un score modifiable par le client ou une source de farming illimité.

## Source de vérité

`XpLedgerEntry` est le registre immuable des gains XP.

Chaque écriture contient :

- l’utilisateur concerné ;
- un montant strictement décidé par le serveur ;
- une source métier ;
- une raison lisible ;
- une clé d’idempotence unique ;
- une référence vers l’événement métier ;
- des métadonnées d’audit non décisionnelles.

Aucun endpoint public ne permet de créer, modifier ou supprimer une écriture XP.

## Projection

`UserProgression` stocke uniquement une projection rapide :

- XP total ;
- niveau courant ;
- dates de création et mise à jour.

Cette projection est recalculée depuis la somme du registre lors des lectures et après chaque nouvelle écriture. Elle peut donc être reconstruite si elle devient incohérente.

## Formule des niveaux

Le niveau `n` commence à :

```text
100 × (n − 1)² XP
```

Exemples :

- niveau 1 : 0 XP ;
- niveau 2 : 100 XP ;
- niveau 3 : 400 XP ;
- niveau 4 : 900 XP.

Cette courbe est déterministe, visible et ne dépend d’aucun tirage aléatoire.

## Première source XP

Une première complétion de défi attribue 50 XP lorsque :

- le participant n’est pas le créateur ;
- la version jouée contient au moins trois questions ;
- la participation n’a jamais déjà produit d’écriture XP.

La clé d’idempotence est dérivée de l’identifiant de participation :

```text
xp:challenge-completion:<participantId>
```

Deux requêtes concurrentes ne peuvent donc produire qu’une seule écriture.

## Concurrence

Les créations d’écriture et reconstructions de projection utilisent des transactions PostgreSQL sérialisables.

Les conflits Prisma `P2034` sont réessayés de manière bornée. Les conflits uniques `P2002` déclenchent une relecture de l’écriture existante, jamais un second crédit.

## Séparation de KnowCoins

XP et KnowCoins sont volontairement séparés :

- l’XP n’est pas transférable ;
- l’XP n’est pas dépensable ;
- un plafond KnowCoins ne bloque pas l’XP ;
- une écriture XP ne modifie aucun solde financier ;
- un niveau n’accorde pas automatiquement un avantage pay-to-win.

## Vie privée et suppression

L’export de compte v6 inclut :

- la projection de progression ;
- le registre XP complet de l’utilisateur.

La suppression du compte efface explicitement la projection et toutes les écritures XP avant la suppression du compte principal.

## Validation attendue

- génération Prisma ;
- synchronisation PostgreSQL ;
- builds API, Web et Mobile ;
- tests unitaires des seuils et de l’idempotence ;
- E2E sur gain, niveau, concurrence, exclusions, export et suppression ;
- absence d’endpoint public de crédit XP.
