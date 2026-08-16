# KMD-080 — Contrôle Web des réactions aux messages

## Objectif

Rendre KMD-076 utilisable depuis le Web en affichant uniquement les agrégats autoritaires et la réaction personnelle du membre.

## Livrables

- composant `MessageReactionControl` ;
- catalogue visuel identique au catalogue serveur standard ;
- chargement de l'agrégat autorisé ;
- ajout ou remplacement de la réaction personnelle ;
- retrait en recliquant sur la réaction active ;
- compte agrégé par emoji ;
- état d'erreur et verrouillage pendant une mutation.

## Frontières permanentes

- aucune identité de réacteur n'est demandée ou affichée ;
- le client n'ajoute aucun emoji hors catalogue KMD-076 ;
- le serveur revalide toujours l'accès au message ;
- aucune réaction n'altère le message ni un droit d'accès ;
- aucun cache persistant des réactions n'est créé par KMD-080.

## Migration

Aucune migration de base de données.

## Retour arrière

Le composant peut être retiré sans modifier KMD-076 ni les réactions existantes.

## Validation requise

Build Next.js, build monorepo, tests unitaires et E2E PostgreSQL doivent être verts avant fusion.
