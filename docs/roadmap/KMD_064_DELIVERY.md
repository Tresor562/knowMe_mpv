# KMD-064 — Expérience Web de recherche universelle

## Objectif

Rendre les contrats KMD-062 et KMD-063 réellement utilisables depuis le Web KnowMe sans déplacer la moindre décision d'autorisation vers le navigateur.

## Livrables

- route authentifiée `/search` dans l'application Next.js ;
- formulaire de recherche borné et sans historique persistant local ;
- rendu des messages, conversations, publications et défis renvoyés par l'API ;
- navigation uniquement vers la route interne fournie par le contrat serveur ;
- pagination avec le curseur opaque KMD-063 ;
- déduplication défensive par couple `kind:id` lors du chargement de pages supplémentaires ;
- états de chargement, résultat vide et erreur ;
- point d'entrée visible depuis le tableau de bord Web.

## Frontières permanentes

- le client n'invente aucune visibilité et ne recherche aucune donnée directement ;
- le client ne décode, ne modifie et ne persiste pas le curseur KMD-063 ;
- aucune recherche Nexus, sémantique ou assistée par IA n'est ajoutée ;
- aucune requête ou historique de recherche n'est stocké par KMD-064 ;
- les résultats restent exclusivement ceux autorisés par KMD-062 ;
- KMD-059 et les permissions matérielles d'appel restent hors périmètre.

## Migration

Aucune migration de base de données. KMD-064 est un chantier client Web consommant les contrats déjà fusionnés.

## Retour arrière

La page `/search` et ses points d'entrée peuvent être retirés sans modifier les données ni l'API. KMD-062 et KMD-063 restent utilisables indépendamment par de futurs clients.

## Validation requise

- build complet du monorepo ;
- tests unitaires existants ;
- E2E PostgreSQL complet afin de vérifier qu'aucune régression d'autorisation n'est introduite ;
- vérification de compilation Next.js de la nouvelle route ;
- aucune fusion avant CI entièrement verte.
