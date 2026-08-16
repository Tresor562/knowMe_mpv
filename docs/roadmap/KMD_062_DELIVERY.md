# KMD-062 — Fondation de recherche universelle autorisée

## Objectif

Fournir une recherche transversale utile sans créer un index secondaire qui élargit la visibilité des données privées.

## Livrables

- endpoint authentifié `GET /search?q=...&limit=...` ;
- recherche insensible à la casse ;
- agrégation initiale de messages, conversations, publications et défis ;
- messages limités aux conversations dont l'utilisateur courant est membre ;
- conversations limitées aux conversations dont l'utilisateur courant est membre ;
- publications limitées aux publications de l'utilisateur courant tant qu'une politique de visibilité publique plus fine n'est pas disponible ;
- défis limités aux défis créés par l'utilisateur courant tant que la visibilité de recherche n'est pas explicitement versionnée ;
- limite serveur bornée à 50 résultats ;
- extraits de contenu bornés ;
- tests unitaires verrouillant les filtres de confidentialité.

## Garanties permanentes

- la recherche ne constitue jamais une autorisation de lecture ;
- aucun message d'une conversation extérieure ne peut apparaître dans les résultats ;
- aucun résultat privé n'est rendu visible uniquement parce que son texte correspond à la requête ;
- la recherche Nexus reste hors de ce module KnowMe core ;
- aucune donnée sensible supplémentaire n'est persistée ;
- aucune migration de base de données n'est requise pour cette fondation.

## Retour arrière

Le module peut être retiré de `AppModule` et l'endpoint supprimé sans migration ni transformation des données. Aucun index persistant propre à KMD-062 n'est créé.

## Suite possible

Les futures extensions peuvent ajouter des sources seulement lorsqu'elles possèdent une politique de visibilité serveur explicite et testable. La recherche sémantique ou assistée par IA doit rester un chantier séparé avec consentement, coût, sécurité contre les injections et frontières Nexus/KnowMe respectées.
