# KMD-119 — Détail Web d'organisation d'une conversation

## Objectif

Réunir en lecture seule, pour une conversation accessible, son dossier personnel KMD-077, son état d'archive KMD-086, son brouillon KMD-068 et le nombre de messages enregistrés KMD-066.

## Livrables

- route authentifiée `/messages/:id/organization` ;
- libellé de conversation calculé depuis les conversations accessibles ;
- dossier personnel courant ;
- état actif/archivé et date d'archivage ;
- présence, version et aperçu borné du brouillon ;
- nombre de messages enregistrés encore accessibles dans la conversation ;
- liens vers les surfaces de gestion existantes.

## Frontières permanentes

- la page est strictement en lecture seule ;
- aucune nouvelle source de vérité n'est créée ;
- aucun droit d'accès n'est déduit de ces indicateurs ;
- aucune conversation inaccessible n'est reconstruite ;
- aucune logique Premium, Nexus ou KnowCoins n'est ajoutée.

## Migration

Aucune migration de base de données.

## Retour arrière

La route peut être retirée sans modifier les dossiers, archives, brouillons, messages enregistrés ou conversations.

## Validation requise

Build Next.js, build monorepo, tests unitaires et E2E PostgreSQL doivent être verts avant fusion.
