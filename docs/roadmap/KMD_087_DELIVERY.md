# KMD-087 — Synchronisation Web en direct des éditions

## Objectif

Faire refléter dans le contrôle Web KMD-078 les événements `message:updated` de KMD-075 sans écraser silencieusement une saisie locale en cours.

## Livrables

- écoute de `message:updated` via le transport Web existant ;
- filtrage strict par conversation et message ;
- mise à jour automatique du contenu et de `editedAt` lorsqu'aucune saisie locale divergente n'existe ;
- détection d'un conflit temps réel si une autre édition arrive pendant une saisie locale ;
- conservation de la saisie locale dans ce cas ;
- action explicite pour revenir à la version serveur ;
- désabonnement propre au démontage.

## Frontières permanentes

- un événement entrant ne déclenche aucune écriture serveur ;
- une saisie locale divergente n'est jamais écrasée silencieusement ;
- `editedAt` reste exclusivement fourni par le serveur ;
- aucune seconde connexion temps réel n'est créée ;
- aucune logique Nexus, sticker ou permission supplémentaire n'est ajoutée.

## Migration

Aucune migration de base de données.

## Retour arrière

Retirer l'écoute temps réel restaure KMD-078 sans modifier KMD-075 ni les messages existants.

## Validation requise

Build Next.js, build monorepo, tests unitaires et E2E PostgreSQL doivent être verts avant fusion.
