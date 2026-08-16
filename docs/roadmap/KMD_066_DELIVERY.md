# KMD-066 — Messages enregistrés autoritaires

## Objectif

Permettre à une personne de conserver des références vers des messages auxquels elle a réellement accès, sans copier le contenu privé dans un second stockage ni transformer un favori en droit d'accès permanent.

## Livrables

- modèle `SavedMessage` minimal composé de `userId`, `messageId` et `savedAt` ;
- clés étrangères avec suppression en cascade pour le compte et le message source ;
- `POST /saved-messages` idempotent ;
- `GET /saved-messages` borné à 100 éléments ;
- `DELETE /saved-messages/:messageId` ;
- vérification serveur de l'appartenance à la conversation au moment de l'enregistrement ;
- nouvelle vérification de visibilité lors de chaque lecture de la liste ;
- aucune copie du texte du message dans `SavedMessage` ;
- E2E PostgreSQL prouvant l'idempotence, l'isolation d'un utilisateur extérieur, la lecture et la suppression.

## Frontières permanentes

- une référence enregistrée n'accorde jamais de droit de lecture ;
- quitter ou perdre l'accès à une conversation rend le message enregistré invisible ;
- le contenu du message reste dans la table et le cycle de vie de messagerie existants ;
- supprimer le message source supprime sa référence enregistrée ;
- supprimer le compte supprime ses références par contrainte de base de données ;
- KMD-066 ne prend pas en charge les réponses Nexus Social, qui restent un type de donnée distinct ;
- aucun rôle, entitlement, KnowCoin ou permission n'est modifié par un enregistrement.

## Migration

La migration crée `SavedMessage`, une clé primaire composite `(userId, messageId)`, les index de lecture et des clés étrangères `ON DELETE CASCADE` vers `User` et `Message`.

## Retour arrière

Le module API peut être retiré avant suppression de la table. La table ne contient que des références utilisateur-message et peut ensuite être supprimée sans modifier les messages sources.

## Validation requise

- Prisma generate et push sur PostgreSQL 16 ;
- build du monorepo ;
- tests unitaires complets ;
- E2E PostgreSQL complet, y compris `saved-messages.e2e-spec.ts` ;
- aucune fusion avant CI entièrement verte.
