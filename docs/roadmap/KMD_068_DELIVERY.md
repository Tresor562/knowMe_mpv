# KMD-068 — Brouillons de conversation synchronisés

## Objectif

Permettre à une personne de retrouver son brouillon de conversation entre ses clients KnowMe sans envoyer de message, sans partager le brouillon avec les autres membres et sans accepter silencieusement un écrasement concurrent.

## Livrables

- modèle `ConversationDraft` privé par couple utilisateur-conversation ;
- contenu borné à 8 000 caractères ;
- version optimiste autoritaire ;
- `GET /conversation-drafts` borné ;
- `PUT /conversation-drafts/:conversationId` ;
- `DELETE /conversation-drafts/:conversationId` ;
- création avec `expectedVersion: 0` ;
- rejet `CONVERSATION_DRAFT_VERSION_CONFLICT` lorsqu'un client tente d'écraser une version plus récente ;
- vérification d'appartenance avant toute écriture ;
- revalidation des appartenances à la lecture et purge des brouillons devenus inaccessibles ;
- clés étrangères avec suppression en cascade du compte ou de la conversation ;
- E2E PostgreSQL d'isolation, versionnement, conflit et suppression.

## Frontières permanentes

- un brouillon n'est jamais un message et n'émet aucun événement temps réel ;
- le brouillon d'un utilisateur n'est jamais visible aux autres membres de la conversation ;
- le client ne peut pas imposer une nouvelle version ;
- perdre l'accès à une conversation empêche toute nouvelle écriture et retire le brouillon des lectures ;
- aucun contenu Nexus Social n'est créé ou modifié ;
- KMD-068 n'affecte ni les appels, ni les rôles, ni les entitlements, ni les KnowCoins.

## Migration

Création de `ConversationDraft` avec clé primaire composite `(userId, conversationId)`, index de lecture et deux clés étrangères `ON DELETE CASCADE`.

## Retour arrière

Le module peut être retiré puis la table supprimée. Aucun message ou contenu de conversation existant n'est modifié par le rollback.

## Validation requise

Prisma generate/push, build complet, tests unitaires et E2E PostgreSQL doivent tous être verts avant fusion.
