# KMD-065 — Composant Mobile de recherche universelle

## Objectif

Préparer l'expérience de recherche universelle Expo/React Native sur le contrat serveur KMD-062/KMD-063, sans dupliquer les règles d'autorisation et sans bloquer KMD-064 Web.

## Livrables

- composant `UniversalSearchExperience` compilé dans le client Mobile ;
- saisie bornée, sans historique local persistant ;
- consommation de `GET /search` avec limite de page explicite ;
- pagination par curseur opaque KMD-063 ;
- déduplication défensive par `kind:id` ;
- rendu distinct des messages, conversations, publications et défis ;
- callback optionnel pour que la future navigation Mobile ouvre un résultat sans que le composant n'interprète lui-même la route Web ;
- états de chargement, résultat vide et erreur.

## Frontières permanentes

- le composant n'invente jamais une permission ou une visibilité ;
- aucun curseur n'est décodé, modifié ou persisté ;
- aucune requête de recherche n'est conservée après la vie du composant ;
- aucune recherche Nexus/IA ou sémantique n'est ajoutée ;
- aucune URL arbitraire n'est exécutée sur Mobile ;
- l'intégration à la navigation principale reste un chantier séparé afin de ne pas coupler composant et routeur.

## Migration

Aucune migration de base de données.

## Retour arrière

Le composant peut être retiré sans effet serveur ni transformation de données. Les contrats KMD-062/KMD-063 restent inchangés.

## Validation requise

- compilation TypeScript stricte du client Mobile ;
- build complet du monorepo ;
- tests unitaires et E2E serveur existants ;
- aucune fusion avant CI entièrement verte.
