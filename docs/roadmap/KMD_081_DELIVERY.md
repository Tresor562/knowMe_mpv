# KMD-081 — Contrôle Mobile des réactions aux messages

## Objectif

Rendre KMD-076 utilisable depuis Expo/React Native en affichant uniquement les agrégats autoritaires et la réaction personnelle du membre.

## Livrables

- composant `MessageReactionControl` Mobile ;
- catalogue identique au catalogue serveur KMD-076 ;
- chargement des agrégats autorisés ;
- ajout/remplacement de la réaction personnelle ;
- retrait en recliquant sur la réaction active ;
- état d'accessibilité `selected` ;
- verrouillage des mutations concurrentes et erreur explicite.

## Frontières permanentes

- aucune identité de réacteur n'est exposée ;
- aucun emoji hors catalogue serveur n'est ajouté ;
- le serveur reste la source de visibilité et d'agrégation ;
- aucune réaction ne modifie le message ou un droit d'accès ;
- aucun cache persistant des réactions n'est créé.

## Migration

Aucune migration de base de données.

## Retour arrière

Le composant peut être retiré sans modifier KMD-076 ni les réactions existantes.

## Validation requise

Compilation TypeScript stricte Mobile, build monorepo, tests unitaires et E2E PostgreSQL doivent être verts avant fusion.
