# KMD-093 — Épinglage privé et autoritaire des conversations

## Phase produit

Phase 1 — Alpha fiable, organisation personnelle des conversations.

## Périmètre

- registre personnel `ConversationPin` sans duplication du contenu de conversation ;
- maximum de cinq conversations épinglées par utilisateur ;
- lecture, épinglage idempotent et désépinglage authentifiés ;
- validation de l’adhésion actuelle avant toute création ;
- nettoyage des épingles devenues inaccessibles lors de la lecture ;
- sérialisation par utilisateur lors de la création pour faire respecter la limite sous concurrence ;
- suppression en cascade lors de la suppression d’un compte ou d’une conversation.

## Frontières permanentes

Une épingle n’est jamais une autorisation. Elle ne modifie ni membres, rôles, notifications, archives, dossiers, Premium, KnowCoins, Nexus ou KMD-059. Une conversation devenue inaccessible disparaît des résultats et sa référence personnelle est supprimée.

## Validation

Avant fusion :

1. Prisma generate et application du schéma PostgreSQL ;
2. build monorepo complet ;
3. suite unitaire complète, dont les limites KMD-093 ;
4. suite E2E PostgreSQL complète ;
5. absence de régression sur KMD-066/KMD-068/KMD-077/KMD-086 ;
6. `git diff --check` propre.

## Migration et rollback

La migration crée uniquement `ConversationPin` avec clés étrangères en cascade vers `User` et `Conversation`.

Rollback contrôlé : désactiver les clients consommateurs, supprimer les références `ConversationPin`, puis supprimer la table et ses index/contraintes. Aucune donnée source de conversation n’est modifiée par ce rollback.
