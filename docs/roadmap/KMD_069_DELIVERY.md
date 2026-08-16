# KMD-069 — Bibliothèque Web des messages enregistrés

## Objectif

Rendre les références KMD-066 consultables et supprimables depuis le client Web sans transformer l'interface en source d'autorité.

## Livrables

- route authentifiée `/saved-messages` ;
- chargement borné via l'API KMD-066 ;
- affichage du message, de son auteur et des dates utiles ;
- ouverture du message source dans sa conversation ;
- suppression d'une référence enregistrée ;
- état vide explicite ;
- point d'entrée depuis l'écran principal de messagerie.

## Frontières permanentes

- le Web affiche uniquement ce que `GET /saved-messages` renvoie après revalidation serveur ;
- aucune copie persistante locale du contenu enregistré ;
- aucune tentative de reconstruire un message devenu inaccessible ;
- supprimer un enregistrement ne supprime jamais le message source ;
- KMD-069 n'ajoute aucune autorisation, aucun stockage serveur et aucune logique Nexus.

## Migration

Aucune migration. KMD-069 consomme KMD-066 déjà fusionné.

## Retour arrière

La page et son lien d'entrée peuvent être retirés sans changer les données ni le contrat KMD-066.

## Validation requise

Build Next.js, build monorepo, tests unitaires et E2E PostgreSQL existants doivent être verts avant fusion.
