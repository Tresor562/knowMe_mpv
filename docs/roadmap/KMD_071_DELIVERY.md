# KMD-071 — Filtres Mobile de la recherche universelle

## Objectif

Exposer sur Expo/React Native le contrat KMD-067 sans réutiliser un curseur sous un autre jeu de filtres et sans déplacer l'autorisation vers le client.

## Livrables

- filtres Messages, Publications, Défis et Conversations ;
- au moins un type toujours sélectionné ;
- envoi de `kinds` au serveur ;
- stockage en mémoire uniquement du jeu de types confirmé par le serveur ;
- réinitialisation des résultats et du curseur lors d'un changement de filtre ;
- pagination avec le jeu exact de types ayant produit le curseur ;
- états d'accessibilité `selected` sur les filtres.

## Frontières permanentes

- le client Mobile n'invente aucune source de recherche ;
- le serveur KMD-062/KMD-067 reste la source de visibilité et de normalisation ;
- aucun filtre ou historique n'est persisté par KMD-071 ;
- aucune recherche sémantique ou Nexus n'est introduite ;
- aucune navigation arbitraire n'est exécutée par ce composant.

## Migration

Aucune migration de base de données.

## Retour arrière

Le composant peut revenir au comportement tous-types de KMD-065 sans modifier le backend.

## Validation requise

Compilation TypeScript stricte Mobile, build monorepo, tests unitaires et E2E PostgreSQL doivent être verts avant fusion.
