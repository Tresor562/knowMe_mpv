# KMD-063 — Pagination déterministe de la recherche universelle

## Objectif

Rendre le contrat KMD-062 réellement paginable avant de construire les interfaces Web et Mobile, sans ajouter d'index parallèle ni élargir les droits de recherche.

## Livrables

- paramètre optionnel `cursor` sur `GET /search` ;
- curseur opaque, versionné et lié à la requête normalisée ;
- borne globale fondée sur la date, le type de résultat et l'identifiant ;
- ordre déterministe entre messages, publications, défis et conversations ;
- rejet explicite des curseurs malformés, trop longs ou réutilisés avec une autre requête ;
- tests unitaires des bornes et de la validation ;
- E2E PostgreSQL prouvant deux pages sans doublon et le refus d'un curseur croisé.

## Frontières permanentes

- la pagination ne change aucune règle d'autorisation de KMD-062 ;
- les messages restent limités aux conversations dont l'appelant est membre ;
- les publications et défis restent limités au propriétaire tant qu'une politique de visibilité plus large n'est pas explicitement versionnée ;
- un curseur n'accorde jamais d'accès et n'est jamais accepté comme preuve d'autorisation ;
- aucun historique de requête ou curseur n'est persisté ;
- aucune recherche sémantique ou Nexus AI n'est ajoutée par ce chantier.

## Migration

Aucune migration de base de données. Le changement est uniquement contractuel et applicatif.

## Retour arrière

La route peut ignorer puis retirer le paramètre `cursor` et revenir à la première page KMD-062 sans modifier les données. Les clients doivent traiter `nextCursor: null` comme fin de liste et ne doivent jamais dépendre du contenu interne du curseur.

## Validation requise

- Prisma generate/push ;
- build du monorepo ;
- tests unitaires complets ;
- E2E PostgreSQL complet ;
- vérification que KMD-059 reste indépendant et non modifié.
