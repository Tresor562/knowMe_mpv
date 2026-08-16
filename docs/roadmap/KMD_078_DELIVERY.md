# KMD-078 — Contrôle Web d'édition autoritaire

## Objectif

Fournir au client Web un composant réutilisable pour modifier un message texte via KMD-075 sans fabriquer de version, sans ignorer un conflit et sans déplacer la modération dans le navigateur.

## Livrables

- composant `MessageEditControl` ;
- contenu borné à 4 000 caractères ;
- envoi du jeton `expectedEditedAt` confirmé par le serveur ;
- mise à jour locale uniquement après réponse autoritaire réussie ;
- état explicite de conflit empêchant tout écrasement supplémentaire ;
- callback `onUpdated` pour intégrer le résultat au fil de conversation ;
- callback facultatif d'annulation.

## Frontières permanentes

- le client ne calcule ni ne choisit la nouvelle valeur de `editedAt` ;
- un conflit KMD-075 bloque la nouvelle écriture jusqu'au rechargement ;
- le contrôle ne permet pas d'éditer un sticker ou un message Nexus par contournement ;
- aucune modération locale ne remplace le contrôle serveur ;
- aucun historique d'édition n'est persisté par le client.

## Migration

Aucune migration de base de données.

## Retour arrière

Le composant peut être supprimé sans modifier KMD-075 ni les messages existants.

## Validation requise

Build Next.js, build monorepo, tests unitaires et E2E PostgreSQL existants doivent être verts avant fusion.
