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

À ajouter ou renforcer :

- stockage objet pour les médias ;
- serveur TURN pour WebRTC ;
- HTTPS obligatoire ;
- rate limiting ;
- rotation des secrets ;
- sauvegardes PostgreSQL ;
- logs centralisés ;
- supervision ;
- tests E2E ;
- politique de confidentialité ;
- conditions d’utilisation ;
- mécanisme de suppression de compte et export des données.
