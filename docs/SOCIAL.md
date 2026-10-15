# Relations sociales

## Routes

- `GET /social/search?q=...`
- `GET /social/friendships/by-username/:username` — état personnel de relation pour les profils Web et Android (`SELF`, `NONE`, `OUTGOING`, `INCOMING`, `FRIENDS`, `BLOCKED`), identifiant cible et identifiant de demande seulement quand autorisé ; accès authentifié.
- `POST /social/friend-requests`
- `DELETE /social/friend-requests/:id` — annulation par le demandeur tant que la demande est en attente.
- `GET /social/friend-requests/incoming`
- `PATCH /social/friend-requests/:id/accept`
- `PATCH /social/friend-requests/:id/decline`
- `GET /social/friends`
- `DELETE /social/friends/:id`
- `POST /social/blocks/:userId`

## Règles

- impossible de s’ajouter soi-même ;
- une relation acceptée ne peut pas être dupliquée ;
- les demandes en attente ne sont pas recréées ;
- le blocage remplace la relation existante et empêche tout renvoi de demande ;
- une notification est créée lors d’une demande ou d’une acceptation.
