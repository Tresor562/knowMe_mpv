# KMD-061 — Registre serveur autoritaire des liens courts

## Dépendance

KMD-061 dépend uniquement de KMD-060, fusionné dans `main` via la PR #109.

KMD-059 reste un chantier séparé d'appels et ne doit pas être mélangé à cette branche.

## Objectif

Ajouter un registre serveur persistant qui transforme une cible validée par `@knowme/link-contract` en code court opaque, révocable et éventuellement expirant, sans permettre au client de choisir une redirection arbitraire.

## Contrat cible

Un enregistrement conserve au minimum :

- code opaque généré côté serveur ;
- propriétaire ;
- catégorie de cible allowlistée ;
- identifiant opaque de cible ;
- date de création ;
- expiration facultative bornée ;
- date de révocation facultative ;
- motif de révocation sans secret ;
- compteur d'ouvertures agrégé, sans empreinte publicitaire ni profilage individuel.

## API cible

- `POST /short-links` — authentifié, crée ou réutilise un lien selon une clé d'idempotence ;
- `GET /short-links/mine` — authentifié, liste uniquement les liens du compte ;
- `DELETE /short-links/:code` — authentifié, révocation logique propriétaire ;
- `GET /short-links/:code/preview` — public, retourne uniquement une preview sûre et la cible typée si le lien est actif ;
- `GET /short-links/:code/resolve` — public, retourne la cible typée active, jamais une URL libre.

## Règles

- le client ne choisit jamais le code ;
- codes générés avec CSPRNG et alphabet URL-safe ;
- collision traitée côté serveur avec contrainte unique et nouvelle génération bornée ;
- expiration maximale initiale : 90 jours ;
- aucun lien expiré ou révoqué n'est résolu ;
- aucun `http(s)://`, `javascript:`, route admin ou paramètre `next` n'est stocké comme destination ;
- la résolution ne contourne jamais les permissions de la ressource finale ;
- révocation idempotente ;
- création idempotente par compte ;
- audit sans code secret dérivé, token de session ou URL externe ;
- suppression de compte supprime les liens possédés ;
- les analytics restent agrégés et minimaux.

## Migration et retour arrière

La migration crée une table dédiée avec contrainte unique sur `code`, index propriétaire/état et suppression en cascade avec le propriétaire. Le retour arrière fonctionnel consiste à désactiver les endpoints et la création ; la table peut rester en lecture seule pendant une période de transition avant suppression explicite.

## Validation avant fusion

- Prisma generate/push ;
- build monorepo ;
- tests unitaires génération/expiration/validation ;
- E2E création, idempotence, collision simulée, résolution, expiration, révocation, isolation propriétaire et suppression de compte ;
- CI complète verte.
