# KMD-116 — Regroupement Mobile des messages enregistrés par auteur

## Objectif

Regrouper localement les messages KMD-066 déjà autorisés par auteur sur Mobile afin d'améliorer la navigation sans créer de profil comportemental ni nouvelle source de vérité.

## Livrables

- composant `SavedMessagesByAuthorExperience` ;
- chargement borné de la bibliothèque autoritaire ;
- regroupement local par `sender.id` ;
- tri local par nombre de messages puis nom affiché ;
- callback facultatif vers le message source.

## Frontières permanentes

- aucun nouveau profil d'auteur n'est persisté ;
- aucune donnée hors de KMD-066 n'est utilisée ;
- aucun classement public n'est produit ;
- aucune navigation, logique Premium, Nexus ou KnowCoins n'est imposée.

## Migration

Aucune migration de base de données.

## Retour arrière

Le composant peut être retiré sans modifier KMD-066 ni les messages enregistrés.

## Validation requise

Compilation TypeScript stricte Mobile, build monorepo, tests unitaires et E2E PostgreSQL doivent être verts avant fusion.
