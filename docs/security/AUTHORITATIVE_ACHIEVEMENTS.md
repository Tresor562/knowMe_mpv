# KMD-020 — Badges et titres autoritaires

## Objectif

Les badges de mérite et les titres de gamification sont calculés uniquement depuis les événements serveur déjà vérifiés. Aucun navigateur, APK, achat, abonnement ou solde KnowCoins ne peut fabriquer une attribution.

## Séparation des identités

Ce domaine est strictement distinct de :

- la vérification d’identité ;
- Premium ;
- l’appartenance à l’Équipe KnowMe ;
- les rôles et permissions administratives.

Un badge de mérite ne doit jamais utiliser une apparence ou un libellé laissant croire qu’un compte est vérifié, Premium ou officiel.

## Catalogue versionné

Chaque définition possède :

- une clé stable ;
- une version ;
- un type `BADGE` ou `TITLE` ;
- un nom et une description ;
- des critères explicites ;
- un état actif.

Une nouvelle règle crée une nouvelle version plutôt que de réécrire l’historique des attributions existantes.

## Attributions

Une attribution est :

- liée au compte et à la version exacte de la définition ;
- idempotente ;
- créée dans une transaction sérialisable ;
- protégée contre les conflits uniques et les rejeux ;
- accompagnée d’un événement d’audit ;
- conservée même après révocation.

Les premiers mérites sont :

- badge `Premier pas` après une première complétion de défi éligible ;
- titre `Explorateur` sur le même jalon ;
- badge `Curiosité confirmée` au niveau 2 ;
- titre `Esprit curieux` au niveau 2.

Les auto-défis et les défis de moins de trois questions sont ignorés.

## Titres affichés

L’utilisateur peut choisir un titre parmi ses attributions actives. Le serveur vérifie la propriété, le type et l’absence de révocation. Un titre est purement cosmétique et n’accorde aucun droit.

## Révocation

La révocation nécessite la permission administrative de gestion des récompenses. Elle :

- conserve l’attribution originale ;
- enregistre l’acteur, la date et la raison ;
- écrit un audit unique ;
- retire immédiatement le titre s’il était sélectionné ;
- reste idempotente en cas de rejeu.

## Vie privée

Les attributions et la préférence de titre figurent dans l’export de compte v6. Elles sont supprimées avec le compte, tandis que le catalogue global reste conservé.
