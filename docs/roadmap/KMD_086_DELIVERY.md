# KMD-086 — Archivage personnel des conversations

## Objectif

Permettre à une personne de masquer temporairement une conversation de ses vues principales sans quitter la conversation, sans modifier les autres membres et sans changer la politique de notification du serveur.

## Livrables

- modèle `ConversationArchive` privé par utilisateur et conversation ;
- `GET /conversation-archives` ;
- `PUT /conversation-archives/:conversationId` idempotent ;
- `DELETE /conversation-archives/:conversationId` pour restaurer ;
- contrôle d'appartenance avant archivage ;
- revalidation lors de la lecture et purge des archives devenues inaccessibles ;
- suppression en cascade du compte ou de la conversation ;
- E2E PostgreSQL couvrant isolation, idempotence, liste et restauration.

## Frontières permanentes

- archiver ne quitte jamais la conversation ;
- archiver ne modifie aucun autre membre ;
- KMD-086 ne coupe pas les notifications et ne prétend pas être un mode silencieux ;
- l'état archivé reste strictement personnel ;
- aucune archive Premium ou Nexus distincte n'est introduite.

## Migration

Création de `ConversationArchive` avec clé primaire `(userId, conversationId)`, index de lecture et clés étrangères `ON DELETE CASCADE`.

## Retour arrière

Le module peut être retiré puis la table supprimée sans modifier les conversations ou messages sources.

## Validation requise

Prisma generate/push, build monorepo, tests unitaires et E2E PostgreSQL doivent être verts avant fusion.
