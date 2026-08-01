# KnowMe

KnowMe est une plateforme sociale conçue pour aider les personnes à mieux se connaître grâce aux défis, aux jeux, aux conversations et aux expériences partagées.

## Applications

- `apps/api` — API NestJS, Prisma, PostgreSQL et Socket.IO ;
- `apps/web` — application Web Next.js ;
- `apps/mobile` — application Expo / React Native.

## Documentation officielle

- [Master Product Specification V2](./docs/KNOWME_MASTER_PRODUCT_SPECIFICATION_V2.md)
- [Foundation Blueprint](./docs/architecture/FOUNDATION_BLUEPRINT.md)
- [Product Roadmap V2](./docs/roadmap/PRODUCT_ROADMAP_V2.md)
- [Implementation Backlog](./docs/roadmap/IMPLEMENTATION_BACKLOG.md)
- [Index de la documentation et ADR](./docs/README.md)

## Priorité produit

KnowMe doit d’abord exceller dans quatre résultats :

1. découvrir réellement une personne ;
2. jouer et relever des défis ensemble ;
3. discuter naturellement ;
4. conserver des souvenirs positifs.

Les systèmes Premium, KnowCoins, avatars, cadeaux, communautés, IA, jeux et animations sont développés progressivement autour de ce cœur.

## Développement

Le dépôt utilise un monorepo pnpm. Les changements importants doivent être développés sur une branche, validés par la CI puis fusionnés par Pull Request.