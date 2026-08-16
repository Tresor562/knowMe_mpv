# KMD-088 — Synchronisation Mobile en direct des éditions

## Objectif

Faire refléter dans le contrôle Mobile KMD-079 les événements `message:updated` de KMD-075 en réutilisant le transport temps réel existant, sans écraser silencieusement une saisie locale.

## Livrables

- réutilisation de `getRealtimeSocket()` ;
- écoute de `message:updated` sans seconde connexion ;
- filtrage strict par conversation et message ;
- adoption automatique de la version serveur si aucune saisie locale divergente n'existe ;
- conservation d'une saisie locale divergente et état de conflit explicite ;
- action explicite pour reprendre la version serveur ;
- nettoyage sûr du listener, y compris si le socket asynchrone arrive après démontage.

## Frontières permanentes

- aucun événement entrant ne déclenche une écriture ;
- aucune saisie locale divergente n'est écrasée silencieusement ;
- `editedAt` reste fourni exclusivement par le serveur ;
- aucun transport parallèle ni logique Nexus/sticker n'est ajouté.

## Migration

Aucune migration de base de données.

## Retour arrière

Retirer l'écoute temps réel restaure KMD-079 sans modifier KMD-075 ni les messages existants.

## Validation requise

Compilation TypeScript stricte Mobile, build monorepo, tests unitaires et E2E PostgreSQL doivent être verts avant fusion.
