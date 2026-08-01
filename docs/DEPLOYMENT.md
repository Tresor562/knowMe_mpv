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
