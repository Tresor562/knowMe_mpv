# KMD-072 — Bibliothèque Mobile des messages enregistrés

## Objectif

Rendre KMD-066 utilisable depuis Expo/React Native sans dupliquer le contenu privé ni imposer un routeur Mobile au composant.

## Livrables

- composant `SavedMessagesExperience` ;
- chargement borné de `GET /saved-messages` ;
- affichage du message, de son auteur et de ses dates ;
- retrait d'une référence enregistrée ;
- callback optionnel `onOpenMessage(conversationId, messageId)` ;
- état vide, chargement, actualisation et erreur.

## Frontières permanentes

- le composant affiche uniquement les messages revalidés par KMD-066 ;
- aucune copie persistante locale du message n'est créée ;
- retirer un enregistrement ne supprime jamais le message source ;
- un message inaccessible n'est jamais reconstruit depuis un cache KMD-072 ;
- le composant n'interprète aucune route Web et n'impose aucune navigation ;
- aucune logique Nexus ou autorisation supplémentaire n'est ajoutée.

## Migration

Aucune migration de base de données.

## Retour arrière

Le composant peut être retiré sans modifier KMD-066 ni les données existantes.

## Validation requise

Compilation TypeScript stricte Mobile, build monorepo, tests unitaires et E2E PostgreSQL doivent être verts avant fusion.
