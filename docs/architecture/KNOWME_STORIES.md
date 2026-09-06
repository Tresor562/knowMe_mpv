# KnowMe Stories — architecture canonique

## Objectif

Stories devient un domaine transversal KnowMe et ne doit pas rester dispersé entre profils, Profile Circles, communautés et futurs channels.

Le moteur canonique repose sur `Story` et distingue son auteur (`authorUserId`) de son contexte de publication (`ownerType` + `ownerId`). Les contextes prévus sont :

- `PROFILE` ;
- `PROFILE_CIRCLE` ;
- `COMMUNITY` ;
- `CHANNEL`.

Les anciens `ProfileCircleStory` restent temporairement supportés. Ils doivent être migrés vers le moteur canonique par dual-read/dual-write puis backfill, sans suppression brutale.

## Types

- TEXT
- PHOTO
- VIDEO
- GIFT
- ACHIEVEMENT
- GAME
- POLL
- LINK

Le modèle est extensible sans faire du contenu une simple chaîne de texte.

## Audience et confidentialité

Audiences natives :

- PUBLIC
- FRIENDS
- FOLLOWERS
- BEST_FRIENDS
- CUSTOM
- PRIVATE

`CUSTOM` et `BEST_FRIENDS` utilisent des grants explicites. Une Story ne doit jamais élargir silencieusement son audience.

Le média reste privé dans le MediaService. `GET /stories/:id/media` vérifie d'abord l'ACL Story puis stream le média appartenant à l'auteur avec `purpose=STORY`. Aucun URL d'objet brut n'est exposé.

## Durée

Standard : 24 h.

KnowMe Premium (`premium.stories`) :

- 1 h
- 6 h
- 12 h
- 24 h
- 48 h
- 72 h
- 7 jours
- 14 jours
- 30 jours
- permanent

Les anciennes politiques de durée des Stories communautaires/circles devront être traduites vers ce moteur lors de la migration.

## Création

Le composer et l'API acceptent :

- texte/caption ;
- photo/vidéo via upload `purpose=STORY` ;
- lien ;
- musique par référence MediaAsset ;
- localisation ;
- hashtags ;
- mentions ;
- zones interactives ;
- audience ;
- durée ;
- réponses/réactions/repartage ;
- création multiple (`POST /stories/batch`) ;
- Story live (`isLive`).

Le contenu passe par la modération existante avant publication. Les assets sont contrôlés comme appartenant à l'auteur et doivent être disponibles.

## Viewer

Le viewer web :

- charge la Story autorisée ;
- enregistre la vue ;
- suit le taux de complétion ;
- affiche une barre de progression ;
- avance automatiquement ;
- supporte précédent/suivant ;
- supporte clavier gauche/droite/Échap ;
- supporte swipe horizontal tactile ;
- charge photo/vidéo via flux authentifié ;
- permet réaction et réponse ;
- permet archive, pin et suppression au propriétaire.

## Interactions et notifications

Événements actuellement notifiés :

- mention dans Story ;
- réaction ;
- réponse ;
- capture signalée par le client.

Les préférences du Notification Center restent autoritaires.

## Analytics propriétaire

- spectateurs uniques ;
- nombre total de vues ;
- taux moyen de complétion ;
- réactions ;
- réponses ;
- captures signalées ;
- détail des spectateurs lorsque la politique le permet.

## Archive, profil et albums

Une Story expirée est archivée côté auteur. Le propriétaire peut aussi archiver manuellement.

Une Story peut être épinglée au profil et ajoutée à un `StoryAlbum`. Les albums ont leur propre titre, description, cover et audience.

## Discover

Les Stories publiques disposent d'une découverte par :

- hashtag ;
- localisation textuelle ;
- hashtags tendance sur 24 h.

La découverte ne doit jamais contourner l'audience, l'âge, la sécurité ou la modération.

## Live Stories

Une Story peut être marquée live. `POST /stories/:id/live/end` termine explicitement le live et conserve l'objet Story selon sa rétention.

## Premium

`premium.stories` est un entitlement distinct. Le bootstrap l'ajoute au plan `premium_monthly` et synchronise les grants Premium actifs historiques afin de ne pas créer de régression pour les abonnés existants.

Premium n'achète ni KP ni niveau. Il débloque des capacités Story avancées.

## i18n

Les nouvelles surfaces Story web suivent la locale runtime EN/FR actuelle de KnowMe. Les erreurs API utilisent des codes Story stables et un fallback, afin que le client puisse progressivement localiser chaque erreur sans parser une phrase serveur.

## Migration des anciens moteurs Story

Ordre recommandé :

1. conserver `ProfileCircleStory` en lecture/écriture pendant la transition ;
2. ajouter un adaptateur `ProfileCircleStory -> Story(ownerType=PROFILE_CIRCLE)` ;
3. dual-write les nouvelles Stories collectives ;
4. backfill historique avec IDs/source de migration auditables ;
5. comparer compteurs, audiences, expirations et modération ;
6. basculer les reads vers `Story` ;
7. supprimer l'ancien moteur seulement après fenêtre de rollback.

Aucune migration de données existantes ne doit être destructive ou silencieuse.

## À préserver

- sécurité du MediaService ;
- contrôle d'audience côté serveur ;
- i18n ;
- accessibilité et réduction du mouvement côté UI ;
- audit des actions propriétaire ;
- pas de KP automatiques pour simplement publier une Story ;
- pas de duplication durable entre Stories personnelles, collectives et communautaires.
