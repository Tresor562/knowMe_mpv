# KMD-076 — Réactions autoritaires aux messages

## Objectif

Permettre aux membres d'une conversation de réagir à un message humain avec un ensemble standard borné, sans exposer les identités des autres réacteurs dans l'agrégat et sans faire confiance au client pour la visibilité.

## Livrables

- modèle `MessageReaction` privé par couple utilisateur-message ;
- une réaction active par utilisateur et message, remplaçable idempotemment ;
- catalogue standard `❤️ 😂 😮 😢 😡 👍 🔥 🎉` ;
- `GET /message-reactions/:messageId` ;
- `PUT /message-reactions/:messageId` ;
- `DELETE /message-reactions/:messageId` ;
- revalidation de l'appartenance à la conversation avant lecture ou écriture ;
- agrégats par emoji avec `myReaction`, sans liste publique des identités ;
- événement temps réel `message:reactions` contenant uniquement les agrégats ;
- suppression en cascade avec le compte ou le message ;
- E2E PostgreSQL couvrant isolation, agrégation, remplacement, validation et retrait.

## Frontières permanentes

- un utilisateur extérieur à la conversation ne peut ni voir ni modifier les réactions ;
- le client ne peut pas introduire un emoji hors catalogue standard ;
- une réaction ne modifie ni le message, ni un rôle, ni un entitlement, ni des KnowCoins ;
- les événements temps réel ne révèlent pas la liste des réacteurs ;
- KMD-076 cible les messages humains persistés et ne modifie pas Nexus Social.

## Migration

Création de `MessageReaction` avec clé primaire `(userId, messageId)`, index d'agrégation et clés étrangères `ON DELETE CASCADE` vers `User` et `Message`.

## Retour arrière

Le module peut être désactivé puis la table supprimée sans modifier les messages sources.

## Validation requise

Prisma generate/push, build monorepo, tests unitaires et E2E PostgreSQL doivent être verts avant fusion.
