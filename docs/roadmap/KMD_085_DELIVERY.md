# KMD-085 — Gestion Mobile des dossiers de conversations

## Objectif

Rendre KMD-077 utilisable depuis Expo/React Native sans dupliquer les règles d'autorisation et sans imposer un routeur au composant.

## Livrables

- composant `ConversationFoldersExperience` ;
- création de dossiers privés ;
- liste des dossiers et affectations revalidées ;
- affectation d'une conversation non classée ;
- déplacement via le contrat d'upsert KMD-077 ;
- retrait d'une conversation ;
- suppression d'un dossier ;
- callback facultatif d'ouverture de conversation ;
- états d'erreur et verrouillage des mutations.

## Frontières permanentes

- aucune appartenance ou permission de conversation n'est modifiée par le client ;
- aucune conversation inaccessible n'est reconstruite localement ;
- le classement reste privé à l'utilisateur ;
- le composant n'impose aucune navigation ;
- aucun comportement Premium ou Nexus spécifique n'est ajouté.

## Migration

Aucune migration de base de données.

## Retour arrière

Le composant peut être supprimé sans modifier les dossiers serveur ni les conversations.

## Validation requise

Compilation TypeScript stricte Mobile, build monorepo, tests unitaires et E2E PostgreSQL doivent être verts avant fusion.
