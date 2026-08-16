# KMD-083 — Synchronisation Mobile en direct des réactions

## Objectif

Faire refléter dans le contrôle Mobile KMD-081 les agrégats `message:reactions` de KMD-076 en réutilisant le transport temps réel Mobile existant.

## Livrables

- réutilisation de `getRealtimeSocket()` ;
- écoute de `message:reactions` sans créer une seconde connexion Socket.IO ;
- filtrage strict sur `messageId` ;
- mise à jour des agrégats uniquement ;
- conservation de `myReaction` selon les réponses HTTP personnelles ;
- désabonnement propre au démontage, y compris lorsque la connexion asynchrone arrive tard.

## Frontières permanentes

- aucun transport temps réel parallèle n'est ajouté ;
- un événement entrant ne peut pas inventer `myReaction` ;
- aucune identité de réacteur n'est demandée ou persistée ;
- aucune mutation serveur n'est déclenchée par un événement reçu.

## Migration

Aucune migration de base de données.

## Retour arrière

Retirer l'écoute temps réel restaure KMD-081 sans changer les données serveur.

## Validation requise

Compilation TypeScript stricte Mobile, build monorepo, tests unitaires et E2E PostgreSQL doivent être verts avant fusion.
