# KMD-046 — Centre de notifications intelligent

## Livré

### Persistance

- préférences globales ;
- catégories activables ;
- heures calmes ;
- modes de résumé ;
- types et cercles muets ;
- états Masqué, Archivé et Reporté ;
- actions idempotentes ;
- références d’appareils push sans exposition du jeton brut.

### Domaine

- classification des notifications ;
- catégories Sécurité et Système essentielles ;
- fenêtres silencieuses traversant minuit ;
- résolution centre / temps réel / push / résumé ;
- regroupement collectif ;
- normalisation stricte des préférences.

### API

- centre filtré et regroupé ;
- compteur non lu cohérent ;
- modification des préférences ;
- actions sur les notifications ;
- gestion des références d’appareils ;
- diffusion temps réel soumise aux préférences globales.

### Web

- centre intelligent ;
- statut de connexion temps réel ;
- groupes d’alertes ;
- actions groupées ;
- panneau de préférences ;
- heures calmes ;
- catégories essentielles ;
- transparence sur l’absence de fournisseur push.

### Mobile

- composant `NotificationCenterExperience` ;
- rafraîchissement temps réel ;
- lecture, report, archivage et masquage ;
- réglages essentiels ;
- aucun ajout prématuré d’une dépendance push.

## Garanties

- les KnowCoins et informations financières ne sont jamais inclus dans le centre ;
- les alertes critiques restent visibles ;
- les jetons push bruts ne sont pas retournés ;
- le compteur est calculé après filtrage serveur ;
- les actions utilisateur ne détruisent pas l’événement d’origine ;
- les files collectives KMD-044/KMD-045 restent la source de vérité pour la planification, les reprises et résumés collectifs.

## Bloc suivant recommandé

KMD-047 — Profils Duo visuels et arbre familial interactif :

- couvertures Duo fusionnées ;
- portraits complémentaires ;
- transition horizontale ;
- bios liées ;
- arbre familial graphique ;
- scènes Équipe et Guilde ;
- animations respectant les réglages d’accessibilité ;
- versions Web et Mobile.

## Limites déclarées

- push natif non activé ;
- worker de résumé global non livré ;
- pagination historique non livrée ;
- composant mobile non encore relié à la navigation principale ;
- restauration des archives sans écran dédié ;
- aucune promesse de livraison hors ligne sans fournisseur push.
