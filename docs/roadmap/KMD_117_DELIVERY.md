# KMD-117 — Timeline Web des conversations archivées

## Objectif

Présenter les archives KMD-086 par ancienneté calculée localement afin de faciliter leur lecture sans modifier leur état ni créer une nouvelle source de vérité.

## Livrables

- route authentifiée `/conversation-archives/timeline` ;
- groupes locaux `24 heures`, `7 jours` et `plus ancien` ;
- chargement des archives autoritaires et conversations encore accessibles ;
- accès direct aux conversations archivées ;
- compte par période.

## Frontières permanentes

- le regroupement ne restaure ni ne modifie aucune archive ;
- aucune donnée de timeline n'est persistée ;
- aucune conversation inaccessible n'est reconstruite ;
- aucune logique Premium ou Nexus n'est ajoutée.

## Migration

Aucune migration de base de données.

## Retour arrière

La route peut être retirée sans modifier KMD-086 ni les conversations.

## Validation requise

Build Next.js, build monorepo, tests unitaires et E2E PostgreSQL doivent être verts avant fusion.
