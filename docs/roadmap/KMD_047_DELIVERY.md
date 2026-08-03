# KMD-047 — Résilience et gouvernance des notifications

## Livré

### Gouvernance utilisateur

- préférences indépendantes pour Push et Email ;
- seuil minimal de priorité par canal ;
- désactivation des communications facultatives ;
- maintien séparé des alertes critiques ;
- export sans adresse ni secret en clair ;
- désactivation globale des canaux externes ;
- effacement de l’état facultatif.

### Sécurité et confiance

- aucune sélection de fournisseur depuis le client ;
- suppressions autoritaires par utilisateur, canal et adresse ;
- expiration contrôlée des suppressions ;
- modèles versionnés ;
- interpolation texte et HTML échappée ;
- reçus fournisseurs signés par HMAC ;
- tolérance temporelle bornée ;
- traitement idempotent des événements externes.

### Résilience

- priorités Low, Normal, High et Critical ;
- quotas atomiques par utilisateur et fournisseur ;
- circuit breaker persistant ;
- état Closed, Open et Half Open ;
- sondes de récupération contrôlées ;
- backoff exponentiel borné ;
- jitter déterministe ;
- nombre maximal de tentatives ;
- file morte administrable ;
- rejeu et résolution sans double effet ;
- routage Push ou Email selon disponibilité ;
- dispatcher résilient.

### Exploitation

- maintenance distribuée protégée par lease ;
- reprise périodique des échecs ;
- expiration des suppressions ;
- nettoyage des quotas ;
- alertes persistantes ;
- détection de circuits ouverts ;
- détection d’échecs élevés ;
- dashboard administrateur ;
- déclenchement manuel de maintenance.

### Validation

- tests de hiérarchie des priorités ;
- tests de sélection de route ;
- tests de backoff déterministe et borné ;
- génération Prisma attendue ;
- synchronisation PostgreSQL attendue ;
- builds API, Web et Mobile attendus ;
- tests unitaires et E2E attendus.

## Variables nouvelles

- `PROFILE_NOTIFICATION_RESILIENCE_ENABLED` ;
- `PROFILE_NOTIFICATION_PROVIDER_FAILURE_THRESHOLD` ;
- `PROFILE_NOTIFICATION_PROVIDER_RECOVERY_SUCCESSES` ;
- `PROFILE_NOTIFICATION_CIRCUIT_COOLDOWN_MS` ;
- `PROFILE_NOTIFICATION_RETRY_BASE_MS` ;
- `PROFILE_NOTIFICATION_RETRY_MAXIMUM_MS` ;
- `PROFILE_NOTIFICATION_USER_RATE_PER_MINUTE` ;
- `PROFILE_NOTIFICATION_PROVIDER_RATE_PER_MINUTE` ;
- `PROFILE_NOTIFICATION_WEBHOOK_TOLERANCE_MS` ;
- `PROFILE_NOTIFICATION_<PROVIDER>_WEBHOOK_SECRET`.

## Prochains blocs possibles

- fournisseurs Push natifs FCM et APNs ;
- adaptateurs Email transactionnels ;
- politiques par pays ;
- suivi de latence par percentile ;
- tests de chaos fournisseur ;
- console Web graphique ;
- rotation automatisée des secrets ;
- routage régional.