# Déploiement initial

## Préparation

1. Copier `.env.example` vers `.env`.
2. Définir un `JWT_SECRET` long et aléatoire.
3. Configurer PostgreSQL.
4. Installer les dépendances avec `pnpm install`.
5. Exécuter les migrations Prisma.
6. Construire avec `pnpm build`.

## Développement local

```bash
docker compose up -d
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm dev
```

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

La restauration refuse un dump sans manifeste valide ou dont le SHA-256 ne correspond plus. Elle utilise `pg_restore --exit-on-error --clean --if-exists`; elle doit donc être traitée comme destructive. Après restauration, exécuter les vérifications Prisma, build/tests et contrôles fonctionnels avant toute remise en trafic.

La procédure détaillée, les preuves encore externes et le rollback sont documentés dans `docs/roadmap/KMD_165_DELIVERY.md`.

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

## Avant une mise en production

À ajouter, vérifier ou renforcer selon l'environnement réel :

- stockage objet pour les médias ;
- serveur TURN pour WebRTC ;
- HTTPS obligatoire ;
- rate limiting ;
- rotation des secrets ;
- configuration réelle des probes `/health/live` et `/health/ready` dans l'hébergeur ;
- planification distante et rétention des sauvegardes PostgreSQL ;
- exercice réel de restauration avec RPO/RTO mesurés ;
- collecte centralisée des logs structurés ;
- dashboards, alertes et supervision externe ;
- tests E2E ;
- politique de confidentialité ;
- conditions d’utilisation ;
- validation réelle des parcours de suppression de compte et export des données.
