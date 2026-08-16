# KMD-067 — Filtres de type pour la recherche universelle

## Objectif

Permettre aux clients KnowMe de limiter explicitement une recherche aux types déjà autorisés sans affaiblir les frontières de KMD-062 ni rendre les curseurs KMD-063 réutilisables sous un autre filtre.

## Livrables

- paramètre optionnel `kinds` sur `GET /search` ;
- valeurs canoniques `MESSAGE`, `POST`, `CHALLENGE`, `CONVERSATION` ;
- normalisation des doublons, de la casse et de l'ordre ;
- rejet fermé de tout type inconnu ou filtre explicitement vide ;
- réponse exposant l'ensemble canonique réellement appliqué ;
- curseur opaque version 2 lié à la requête normalisée et à l'ensemble de types ;
- rejet d'un curseur rejoué sous une autre requête ou un autre filtre ;
- tests unitaires et E2E PostgreSQL.

## Frontières permanentes

- un filtre réduit un ensemble de résultats ; il ne peut jamais élargir une autorisation ;
- aucune nouvelle source n'est introduite par KMD-067 ;
- les politiques KMD-062 restent appliquées avant le rendu ;
- les curseurs restent opaques pour les clients ;
- aucune recherche Nexus ou sémantique n'est ajoutée.

## Migration

Aucune migration de base de données.

## Retour arrière

Le paramètre `kinds` et la version 2 du curseur peuvent être retirés avec le code KMD-067. Aucun état persistant n'est créé. Les clients doivent toujours traiter les curseurs comme éphémères et opaques.

## Validation requise

Prisma, build monorepo, tests unitaires et E2E PostgreSQL doivent tous être verts avant fusion.
