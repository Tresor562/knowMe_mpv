# KMD-089 — Contrôle Web d'enregistrement des messages

## Objectif

Permettre au client Web d'enregistrer ou retirer un message via KMD-066 directement depuis un contexte de conversation, sans créer de copie locale persistante ni contourner la visibilité serveur.

## Livrables

- composant `SaveMessageControl` ;
- lecture de l'état courant via la liste autoritaire KMD-066 ;
- ajout idempotent d'un message enregistré ;
- retrait de la référence sans supprimer le message source ;
- état `aria-pressed` ;
- verrouillage pendant les mutations et erreur explicite.

## Frontières permanentes

- aucune copie persistante locale du contenu du message ;
- le serveur KMD-066 revalide toujours l'accès au message ;
- retirer l'enregistrement ne supprime jamais le message ;
- le client n'invente aucun droit d'accès ;
- aucune logique Nexus, Premium ou KnowCoins n'est ajoutée.

## Migration

Aucune migration de base de données.

## Retour arrière

Le composant peut être retiré sans modifier les références KMD-066 existantes.

## Validation requise

Build Next.js, build monorepo, tests unitaires et E2E PostgreSQL doivent être verts avant fusion.
