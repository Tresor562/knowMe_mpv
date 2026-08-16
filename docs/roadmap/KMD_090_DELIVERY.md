# KMD-090 — Contrôle Mobile d'enregistrement des messages

## Objectif

Permettre au client Mobile d'enregistrer ou retirer un message via KMD-066 sans stocker une copie persistante du contenu et sans contourner la visibilité serveur.

## Livrables

- composant `SaveMessageControl` Expo/React Native ;
- lecture de l'état courant via KMD-066 ;
- ajout idempotent d'un message enregistré ;
- retrait de la référence uniquement ;
- état d'accessibilité `selected` ;
- verrouillage pendant les mutations et erreur explicite.

## Frontières permanentes

- aucune copie persistante locale du contenu ;
- le serveur revalide toujours l'accès au message ;
- retirer l'enregistrement ne supprime jamais le message source ;
- aucune autorisation, logique Nexus, Premium ou KnowCoins n'est ajoutée.

## Migration

Aucune migration de base de données.

## Retour arrière

Le composant peut être supprimé sans modifier les références KMD-066 existantes.

## Validation requise

Compilation TypeScript stricte Mobile, build monorepo, tests unitaires et E2E PostgreSQL doivent être verts avant fusion.
