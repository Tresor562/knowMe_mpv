# Architecture KnowMe

## Applications

- `apps/web` : interface Next.js
- `apps/mobile` : application Expo / React Native
- `apps/api` : API NestJS

## Domaines fonctionnels

- authentification et profils ;
- défis et réponses ;
- messagerie ;
- publications, mentions J’aime et commentaires ;
- notifications ;
- administration et audit.

## Sécurité du MVP

- Argon2 pour les mots de passe ;
- JWT Bearer ;
- validation des entrées ;
- contrôle d’accès aux conversations ;
- rôles pour l’administration ;
- journal d’audit.

## Fonctionnalités restant à industrialiser

- stockage média ;
- WebSocket et présence en temps réel ;
- appels WebRTC ;
- moteur IA avancé ;
- tests E2E ;
- observabilité et déploiement cloud.
