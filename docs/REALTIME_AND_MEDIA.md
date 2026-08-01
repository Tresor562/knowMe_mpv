# Temps réel et médias

## Socket.IO

Namespace : `/realtime`

Événements envoyés par le client :

- `conversation:join`
- `conversation:leave`
- `typing:start`
- `typing:stop`

Événements envoyés par le serveur :

- `presence:update`
- `typing:update`
- `message:created`

Le JWT est transmis dans `handshake.auth.token`.

## Upload de médias

Route :

- `POST /media/upload`

Requête :

- `multipart/form-data`
- champ `file`

Types autorisés :

- JPEG
- PNG
- WebP
- MP4

Taille maximale :

- 15 Mo

Le stockage local est prévu pour le développement. La production devra utiliser S3, Cloudflare R2 ou un service compatible.
