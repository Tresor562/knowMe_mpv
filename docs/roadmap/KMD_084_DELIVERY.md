# KMD-084 — Gestion Web des dossiers de conversations

## Objectif

Rendre KMD-077 utilisable depuis le Web sans déplacer les règles d'accès ou de propriété vers le navigateur.

## Livrables

- route authentifiée `/conversation-folders` ;
- création de dossiers privés ;
- liste des dossiers et conversations encore autorisées ;
- affectation ou déplacement d'une conversation ;
- retrait d'une conversation d'un dossier ;
- suppression d'un dossier sans modifier les conversations ;
- ouverture d'une conversation classée ;
- état vide et erreurs explicites.

## Frontières permanentes

- le client ne modifie jamais les membres ou permissions d'une conversation ;
- toute affectation est revalidée par KMD-077 ;
- le classement d'un membre reste privé ;
- aucune conversation inaccessible n'est reconstruite côté client ;
- aucun comportement Premium ou Nexus distinct n'est ajouté.

## Migration

Aucune migration de base de données.

## Retour arrière

La page peut être retirée sans modifier les dossiers ou conversations serveur.

## Validation requise

Build Next.js, build monorepo, tests unitaires et E2E PostgreSQL doivent être verts avant fusion.
