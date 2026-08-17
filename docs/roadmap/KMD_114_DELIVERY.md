# KMD-114 — Recherche Mobile locale dans les dossiers de conversations

## Objectif

Permettre de retrouver rapidement un dossier personnel KMD-077 par son nom ou par le nom d'une conversation qu'il contient sur Mobile, sans envoyer le terme de recherche au serveur.

## Livrables

- composant `ConversationFolderSearchExperience` ;
- chargement des dossiers personnels autoritaires et conversations encore accessibles ;
- filtre local temporaire sur le nom du dossier et les libellés des conversations ;
- compteur de résultats ;
- callback facultatif d'ouverture d'une conversation déjà autorisée.

## Frontières permanentes

- le terme de recherche n'est jamais envoyé à l'API ;
- aucun historique de recherche n'est persisté ;
- aucune affectation de dossier n'est modifiée ;
- aucune conversation inaccessible n'est reconstruite ;
- aucune navigation, logique Premium ou Nexus n'est imposée.

## Migration

Aucune migration de base de données.

## Retour arrière

Le composant peut être retiré sans modifier KMD-077 ni les conversations.

## Validation requise

Compilation TypeScript stricte Mobile, build monorepo, tests unitaires et E2E PostgreSQL doivent être verts avant fusion.
