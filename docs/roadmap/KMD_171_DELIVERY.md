# KMD-171 — Production CORS allowlist

## Objectif

Supprimer la politique CORS de production qui reflétait toute origine navigateur alors que `credentials: true` est actif, sans casser le développement local ni les clients non navigateur.

## Changements

- `apps/api/src/common/cors-policy.ts` centralise la politique CORS.
- Hors production, le comportement permissif historique reste disponible pour le développement local.
- En production, `CORS_ALLOWED_ORIGINS_JSON` est obligatoire et doit contenir au moins une origine Web exacte.
- Les origines de production doivent utiliser HTTPS et ne peuvent contenir ni wildcard, localhost, credentials, chemin, query string ou fragment.
- Les requêtes sans header `Origin` restent acceptées afin de ne pas casser les appels serveur-à-serveur, applications natives, probes et outils opérateur.
- Une origine navigateur non autorisée ne reçoit pas les en-têtes CORS d'autorisation.
- Le preflight de release refuse désormais une configuration CORS absente ou dangereuse.

## Tests

Les tests unitaires couvrent :

- normalisation et déduplication des origines ;
- JSON invalide ;
- origines avec chemin ou credentials ;
- protocoles non HTTP(S) ;
- HTTPS obligatoire en production ;
- refus des hosts locaux ;
- autorisation exacte d'une origine configurée ;
- refus d'une origine étrangère ;
- maintien des requêtes sans `Origin` ;
- échec fermé lorsqu'aucune allowlist de production n'est fournie ;
- conservation du comportement de développement hors production.

Le test du release preflight couvre aussi l'absence d'allowlist, les wildcards, HTTP, localhost et les URLs avec chemin/query.

## Configuration de production

Exemple :

```env
CORS_ALLOWED_ORIGINS_JSON='["https://knowme.example","https://www.knowme.example"]'
```

Chaque entrée doit représenter uniquement une origine (`scheme://host[:port]`). Les routes telles que `/app`, les paramètres `?next=...` et les fragments `#...` ne font pas partie d'une origine CORS et sont refusés afin d'éviter une configuration ambiguë.

## Rollback

1. Revenir au commit précédant KMD-171.
2. Restaurer l'ancien appel `app.enableCors(...)` dans `apps/api/src/main.ts`.
3. Retirer l'exigence `CORS_ALLOWED_ORIGINS_JSON` du preflight uniquement si la release est également annulée.

Un rollback vers `origin: true` ne doit pas être considéré comme acceptable pour une mise en production publique avec credentials.

## Limites et preuves externes

KMD-171 prouve la politique applicative et son gate de configuration. Il ne prouve pas :

- la valeur réellement configurée chez l'hébergeur ;
- les domaines réellement possédés/servis par KnowMe ;
- les règles CORS éventuellement ajoutées par un CDN, reverse proxy ou WAF ;
- une validation depuis les navigateurs et domaines de production réels.

Ces points doivent être vérifiés dans l'environnement cible avant une release commerciale.
