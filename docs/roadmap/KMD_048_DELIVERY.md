# KMD-048 — Centre de notifications intelligent

## État

Livraison reconstruite depuis le `main` contenant KMD-036, KMD-046 et KMD-047. Elle remplace l’ancien prototype numéroté KMD-046 sans dupliquer les transports externes.

## Livré

### Gouvernance

- huit catégories stables ;
- Sécurité et Système toujours visibles et instantanés ;
- activation globale ;
- activation temps réel ;
- modes instantané, horaire, quotidien et centre uniquement ;
- heure quotidienne explicite ;
- heures calmes traversant minuit ;
- fuseau IANA validé ;
- types et cercles masqués ;
- règle la plus restrictive appliquée côté serveur.

### Centre

- vues actives, reportées, archivées et masquées ;
- pagination stable par curseur après filtrage ;
- poursuite possible au travers de longues zones filtrées ;
- compteur non lu calculé après politique et état ;
- regroupement uniquement explicite ou collectif ;
- fenêtre de regroupement horaire ;
- actions masquer, archiver, reporter et restaurer ;
- interdiction de masquer une alerte critique ;
- reçus d’action idempotents ;
- restauration non destructive ;
- marquage individuel et global des événements visibles.

### Résumés in-app

- file atomique créée avec la notification standard ;
- compatibilité avec les notifications créées dans une transaction métier ;
- fenêtres horaires et quotidiennes locales ;
- réclamation multi-instance par jeton ;
- une synthèse par utilisateur et fenêtre ;
- récupération des traitements bloqués ;
- cinq tentatives bornées ;
- fermeture propre des éléments dont la source a été supprimée ;
- notification `NOTIFICATION_DIGEST` sans boucle de résumé ;
- ordonnanceur configurable et dashboard administrateur.

### Web

- quatre vues ;
- pagination sans réinitialisation ;
- préférences globales ;
- catégories essentielles verrouillées ;
- modes, heure quotidienne, heures calmes et fuseau ;
- regroupements, actions et temps réel ;
- aucun secret ni faux réglage de fournisseur.

### Mobile

- composant réutilisable `NotificationCenterExperience` ;
- quatre vues et restauration ;
- actions idempotentes ;
- catégories, modes, horaires et fuseau ;
- temps réel ;
- navigation déléguée au shell ;
- aucune règle de visibilité locale et aucun secret de transport.

### Vie privée et exploitation

- export du centre dans l’export de compte version 9 ;
- suppression de toutes les données KMD-048 dans la transaction de suppression du compte ;
- aucun endpoint, jeton, e-mail ou secret de transport stocké ;
- nettoyage administrateur borné ;
- éléments traités conservés 30 jours ;
- reçus et lots conservés 180 jours ;
- architecture et variables documentées.

### Validation prévue

- génération Prisma ;
- synchronisation PostgreSQL ;
- builds API, Web et Mobile ;
- tests unitaires des politiques, temps, fuseaux et regroupements ;
- E2E des préférences, critiques, états, idempotence, résumés, pagination, export et suppression ;
- E2E historiques du dépôt.

## Garanties

- aucune duplication du registre d’endpoints KMD-046 ;
- aucune duplication des circuits, quotas ou webhooks KMD-047 ;
- aucun secret de transport exposé ;
- aucun événement critique supprimé par préférence ;
- aucune action utilisateur ne détruit l’événement d’audit ;
- aucun résumé vide créé ;
- aucun état KMD-048 ne survit à la suppression du compte.
