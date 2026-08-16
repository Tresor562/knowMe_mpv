# KMD-092 — Gestion Mobile des conversations archivées

## Objectif

Rendre KMD-086 utilisable depuis Expo/React Native en distinguant clairement archivage personnel, accès à la conversation et notifications.

## Livrables

- composant `ConversationArchivesExperience` ;
- liste des archives personnelles revalidées ;
- liste des conversations actives non archivées ;
- archivage explicite ;
- restauration explicite ;
- callback facultatif pour ouvrir une conversation sans imposer un routeur ;
- rappel visible que l'archivage ne coupe pas les notifications.

## Frontières permanentes

- aucune conversation inaccessible n'est reconstruite ;
- archiver ne quitte pas la conversation ;
- archiver ne modifie aucun autre membre ;
- archiver ne change aucune politique de notification ;
- aucune logique Premium ou Nexus distincte n'est ajoutée.

## Migration

Aucune migration de base de données.

## Retour arrière

Le composant peut être retiré sans modifier les archives KMD-086 existantes.

## Validation requise

Compilation TypeScript stricte Mobile, build monorepo, tests unitaires et E2E PostgreSQL doivent être verts avant fusion.
