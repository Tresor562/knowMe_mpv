# KnowMe Notification Center

Version : KMD-044

## Objectif

Le centre de notifications KnowMe doit rester utile même lorsque l’activité devient importante. Il regroupe les alertes compatibles, applique les préférences côté serveur et protège les alertes critiques.

## Deux niveaux de préférence

1. Les préférences globales couvrent Social, Messages, Défis, Cadeaux, Secret, Profils collectifs, Sécurité et Système.
2. Les préférences propres aux profils collectifs conservent leurs réglages fins : invitations, adhésions, gouvernance, contenu, famille, cercle muet, heures calmes et résumé quotidien.

Une notification collective doit satisfaire les deux niveaux. La préférence la plus restrictive l’emporte, sauf pour les alertes critiques de sécurité et de système qui restent visibles dans le centre.

## Résolution serveur

Le serveur calcule :

- la catégorie ;
- la visibilité dans le centre ;
- l’autorisation temps réel ;
- l’autorisation push future ;
- les heures calmes ;
- le mode instantané ou résumé ;
- les types et cercles rendus muets.

Le client ne décide jamais seul qu’une notification doit être cachée.

## États personnels

`NotificationUserState` sépare les actions du destinataire de l’événement d’origine :

- masquée ;
- archivée ;
- reportée jusqu’à une date ;
- restaurée.

La notification d’origine reste disponible pour l’audit et l’idempotence. Le compteur non lu est calculé après application des préférences et des états.

## Regroupement

Les événements collectifs compatibles sont regroupés par cercle, type et fenêtre horaire. Le groupe expose :

- le dernier événement ;
- le nombre total ;
- le nombre non lu ;
- les identifiants membres ;
- la route interne autorisée.

Les actions Marquer lu, Reporter, Archiver et Masquer s’appliquent à tous les membres du groupe avec une clé d’idempotence par notification.

## Alertes critiques

Les catégories `SECURITY` et `SYSTEM` :

- restent visibles dans le centre ;
- ne peuvent pas être désactivées par une préférence de catégorie ;
- respectent néanmoins les heures calmes pour les sons, le temps réel et le push ;
- ne révèlent jamais de secret dans le contenu de notification.

## Push mobile

KMD-044 prépare `NotificationPushEndpoint` sans activer un fournisseur externe.

Règles :

- le client envoie une référence sécurisée de type `vault://`, `expo://`, `fcm://`, `apns://` ou `webpush://` ;
- le serveur calcule une empreinte SHA-256 ;
- les réponses API n’exposent que la fin de l’empreinte ;
- aucun jeton brut n’est renvoyé ;
- l’interface indique clairement que le fournisseur push n’est pas encore configuré.

Avant la production, `tokenReference` devra pointer vers un coffre de secrets ou un service push isolé. Il ne doit pas contenir un secret exploitable en clair.

## Reprise et résumés collectifs

La file collective existante conserve :

- les états Pending, Deferred, Processing, Delivered, Suppressed et Failed ;
- les revendications par jeton ;
- les transactions sérialisables ;
- la récupération des traitements bloqués ;
- les résumés quotidiens ;
- le contrôle de santé ;
- la remise en file des échecs.

Le centre global n’introduit pas une seconde file concurrente.

## API

- `GET /notifications/center`
- `GET /notifications/preferences`
- `PUT /notifications/preferences`
- `POST /notifications/:id/state`
- `GET /notifications/push-endpoints`
- `POST /notifications/push-endpoints`
- `POST /notifications/push-endpoints/:endpointId/disable`
- `GET /notifications/unread-count`
- `PATCH /notifications/:id/read`
- `PATCH /notifications/read-all`

## Interfaces

### Web

`/notifications` fournit :

- alertes regroupées ;
- statut temps réel ;
- compteur filtré ;
- réglages globaux ;
- catégories essentielles verrouillées ;
- heures calmes ;
- modes instantané, horaire, quotidien et centre uniquement ;
- actions groupées.

### Mobile

`NotificationCenterExperience` fournit le contrat mobile du centre sans ajouter prématurément `expo-notifications`. L’intégration au routeur principal et le fournisseur push restent des blocs séparés.

## Limites restantes

- fournisseur push réel ;
- permissions natives Android/iOS ;
- badges d’icône natifs ;
- résumés globaux générés par worker ;
- pagination par curseur ;
- recherche dans les anciennes notifications ;
- restauration des archives depuis une interface dédiée ;
- tests E2E WebSocket et push.
