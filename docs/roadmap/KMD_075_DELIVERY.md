# KMD-075 — Édition autoritaire des messages texte

## Objectif

Permettre à l'auteur d'un message humain de corriger son texte sans permettre à un autre membre de le modifier et sans accepter silencieusement un écrasement concurrent.

## Livrables

- `PATCH /conversations/:id/messages/:messageId` ;
- auteur du message comme seule identité autorisée à modifier ;
- nouveau contenu limité à 4 000 caractères et repassant par la modération de messagerie existante ;
- jeton de concurrence explicite `expectedEditedAt`, avec `null` pour la première modification ;
- rejet `MESSAGE_EDIT_VERSION_CONFLICT` si une autre modification a déjà eu lieu ;
- mise à jour autoritaire de `editedAt` ;
- refus de l'édition des messages stickers signés ;
- événement temps réel `message:updated` envoyé uniquement aux rooms de la conversation et de ses membres ;
- E2E PostgreSQL couvrant auteur, membre non auteur, première édition, conflit et seconde édition valide.

## Frontières permanentes

- KMD-075 ne permet pas de modifier un message Nexus Social ;
- aucun membre autre que l'auteur humain ne peut modifier le message ;
- une édition est remodérée comme du contenu de messagerie ;
- le client ne choisit jamais la valeur finale de `editedAt` ;
- les stickers signés restent immuables ;
- aucun message n'est recréé et l'identifiant d'origine reste stable.

## Migration

Aucune migration : le modèle `Message` possède déjà `editedAt`.

## Retour arrière

La route, le service d'édition et l'événement temps réel peuvent être retirés sans modifier les messages existants. Les valeurs `editedAt` déjà écrites restent des métadonnées sûres.

## Validation requise

Build monorepo, tests unitaires et E2E PostgreSQL complets doivent être verts avant fusion.
