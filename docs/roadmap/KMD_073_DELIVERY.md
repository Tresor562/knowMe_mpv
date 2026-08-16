# KMD-073 — Éditeur Mobile de brouillons synchronisés

## Objectif

Rendre KMD-068 utilisable depuis Expo/React Native en conservant le versionnement autoritaire et en refusant les écrasements silencieux entre appareils.

## Livrables

- composant `ConversationDraftExperience` ciblé par `conversationId` ;
- chargement du brouillon autorisé actuel ;
- édition bornée à 8 000 caractères ;
- synchronisation avec `expectedVersion` ;
- affichage de la version locale confirmée par le serveur ;
- état explicite de conflit avec action de rechargement ;
- suppression du brouillon ;
- callback optionnel de contenu pour l'intégration future au compositeur de message.

## Frontières permanentes

- KMD-073 n'envoie jamais de message automatiquement ;
- aucun brouillon n'est partagé avec les autres membres de la conversation ;
- un conflit serveur n'est jamais résolu par un écrasement forcé ;
- aucune version n'est inventée par le client ;
- aucun stockage local persistant n'est ajouté ;
- aucune logique Nexus ou permission supplémentaire n'est introduite.

## Migration

Aucune migration de base de données. Le composant consomme KMD-068 déjà fusionné.

## Retour arrière

Le composant peut être retiré sans modifier les brouillons serveur ni les conversations.

## Validation requise

Compilation TypeScript stricte Mobile, build monorepo, tests unitaires et E2E PostgreSQL doivent être verts avant fusion.
