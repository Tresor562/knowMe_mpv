# Créateurs et audience KnowMe

## Objectif

KMD-051 fournit une fondation volontaire pour les personnes qui souhaitent publier sous une identité de créateur, être suivies et consulter des indicateurs minimisés. Ce domaine ne transforme jamais un compte en membre de l’Équipe KnowMe et n’accorde ni vérification, ni Premium, ni droit administratif.

## Séparation des identités

`CreatorProfile` est une capacité sociale attachée à un compte existant. Le profil possède un slug public stable, un titre, une présentation, une catégorie, une visibilité, un état et une version optimiste.

Les dimensions suivantes restent indépendantes :

- rôle et permissions staff ;
- vérification d’identité ;
- Premium et achats ;
- suspension du compte ;
- statut du profil créateur.

Les réponses publiques déclarent explicitement que le mode créateur n’accorde aucun de ces privilèges.

## Activation et concurrence

L’activation est volontaire. La première écriture utilise `expectedVersion: 0`. Toute modification ultérieure doit fournir la version courante.

Le serveur utilise une transaction sérialisable. Un conflit renvoie `CREATOR_VERSION_CONFLICT`. Le slug est unique et normalisé côté client, puis validé côté serveur par une expression stricte.

Un profil peut être actif ou en pause par son propriétaire. Seule la gouvernance autorisée peut produire l’état `SUSPENDED`.

## Abonnements

`CreatorFollow` est directionnel et distinct des amitiés. La paire créateur/abonné est unique.

Suivre une seconde fois rejoue le résultat sans augmenter le compteur ni émettre une seconde notification. Se désabonner est également idempotent. Le compteur matérialisé est modifié dans la même transaction que le graphe d’abonnement.

Un compte ne peut pas suivre son propre profil. Un compte suspendu ne peut pas créer un abonnement.

## Page publique et publications épinglées

La page publique n’est disponible que lorsque le profil est actif et le compte utilisable. Elle expose uniquement les champs publics du compte, les publications récentes et jusqu’à trois positions d’épinglage.

Une publication ne peut être épinglée que par son auteur. Le déplacement vers une position déjà occupée remplace atomiquement l’ancien pin.

La visibilité `UNLISTED` signifie que la page reste accessible par son slug mais doit être exclue des futurs annuaires et recommandations.

## Mesure respectueuse de l’audience

Les vues ne comptent que les comptes authentifiés. Les vues anonymes ne sont pas transformées en empreintes d’adresse IP ou d’appareil.

Pour chaque jour UTC, l’identifiant du visiteur est transformé par HMAC avec un secret serveur. La base ne stocke pas l’identifiant brut dans les reçus de mesure. La contrainte unique empêche un même compte de gonfler plusieurs fois la même métrique quotidienne pour un créateur.

Les reçus expirent après 35 jours. `CreatorMetricsRetentionService` supprime les éléments expirés par lots bornés, avec un intervalle configurable et un verrou local anti-chevauchement.

Le tableau de bord expose des agrégats sur 30 jours : vues de profil, vues de contenu, abonnements gagnés, désabonnements, publications, likes et commentaires. Aucun détail nominatif de visite n’est exposé.

Configuration de production obligatoire :

- `CREATOR_METRICS_HASH_SECRET` : secret fort et distinct ;
- `CREATOR_METRICS_RETENTION_ENABLED` : `true` par défaut ;
- `CREATOR_METRICS_RETENTION_INTERVAL_MS` : 6 heures par défaut, borné entre 1 minute et 24 heures.

## Gouvernance

La permission `creators.manage` autorise la suspension et la restauration du profil créateur. Elle est distincte de `users.suspension.manage`.

Une suspension exige une raison. La restauration place le profil en pause afin que le propriétaire choisisse explicitement de le réactiver. Chaque action crée une entrée d’audit.

La modération des publications et les signalements restent régis par les systèmes existants ; KMD-051 ne crée pas de file parallèle.

## Export et suppression

L’export de compte passe en version 12 uniquement lorsqu’il existe un profil, un abonnement entrant/sortant, un pin ou une métrique. Il inclut les agrégats et relations du compte, mais jamais les HMAC des reçus de vue.

La suppression du compte retire dans la même transaction :

- reçus et agrégats du créateur ;
- pins ;
- abonnements entrants et sortants ;
- profil créateur ;
- ajustement des compteurs des créateurs suivis.

## Hors périmètre

Cette fondation ne comprend pas : revenus, commissions, codes promotionnels, campagnes de marque, abonnements payants, lives, cadeaux monétisés, partage publicitaire ou paiements créateurs. Ces fonctionnalités exigent des KMD séparés avec conformité financière, anti-fraude et gouvernance dédiées.
