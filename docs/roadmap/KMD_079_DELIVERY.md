# KMD-079 — Contrôle Mobile d'édition autoritaire

## Objectif

Fournir au client Mobile un composant strict pour modifier un message texte via KMD-075, avec le jeton de concurrence serveur et sans écrasement forcé.

## Livrables

- composant `MessageEditControl` Expo/React Native ;
- contenu limité à 4 000 caractères ;
- envoi de `expectedEditedAt` confirmé par le serveur ;
- nouvelle version locale acceptée uniquement depuis la réponse autoritaire ;
- conflit explicite bloquant les écritures suivantes ;
- callbacks facultatifs de mise à jour et d'annulation.

## Frontières permanentes

- aucun timestamp final n'est fabriqué par le client ;
- aucun conflit n'est résolu par écrasement ;
- aucune logique de modération locale ne remplace KMD-075 ;
- le composant ne déverrouille pas l'édition des stickers ou réponses Nexus ;
- aucun historique d'édition local persistant n'est créé.

## Migration

Aucune migration de base de données.

## Retour arrière

Le composant peut être retiré sans modifier le contrat KMD-075 ni les messages existants.

## Validation requise

Compilation TypeScript stricte Mobile, build monorepo, tests unitaires et E2E PostgreSQL doivent être verts avant fusion.
