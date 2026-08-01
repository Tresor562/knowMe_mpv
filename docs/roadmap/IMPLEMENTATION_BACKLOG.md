# KnowMe — Implementation Backlog

## Priorité P0 — À construire avant les fonctions commerciales

### KM-001 — Feature flags serveur

**But :** activer progressivement les fonctions sensibles.

**Livrables :**

- modèle Prisma ;
- service d’évaluation ;
- cache court ;
- endpoint client limité ;
- écran administrateur ;
- audit ;
- tests de plateforme, pays, version, override et pourcentage.

**Terminé lorsque :** un flag peut être activé pour un utilisateur test, puis désactivé globalement sans déploiement.

### KM-002 — Request IDs et audit enrichi

**But :** relier une action utilisateur, ses événements et ses erreurs.

**Livrables :** middleware de corrélation, format d’erreur stable, journal d’actions sensibles, masquage des secrets.

**Terminé lorsque :** une erreur signalée peut être retrouvée à partir d’un identifiant affiché au client.

### KM-003 — StaffAccount

**But :** supprimer toute dépendance à des e-mails codés en dur.

**Livrables :** modèle, service, permissions, badge Équipe KnowMe, activation, révocation, audit, interface admin et E2E.

**Terminé lorsque :** un administrateur autorisé peut ajouter ou révoquer un compte staff sans modification de code.

### KM-004 — RBAC et permissions

**But :** remplacer le rôle unique par des capacités explicites.

**Livrables :** rôles, permissions, garde NestJS, décorateur, migration du rôle existant et tests.

**Terminé lorsque :** chaque route administrative sensible possède une permission documentée et testée.

---

## Priorité P1 — Confiance et commercial

### KM-005 — Vérification d’identité

Workflow de demande, documents via stockage sécurisé, examen, décision, expiration, révocation et recours. Aucun paiement ne valide automatiquement une demande.

### KM-006 — Entitlements

Plans, droits, attribution temporaire, expiration, état de grâce, vérification API et affichage client.

### KM-007 — Adaptateur de paiement

Interface indépendante du prestataire, environnement sandbox, webhooks signés, déduplication, factures et rapprochement.

---

## Priorité P1 — Économie

### KM-008 — Wallet ledger

Créer wallets, écritures, idempotence, compensations, historique et migration des soldes actuels.

### KM-009 — Reward service

Centraliser XP, KnowCoins, quêtes et bonus. Une source métier ne peut récompenser qu’une fois une même référence.

### KM-010 — Fraude économique

Limites, vélocité, anomalies, blocage temporaire, revue manuelle et alertes sur divergences.

---

## Priorité P1 — Cœur produit

### KM-011 — Challenge versioning

Séparer défi public, versions immuables, sessions et réponses. Migrer les défis actuels vers une version initiale.

### KM-012 — Challenge feedback

Événements bonne/mauvaise réponse, score caché configurable, vibration et animations accessibles.

### KM-013 — Historique des défis

Résultats, relecture, partage, mode Nostalgie futur et suppression respectueuse des politiques de données.

---

## Priorité P2 — Plateforme visuelle

### KM-014 — Experience Engine minimal

Contrat commun Web/Mobile, préférences, fallback, file d’animations et cinq événements initiaux.

### KM-015 — Catalogue d’assets Concept K

Manifestes versionnés, personnages originaux, variantes, rareté, poids et compatibilité plateforme.

### KM-016 — Budget performance

Mesures FPS, taille, mémoire, temps de chargement et désactivation automatique des variantes lourdes.

---

## Priorité P2 — Internationalisation et médias

### KM-017 — i18n Web et Mobile

Extraction des chaînes, français et anglais initiaux, pluriels, dates, RTL préparé et stratégie de fallback.

### KM-018 — Codes d’erreur localisables

Codes stables API et traduction côté client.

### KM-019 — MediaStorage

Abstraction stockage, validation MIME, antivirus, miniatures, URLs signées, quotas et suppression.

### KM-020 — Préférences de téléchargement

Wi-Fi, mobile, types de médias, cache, nettoyage et espace utilisé.

---

## Priorité P3 — Catalogue et personnalisation

### KM-021 — CatalogItem et InventoryItem

Types, raretés, collections, offres, possessions, équipement et expiration.

### KM-022 — Thèmes statiques

Clair, sombre, automatique, puis premiers thèmes Premium sans animation lourde.

### KM-023 — Icônes alternatives

Catalogue par plateforme, disponibilité saisonnière et restauration de l’icône classique.

### KM-024 — Cadeaux V1

Achat en KnowCoins, envoi, message, notification, vitrine et transaction atomique.

---

## Priorité P3 — Gamification

### KM-025 — XP et niveaux

Barème serveur, journal, niveaux et événements de progression.

### KM-026 — Quêtes

Quêtes quotidiennes et hebdomadaires, progression idempotente et récupération atomique.

### KM-027 — Badges et titres

Définitions, déblocage, affichage profil et rareté.

### KM-028 — Classements responsables

Amis et communautés avant classement mondial, opt-out et protections contre la fraude.

---

## Priorité P4 — Communautés, créateurs et jeux

### KM-029 — Communautés

Public/privé, rôles, adhésion, publications, modération et notifications.

### KM-030 — Mode Créateur

Followers, statistiques, page publique et contenu épinglé.

### KM-031 — Game Platform

Adaptateur de jeux, serveur autoritaire, parties, actions, résultats et replays.

### KM-032 — Jeu d’affinité

Version ludique, résultat explicable, confidentialité et carte partageable.

### KM-033 — Tournois

Inscriptions, brackets, équipes, abandons, résultats et modération.

### KM-034 — Arena avec mises

Bloqué tant que les validations juridique, âge, territoire, fraude et litiges ne sont pas obtenues.

---

## Politique de sélection du prochain ticket

Le prochain ticket doit :

- dépendre uniquement de systèmes déjà fusionnés ;
- posséder une migration ou stratégie de retour arrière ;
- inclure tests unitaires et E2E ;
- ne pas mélanger plusieurs domaines risqués dans une même PR ;
- être activable progressivement si son impact est important.

Le premier bloc de code recommandé après cette documentation est **KM-001 à KM-004**.