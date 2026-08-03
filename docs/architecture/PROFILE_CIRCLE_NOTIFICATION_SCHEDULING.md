# KMD-045 — Horaires silencieux, résumés et reprise fiable

## Objectif

Permettre aux membres de contrôler quand les alertes collectives facultatives apparaissent, sans perdre les événements ni dupliquer les notifications.

## Horaires silencieux

Chaque utilisateur peut configurer :

- activation ;
- minute locale de début ;
- minute locale de fin ;
- fuseau horaire IANA.

Les fenêtres peuvent traverser minuit. Exemple : 22 h à 7 h.

Pendant le silence :

- les alertes facultatives sont persistées en état `DEFERRED` ;
- leur échéance correspond à la fin de la fenêtre ;
- aucune émission temps réel n’est effectuée ;
- les événements transactionnels obligatoires sont conservés immédiatement dans la boîte, mais leur apparition WebSocket est supprimée.

La date est calculée côté serveur à partir du fuseau IANA. Le client ne décide pas seul de l’échéance.

## Résumé quotidien

Modes :

- `OFF` : notifications séparées ;
- `DAILY` : regroupement quotidien des alertes facultatives.

L’utilisateur choisit une minute locale de livraison. Le serveur calcule la prochaine occurrence future dans le fuseau configuré.

Lors du vidage :

- les lignes dues sont revendiquées ;
- les préférences sont vérifiées de nouveau ;
- les éléments encore autorisés sont regroupés ;
- une seule notification `CIRCLE_DAILY_DIGEST` est créée ;
- les lignes sources partagent l’identifiant du résumé ;
- le résumé contient un total, des catégories et au maximum vingt aperçus ;
- les éléments transactionnels obligatoires ne sont jamais placés dans le résumé.

## États de livraison

- `PENDING` : prêt pour livraison immédiate ;
- `DEFERRED` : attente d’une échéance ;
- `PROCESSING` : revendiqué par un worker ;
- `DELIVERED` : notification persistée ;
- `SUPPRESSED` : préférence devenue restrictive avant livraison ;
- `FAILED` : erreur récupérable.

Modes :

- `INSTANT` ;
- `AFTER_QUIET_HOURS` ;
- `DAILY_DIGEST`.

## Revalidation

Une alerte différée n’est pas livrée aveuglément.

À son échéance, le serveur recharge :

- la catégorie ;
- le statut obligatoire ou facultatif ;
- la structure silencieuse ;
- l’interrupteur général ;
- le mode de résumé ;
- les horaires silencieux ;
- le fuseau ;
- le réglage temps réel.

Elle peut donc être :

- livrée ;
- replanifiée ;
- regroupée ;
- supprimée par préférence.

## Fiabilité

Chaque destinataire possède :

- mode ;
- échéance ;
- jeton de traitement ;
- date de traitement ;
- nombre de tentatives ;
- identifiant de notification ;
- erreur normalisée.

Les écritures utilisent des transactions sérialisables. Un traitement bloqué depuis plus de cinq minutes peut être repris.

La notification et l’état `DELIVERED` sont écrits dans la même transaction.

## Reprise

Le moteur fournit :

- vidage des échéances ;
- santé de la file ;
- réinitialisation des échecs ;
- nouveau vidage après réinitialisation.

Les administrateurs et modérateurs peuvent inspecter la santé et reprendre les erreurs. Un membre ne peut vider que ses propres échéances.

## Intégration Web

La page `/settings/profile-circle-notifications` permet :

- horaires silencieux ;
- fuseau de l’appareil ;
- résumé quotidien ;
- heure du résumé ;
- livraison manuelle des échéances.

La page `/notifications` déclenche un vidage personnel avant de charger la boîte. Une erreur de vidage ne bloque jamais les notifications ordinaires.

## API

### Utilisateur

- `POST /profile-circle-notification-delivery/me/flush`.

### Administration

- `GET /admin/profile-circle-notification-delivery/health` ;
- `POST /admin/profile-circle-notification-delivery/flush` ;
- `POST /admin/profile-circle-notification-delivery/retry-failed`.

## Santé

Le résumé opérationnel contient :

- éléments immédiats en attente ;
- échéances dépassées ;
- échecs ;
- traitements bloqués ;
- livraisons des dernières 24 heures ;
- suppressions par préférence des dernières 24 heures.

## Limites restantes

- ordonnanceur distribué automatique ;
- verrou global multi-région ;
- tableaux de bord graphiques ;
- push Android et iOS ;
- email de résumé ;
- regroupement par structure configurable ;
- fenêtre hebdomadaire ;
- politiques spécifiques aux mineurs ;
- métriques OpenTelemetry de la file.
