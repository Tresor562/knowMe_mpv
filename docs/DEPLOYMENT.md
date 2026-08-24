# Déploiement initial

## Préparation

1. Copier `.env.example` vers `.env`.
2. Définir un `JWT_SECRET` long et aléatoire.
3. Configurer PostgreSQL.
4. Installer les dépendances avec `pnpm install`.
5. Exécuter les migrations Prisma de production avec `pnpm db:migrate:deploy`.
6. Construire avec `pnpm build`.

## Développement local

```bash
docker compose up -d
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev
```

## Migrations PostgreSQL de production

KMD-179 sépare explicitement la création de migrations en développement de leur application en production.

- `pnpm db:migrate` utilise `prisma migrate dev` et reste réservé au développement pour créer/ajuster des migrations.
- `pnpm db:migrate:deploy` utilise `prisma migrate deploy` et constitue l'unique commande de migration documentée pour une release ou un redéploiement de production.
- `prisma db push` ne doit pas être utilisé comme mécanisme de déploiement de schéma en production : il contourne l'historique de migrations et n'offre pas le même audit de séquence.

La CI KMD-179 applique désormais les migrations enregistrées sur une base PostgreSQL 16 vide avant le build et les suites de tests. Une migration manquante, invalide ou incompatible avec un bootstrap propre doit donc bloquer la PR.

Avant une migration de production : créer/vérifier une sauvegarde récupérable, lire le SQL de toute migration destructive, planifier les opérations longues, puis exécuter `pnpm db:migrate:deploy` une seule fois depuis un job de déploiement contrôlé. Ne pas lancer plusieurs runners de migration concurrents. Un rollback de code ne rembobine pas automatiquement le schéma : toute correction de schéma doit passer par une nouvelle migration corrective ou par une restauration explicitement validée lorsque cela est nécessaire.

## CORS de production

KMD-171 impose une allowlist explicite pour les navigateurs lorsque `NODE_ENV=production`. La configuration doit contenir uniquement les origines Web réellement servies par KnowMe :

```env
CORS_ALLOWED_ORIGINS_JSON='["https://knowme.example","https://www.knowme.example"]'
```

Les wildcards, HTTP, localhost, credentials dans l'URL, chemins, query strings et fragments sont refusés pour une release marché. Les requêtes sans header `Origin` restent possibles pour les applications natives, probes et appels serveur-à-serveur. Après déploiement, vérifier depuis chaque domaine Web réel que l'origine autorisée reçoit les bons headers CORS et qu'une origine étrangère ne les reçoit pas.

## Sondes de santé de production

KMD-166 sépare la vie du processus de sa capacité réelle à recevoir du trafic :

- `GET /health` : compatibilité historique, sans dépendance externe ;
- `GET /health/live` : liveness du processus, sans requête PostgreSQL ;
- `GET /health/ready` : readiness avec un `SELECT 1` PostgreSQL minimal via Prisma.

Le load balancer ou l'orchestrateur doit utiliser `/health/ready` pour retirer du trafic une instance qui ne peut plus joindre PostgreSQL. `/health/live` ne doit servir qu'à décider si le processus lui-même doit être redémarré. Une panne PostgreSQL produit un `503` de readiness sans renvoyer le message d'exception, l'URL de connexion ou des credentials.

La configuration réelle des probes dans l'hébergeur reste une preuve de déploiement externe et ne doit pas être considérée comme réalisée tant qu'elle n'a pas été vérifiée dans l'environnement cible.

## Observabilité HTTP

KMD-167 ajoute une base de logs HTTP structurés sur la sortie standard de l'API. Chaque requête terminée produit une ligne JSON contenant uniquement :

- `event=http_request_completed` ;
- `requestId` ;
- méthode HTTP ;
- chemin sans query string ;
- code HTTP ;
- durée en millisecondes.

Le middleware accepte un `x-request-id` client uniquement s'il respecte un format borné et sûr ; sinon un UUID serveur est généré. Le même identifiant est renvoyé dans `x-request-id` afin de corréler un incident client avec les logs serveur.

Les query strings, corps, cookies, en-têtes d'authentification, tokens et données utilisateur ne sont pas écrits par ce logger. Un collecteur de logs externe doit préserver cette politique de minimisation, chiffrer les données au repos et appliquer une rétention adaptée.

La collecte centralisée, les dashboards, alertes, métriques d'infrastructure et objectifs SLO restent des preuves d'exploitation externes : KMD-167 ne prétend pas les avoir configurés dans l'hébergeur.

## En-têtes de sécurité API

KMD-172 ajoute une défense HTTP de base sur toutes les réponses API :

