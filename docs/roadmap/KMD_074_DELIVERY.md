# KMD-074 — Bibliothèque Web des brouillons synchronisés

## Objectif

Permettre de retrouver et nettoyer les brouillons KMD-068 depuis le Web sans les transformer en messages et sans reconstruire des conversations devenues inaccessibles.

## Livrables

- route authentifiée `/drafts` ;
- liste des brouillons encore autorisés renvoyés par KMD-068 ;
- aperçu borné du contenu ;
- affichage de la version et de la date de modification ;
- lien vers la conversation correspondante ;
- suppression explicite du brouillon ;
- état vide ;
- entrée visible depuis le tableau de bord Web.

## Frontières permanentes

- le Web ne crée aucun message à partir d'un brouillon ;
- la liste dépend exclusivement de la revalidation serveur KMD-068 ;
- aucune copie persistante locale n'est ajoutée ;
- le client ne force jamais une version ni un accès à une conversation ;
- aucune logique Nexus ou nouvelle permission n'est introduite.

## Migration

Aucune migration de base de données.

## Retour arrière

La page `/drafts` et son entrée de tableau de bord peuvent être retirées sans modifier les données KMD-068.

## Validation requise

Build Next.js, build monorepo, tests unitaires et E2E PostgreSQL existants doivent être verts avant fusion.
