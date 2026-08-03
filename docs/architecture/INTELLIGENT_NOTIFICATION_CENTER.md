# Centre de notifications intelligent

## Responsabilités

KMD-048 gouverne les notifications déjà persistées par les domaines KnowMe. Il décide :

- si un événement est visible dans le centre ;
- s’il est diffusé en temps réel ;
- s’il rejoint un résumé horaire ou quotidien ;
- comment il est regroupé ;
- comment l’utilisateur peut l’archiver, le reporter, le masquer ou le restaurer.

Il ne possède pas les fournisseurs push/e-mail, les endpoints chiffrés, les quotas, les circuits, les tentatives de transport ou la file morte. Ces responsabilités restent dans KMD-046/KMD-047.

## Persistance

### `NotificationCenterPreference`

Préférence globale par utilisateur :

- activation du centre ;
- activation temps réel ;
- mode `INSTANT`, `HOURLY`, `DAILY` ou `CENTER_ONLY` ;
- heure quotidienne explicite ;
- heures calmes ;
- fuseau IANA ;
- catégories actives ;
- types et cercles masqués.

Les catégories `SECURITY` et `SYSTEM` sont forcées à `true` à chaque normalisation.

### `NotificationCenterUserState`

État non destructif par notification :

- masquée ;
- archivée ;
- reportée ;
- restaurée.

L’événement `Notification` original n’est jamais supprimé par une action du centre.

### `NotificationCenterActionReceipt`

Reçu idempotent associant une clé à un utilisateur, une notification et une action. Une réutilisation avec un autre contexte est rejetée.

### File de résumé

`NotificationCenterDigestQueueItem` est créé dans la même transaction que la notification standard. Les notifications créées dans une transaction métier existante peuvent rejoindre la file lors de `publishCreated` grâce à un `upsert`.

Chaque élément contient :

- l’identifiant de notification ;
- l’utilisateur ;
- la catégorie ;
- le mode ;
- une clé de fenêtre ;
- l’échéance ;
- l’état, le jeton de traitement et les erreurs.

`NotificationCenterDigestBatch` garantit une seule synthèse par utilisateur et fenêtre.

## Politique

L’ordre d’évaluation est :

1. classification serveur du type ;
2. caractère critique ;
3. activation globale ;
4. activation de catégorie ;
5. type masqué ;
6. cercle masqué ;
7. heures calmes ;
8. mode de livraison.

La règle la plus restrictive gagne, sauf pour Sécurité et Système qui restent visibles et instantanés.

## Heures calmes

Les fenêtres peuvent traverser minuit. Lorsque début et fin sont identiques, la journée entière est considérée calme pour les événements non critiques.

Le fuseau est validé par `Intl.DateTimeFormat`. Les échéances quotidiennes sont calculées à partir d’une date murale locale et converties en UTC, avec recalcul de l’offset pour tenir compte des changements saisonniers.

## Résumés

### Horaire

Les événements partagent une clé locale `HOURLY:YYYY-MM-DD:HH` et sont dus au début de l’heure locale suivante.

### Quotidien

Les événements partagent une clé locale `DAILY:YYYY-MM-DD` et sont dus à `dailyDigestMinute` dans le fuseau utilisateur.

### Traitement multi-instance

Le worker :

1. récupère les groupes dus ;
2. réclame tous les éléments encore `PENDING` d’une fenêtre avec un jeton UUID ;
3. crée ou relit le reçu de lot idempotent ;
4. crée une seule notification `NOTIFICATION_DIGEST` ;
5. marque les éléments traités ;
6. récupère les traitements bloqués depuis plus de dix minutes ;
7. retente au maximum cinq fois les lots en erreur.

Une collision de lot annule la transaction perdante ; le prochain passage relit le reçu déjà créé.

## Pagination et vues

L’API scanne les notifications avec l’ordre stable `createdAt DESC, id DESC`, applique les états et la politique serveur, puis renvoie :

- `ACTIVE` ;
- `SNOOZED` ;
- `ARCHIVED` ;
- `DISMISSED`.

Le curseur est l’identifiant de la dernière notification visible renvoyée. Les événements filtrés ne sont pas exposés mais restent persistés.

## Regroupement

Les événements ne sont regroupés que si :

- `data.groupKey` est explicite ; ou
- `data.collectiveNotification` vaut `true` et un `circleId` est présent.

Le regroupement utilise une fenêtre horaire et ne fusionne jamais silencieusement deux événements individuels ordinaires.

## Temps réel

Le chemin standard évalue la politique avant la transaction. La notification et son élément de résumé sont créés atomiquement, puis le temps réel est publié uniquement si autorisé.

Les domaines qui créent eux-mêmes une notification dans leur transaction continuent d’appeler `publishCreated`. Cette méthode évalue la politique de façon asynchrone, utilise un `upsert` pour la file et journalise les erreurs sans annuler une transaction métier déjà validée.

## Transport externe

KMD-048 ne crée aucune table d’endpoint. Les routes de transport, adresses chiffrées, quotas, fournisseurs, circuits et webhooks restent centralisés dans KMD-046/KMD-047.

Le centre ne renvoie jamais de jeton, d’adresse, de secret ou de valeur de chiffrement.

## Rétention

Le tableau administrateur permet un nettoyage borné :

- éléments de file traités : 30 jours ;
- reçus d’action et lots : 180 jours.

Les notifications métier originales suivent les politiques générales de rétention et d’export du compte.
