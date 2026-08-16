# KMD-091 — Gestion Web des conversations archivées

## Objectif

Rendre KMD-086 utilisable depuis le Web en distinguant clairement archivage personnel, accès à la conversation et politique de notifications.

## Livrables

- route authentifiée `/conversation-archives` ;
- liste des archives personnelles revalidées par le serveur ;
- affichage des conversations actives non archivées ;
- archivage explicite d'une conversation accessible ;
- restauration explicite ;
- ouverture d'une conversation même lorsqu'elle reste archivée ;
- rappel visible que l'archivage ne quitte pas la conversation et ne coupe pas les notifications.

## Frontières permanentes

- le Web n'utilise l'archive comme aucun droit d'accès ;
- aucune conversation inaccessible n'est reconstruite ;
- archiver ne modifie aucun autre membre ;
- archiver n'est pas un mode silencieux ;
- aucune logique Premium ou Nexus distincte n'est ajoutée.

## Migration

Aucune migration de base de données.

## Retour arrière

La page peut être retirée sans modifier les archives KMD-086 existantes.

## Validation requise

Build Next.js, build monorepo, tests unitaires et E2E PostgreSQL doivent être verts avant fusion.
