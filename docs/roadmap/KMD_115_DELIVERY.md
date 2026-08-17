# KMD-115 — Regroupement Web des messages enregistrés par auteur

## Objectif

Regrouper localement les messages KMD-066 déjà autorisés par auteur afin d'améliorer la navigation sans créer de profil comportemental ni nouvelle source de vérité.

## Livrables

- route authentifiée `/saved-messages/authors` ;
- chargement borné de la bibliothèque autoritaire ;
- regroupement local par `sender.id` ;
- tri par nombre de messages puis nom affiché ;
- accès aux messages sources.

## Frontières permanentes

- aucun nouveau profil d'auteur n'est persisté ;
- aucune donnée hors de la bibliothèque KMD-066 n'est utilisée ;
- aucun classement public n'est produit ;
- aucune logique Premium, Nexus ou KnowCoins n'est ajoutée.

## Migration

Aucune migration de base de données.

## Retour arrière

La route peut être retirée sans modifier KMD-066 ni les messages enregistrés.

## Validation requise

Build Next.js, build monorepo, tests unitaires et E2E PostgreSQL doivent être verts avant fusion.
