# Relations sociales

## Routes

- `GET /social/search?q=...`
- `POST /social/friend-requests`
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
- le blocage remplace la relation existante ;
- une notification est créée lors d’une demande ou d’une acceptation.
