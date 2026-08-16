# KMD-082 — Synchronisation Web en direct des réactions

## Objectif

Faire refléter dans le contrôle Web KMD-080 les agrégats `message:reactions` émis par KMD-076 sans exposer les identités des réacteurs et sans écraser la réaction personnelle locale.

## Livrables

- écoute de l'événement temps réel `message:reactions` ;
- filtrage strict sur `messageId` ;
- remplacement uniquement des agrégats autoritaires `reactions` ;
- conservation de `myReaction`, qui reste confirmée par les réponses HTTP du membre ;
- désabonnement propre lors du démontage du composant.

## Frontières permanentes

- l'événement temps réel n'est jamais utilisé pour inventer `myReaction` ;
- aucune liste d'identités n'est demandée ou conservée ;
- aucune mutation n'est déclenchée par un événement entrant ;
- la route HTTP KMD-076 reste la source initiale de vérité du contrôle.

## Migration

Aucune migration de base de données.

## Retour arrière

Retirer l'écoute temps réel restaure le comportement KMD-080 sans modifier les réactions serveur.

## Validation requise

Build Next.js, build monorepo, tests unitaires et E2E PostgreSQL doivent être verts avant fusion.
