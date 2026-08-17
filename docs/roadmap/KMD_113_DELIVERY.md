# KMD-113 — Recherche Web locale dans les dossiers de conversations

## Objectif

Permettre de retrouver rapidement un dossier personnel KMD-077 par son nom ou par le libellé d'une conversation qu'il contient sur Web, sans envoyer le terme de recherche au serveur.

## Livrables

- page Web `conversation-folder-search` ;
- chargement des dossiers personnels autoritaires et des conversations encore accessibles ;
- filtre local temporaire sur le nom du dossier et les libellés des conversations ;
- compteur de résultats ;
- accès aux conversations déjà autorisées seulement.

## Frontières permanentes

- le terme de recherche n'est jamais envoyé à l'API ;
- aucun historique de recherche n'est persisté ;
- aucune affectation de dossier n'est modifiée ;
- aucune conversation inaccessible n'est reconstruite ;
- aucune logique Premium, Nexus, permission, appareil ou KMD-059 n'est introduite.

## Migration

Aucune migration de base de données.

## Validation requise

La fusion exige la CI standard complètement verte : génération Prisma/schema push, build monorepo incluant le build Next.js, suite unitaire complète et E2E API PostgreSQL, sans review ou blocage sécurité non résolu.

## Retour arrière

Revert des fichiers KMD-113. Aucun rollback de schéma ou de données n'est nécessaire ; KMD-077 reste inchangé.
