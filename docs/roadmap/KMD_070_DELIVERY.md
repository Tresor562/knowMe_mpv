# KMD-070 — Filtres Web de la recherche universelle

## Objectif

Exposer dans le client Web le contrat KMD-067 sans permettre au navigateur d'altérer la sémantique des curseurs ou d'élargir les résultats autorisés.

## Livrables

- boutons de filtre Messages, Publications, Défis et Conversations ;
- au moins un type toujours sélectionné ;
- envoi du jeu canonique via `kinds` ;
- affichage du jeu de types confirmé par le serveur ;
- réinitialisation des résultats et du curseur dès qu'un filtre change ;
- pagination utilisant exclusivement le jeu de types qui a produit le curseur courant.

## Frontières permanentes

- le client ne fabrique aucun type hors contrat KMD-067 ;
- changer un filtre invalide localement toute pagination précédente ;
- le serveur reste la source d'autorisation et de normalisation ;
- aucune préférence de filtre n'est persistée par KMD-070 ;
- aucune recherche IA/Nexus n'est ajoutée.

## Migration

Aucune migration de base de données.

## Retour arrière

Le client peut revenir à la recherche tous types de KMD-064 sans modifier le backend KMD-067.

## Validation requise

Build Next.js, build monorepo, tests unitaires et E2E PostgreSQL existants doivent être verts avant fusion.
