# Notifications temps réel KnowMe

## Objectif

Les notifications sont persistées dans PostgreSQL puis diffusées uniquement dans la room Socket.IO personnelle du destinataire :

```text
user:<userId>
```

Aucun événement de notification n'est diffusé publiquement ou dans une room de conversation.

## Modèle persistant

Une notification contient :

- `id` : identifiant unique ;
- `userId` : destinataire ;
- `type` : type fonctionnel ;
- `title` et `body` : contenu visible ;
- `data` : métadonnées JSON de navigation ;
- `readAt` : date de lecture facultative ;
- `createdAt` : date de création.

Exemple de métadonnées :

```json
{
  "route": "/feed/post_id",
  "entityType": "POST",
  "entityId": "post_id",
  "commentId": "comment_id",
  "actorId": "user_id"
}
```

Le client ne doit jamais construire une autorisation depuis ces métadonnées. La route cible applique toujours ses propres contrôles d'accès côté API.

## Événements Socket.IO

### `notification:created`

Émis après la persistance réussie d'une notification.

Payload : objet Notification complet.

Comportement client recommandé :

1. dédupliquer par `id` ;
2. insérer en tête de liste ;
3. incrémenter le compteur uniquement si `readAt` est nul ;
4. limiter la liste locale à 50 éléments.

### `notification:read`

Payload :

```json
{
  "notificationId": "notification_id",
  "readAt": "2026-08-01T09:00:00.000Z"
}
```

Le client met à jour l'élément existant et réduit son compteur non lu sans passer sous zéro.

### `notification:read-all`

Payload :

```json
{
  "readAt": "2026-08-01T09:00:00.000Z"
}
```

Le client attribue cette date aux notifications encore non lues et remet le compteur à zéro.

## Types actuellement produits

| Type | Route principale | Origine |
| --- | --- | --- |
| `FRIEND_REQUEST` | `/friends` | demande d'ami |
| `FRIEND_ACCEPTED` | `/friends` | acceptation d'une demande |
| `POST_LIKED` | `/feed/:postId` | like d'une publication |
| `POST_COMMENTED` | `/feed/:postId` | commentaire d'une publication |
| `CHALLENGE_JOINED` | `/challenges/:challengeId` | participation à un défi |
| `MESSAGE` | `/messages/:conversationId` | nouveau message |

## Lecture via l'API

```http
GET /notifications
GET /notifications/unread-count
PATCH /notifications/:id/read
PATCH /notifications/read-all
```

Les quatre routes nécessitent un JWT. La lecture individuelle vérifie que la notification appartient bien à l'utilisateur connecté.

## Garanties

- la notification est persistée avant sa diffusion ;
- la diffusion cible uniquement le destinataire ;
- la liste est triée par date puis identifiant ;
- les compteurs sont recalculables depuis PostgreSQL ;
- la lecture est synchronisée entre plusieurs appareils ;
- les routes de navigation restent indicatives et ne remplacent jamais les autorisations serveur.
