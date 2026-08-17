# KMD-118 — Timeline Mobile des conversations archivées

## Objectif

Présenter les archives KMD-086 par ancienneté calculée localement sur Mobile afin de faciliter leur lecture sans modifier leur état ni créer une nouvelle source de vérité.

## Livrables

- composant `ConversationArchiveTimelineExperience` ;
- groupes locaux `24 heures`, `7 jours` et `plus ancien` ;
- chargement des archives autoritaires et conversations encore accessibles ;
- compteur par période ;
- callback facultatif d'ouverture d'une conversation archivée.

## Frontières permanentes

- le regroupement ne restaure ni ne modifie aucune archive ;
- aucune donnée de timeline n'est persistée ;
- aucune conversation inaccessible n'est reconstruite ;
- aucune navigation, logique Premium ou Nexus n'est imposée.

## Migration

Aucune migration de base de données.

## Retour arrière

Le composant peut être retiré sans modifier KMD-086 ni les conversations.

## Validation requise

Compilation TypeScript stricte Mobile, build monorepo, tests unitaires et E2E PostgreSQL doivent être verts avant fusion.
