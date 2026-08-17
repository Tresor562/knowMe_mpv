# KMD-120 — Détail Mobile d'organisation d'une conversation

## Objectif

Réunir en lecture seule, pour une conversation accessible sur Mobile, son dossier personnel KMD-077, son état d'archive KMD-086, son brouillon KMD-068 et le nombre de messages enregistrés KMD-066.

## Livrables

- composant `ConversationOrganizationDetail` ;
- libellé de conversation calculé depuis les conversations accessibles ;
- dossier personnel courant ;
- état actif/archivé et date d'archivage ;
- présence, version et aperçu borné du brouillon ;
- nombre de messages enregistrés encore accessibles dans la conversation ;
- callback facultatif vers les surfaces de gestion, sans imposer de routeur.

## Frontières permanentes

- le composant est strictement en lecture seule ;
- aucune nouvelle source de vérité n'est créée ;
- aucun droit d'accès n'est déduit de ces indicateurs ;
- aucune conversation inaccessible n'est reconstruite ;
- aucune navigation, logique Premium, Nexus ou KnowCoins n'est imposée.

## Migration

Aucune migration de base de données.

## Retour arrière

Le composant peut être retiré sans modifier les dossiers, archives, brouillons, messages enregistrés ou conversations.

## Validation requise

Compilation TypeScript stricte Mobile, build monorepo, tests unitaires et E2E PostgreSQL doivent être verts avant fusion.