- `Content-Security-Policy: default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'` ;
- `Referrer-Policy: no-referrer` ;
- `X-Content-Type-Options: nosniff` ;
- `X-Frame-Options: DENY` ;
- `X-DNS-Prefetch-Control: off` ;
- `Permissions-Policy` désactive caméra, microphone, géolocalisation, paiement et USB sur les documents API ;
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` uniquement lorsque `NODE_ENV=production`.

Ces valeurs sont statiques : elles ne reflètent jamais l'URL, les query strings, l'Authorization ou d'autres données de requête. La CSP concerne l'API JSON et ne remplace pas une politique CSP adaptée au frontend Web. HSTS ne doit être considéré comme effectif qu'après vérification que le domaine de production et tous les sous-domaines concernés sont servis exclusivement en HTTPS.

## Sauvegarde et reprise PostgreSQL

KMD-165 fournit un chemin opérable pour créer et vérifier des sauvegardes PostgreSQL sans stocker les credentials dans les manifests.

Créer une sauvegarde :

```bash
pnpm db:backup
```

Un chemin sécurisé explicite peut être fourni avec `--output`. Le dump est créé au format PostgreSQL custom, limité localement à l'utilisateur courant et accompagné d'un manifeste SHA-256. Les dumps contiennent des données sensibles : le stockage de destination doit les chiffrer au repos et les exclure des logs, artefacts publics et dépôts Git.

Tester une restauration dans un environnement isolé :

```bash
export RESTORE_DATABASE_URL='postgresql://.../knowme_restore'
pnpm db:restore -- --file /secure/path/knowme.dump --confirm RESTORE_KNOWME
```

KMD-212 durcit la restauration avant l'appel à `pg_restore` : le manifeste doit correspondre au schéma supporté, déclarer un dump custom, référencer exactement le nom du fichier choisi, contenir un SHA-256 canonique et une date de création valide. Une date anormalement future est refusée. Pour un exercice RPO contrôlé, l'opérateur peut aussi imposer l'âge maximal acceptable du dump :

```bash
pnpm db:restore -- --file /secure/path/knowme.dump --confirm RESTORE_KNOWME --max-age-hours 24
```

Ce paramètre vérifie uniquement la fraîcheur déclarée et l'intégrité locale du dump sélectionné. Il ne prouve pas qu'une sauvegarde distante est réellement planifiée, chiffrée, répliquée ou restaurable dans l'infrastructure de production.

La restauration refuse un dump sans manifeste valide ou dont le SHA-256 ne correspond plus. Elle utilise `pg_restore --exit-on-error --clean --if-exists`; elle doit donc être traitée comme destructive. Après restauration, exécuter les vérifications Prisma, build/tests et contrôles fonctionnels avant toute remise en trafic.

La procédure détaillée, les preuves encore externes et le rollback sont documentés dans `docs/roadmap/KMD_165_DELIVERY.md` et `docs/roadmap/KMD_212_DELIVERY.md`.

## Stickers signés

En production, les stickers utilisent une clé HMAC dédiée et ne doivent pas dépendre de `JWT_SECRET`.

```bash
STICKER_TOKEN_ACTIVE_KEY_ID=primary
STICKER_TOKEN_ACTIVE_SECRET=<secret aléatoire de 32 caractères minimum>
STICKER_TOKEN_PREVIOUS_KEYS_JSON=[]
STICKER_TOKEN_TTL_MS=31536000000
```

Rotation sans casser les messages encore valides :

1. déplacer l’ancienne paire `id` / `secret` dans `STICKER_TOKEN_PREVIOUS_KEYS_JSON` ;
2. définir une nouvelle clé active avec un nouvel identifiant ;
3. déployer toutes les instances ;
4. conserver l’ancienne clé au moins jusqu’à l’expiration du dernier message signé avec elle ;
5. retirer ensuite cette clé de la liste précédente.

Ne jamais réutiliser un identifiant de clé avec un secret différent. Les clés précédentes servent uniquement à la lecture ; toutes les nouvelles signatures utilisent la clé active.

## Isolation des secrets de production

KMD-177 fait échouer `pnpm check:release` lorsqu'une même valeur est réutilisée entre plusieurs frontières de confiance serveur (JWT, métriques, stockage média, stickers, récupération de compte, fournisseur email, TURN, Nexus ou sécurité des paiements lorsqu'ils sont configurés).

Le message d'erreur ne doit contenir que les noms des variables en conflit, jamais la valeur du secret. Générer chaque credential indépendamment et les stocker dans le gestionnaire de secrets de la plateforme cible. Ne pas dériver plusieurs credentials depuis une valeur maîtresse commune simplement pour simplifier l'exploitation.

Ce contrôle ne remplace pas une vraie procédure de rotation. La configuration du gestionnaire de secrets, la révocation des anciennes valeurs, l'IAM minimal et une rotation réellement exécutée restent des preuves externes à valider dans l'environnement de production.

## Avant une mise en production

À ajouter, vérifier ou renforcer selon l'environnement réel :

- stockage objet pour les médias ;
- serveur TURN pour WebRTC ;
- HTTPS obligatoire ;
- vérifier la valeur réelle de `CORS_ALLOWED_ORIGINS_JSON` et les headers CORS sur les domaines de production ;
- vérifier les en-têtes KMD-172 et HSTS sur le domaine API réellement déployé ;
- rate limiting ;
- exécuter `pnpm check:release` avec les secrets de production et vérifier leur isolation KMD-177 ;
- exécuter `pnpm db:migrate:deploy` dans un job contrôlé après sauvegarde et avant remise en trafic ;
- rotation réelle des secrets dans le gestionnaire de secrets de l'hébergeur ;
- configuration réelle des probes `/health/live` et `/health/ready` dans l'hébergeur ;
- planification distante et rétention des sauvegardes PostgreSQL ;
- exercice réel de restauration avec RPO/RTO mesurés ;
- lors de l'exercice de restauration, imposer si approprié `--max-age-hours` selon le RPO attendu ;
- collecte centralisée des logs structurés ;
- dashboards, alertes et supervision externe ;
- tests E2E ;
- politique de confidentialité ;
- conditions d’utilisation ;
- validation réelle des parcours de suppression de compte et export des données.
