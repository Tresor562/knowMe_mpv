# KMD-045 — Horaires silencieux et résumés

## Livré

### Planification

- horaires silencieux traversant minuit ;
- fuseau IANA ;
- calcul serveur de l’échéance ;
- résumé quotidien ;
- heure locale du résumé ;
- alertes obligatoires hors résumé ;
- suppression du temps réel obligatoire pendant le silence.

### File fiable

- états Pending, Deferred, Processing, Delivered, Suppressed et Failed ;
- modes Instant, After Quiet Hours et Daily Digest ;
- échéance par destinataire ;
- revalidation des préférences ;
- replanification ;
- résumé unique ;
- transactions sérialisables ;
- reprise après blocage ;
- erreur normalisée ;
- comptage des tentatives.

### Exploitation

- santé de la file ;
- vidage utilisateur ;
- vidage administrateur ;
- reprise des échecs ;
- rôles Admin et Moderator ;
- métriques sur 24 heures.

### Web

- horaires et fuseau ;
- sélection du fuseau appareil ;
- mode résumé ;
- heure du résumé ;
- bouton de livraison ;
- vidage automatique à l’ouverture de la boîte.

## Vérifications attendues

- génération Prisma ;
- synchronisation PostgreSQL ;
- build API ;
- build Web ;
- build Mobile ;
- tests unitaires ;
- E2E existants.

## Prochains blocs

- ordonnanceur distribué ;
- push mobile ;
- email de résumé ;
- tableau de bord graphique ;
- verrou multi-région ;
- métriques OpenTelemetry ;
- résumé hebdomadaire ;
- regroupement configurable par structure.
