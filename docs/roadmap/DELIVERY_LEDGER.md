# KnowMe — Registre canonique des livraisons

## Objectif

Ce registre distingue les identifiants historiques du backlog des identifiants réels de livraison.

Les anciens documents ont utilisé plusieurs fois des labels comme `KM-013`, `KM-014` ou `KM-015` pour des périmètres différents. Ces labels restent conservés dans les anciennes PR et dans les documents historiques, mais ne doivent plus être utilisés pour nommer un nouveau chantier.

## Convention

- `KMB-###` : élément conceptuel du backlog historique (`IMPLEMENTATION_BACKLOG.md`).
- `KMD-###` : livraison effectivement développée, validée par CI et fusionnée.
- les titres historiques des PR restent inchangés afin de préserver la traçabilité Git.
- toute nouvelle PR majeure doit indiquer son identifiant `KMD-###`, sa phase produit et ses dépendances déjà fusionnées.

## Livraisons fusionnées

| Livraison | Domaine | Pull request | État |
| --- | --- | --- | --- |
| KMD-001 | Feature flags serveur | #21 | Fusionnée |
| KMD-002 | Request IDs, erreurs stables et audit | #24 | Fusionnée |
| KMD-003 | Comptes officiels Équipe KnowMe | #25 | Fusionnée |
| KMD-004 | RBAC et permissions granulaires | #26 | Fusionnée |
| KMD-005 | Identité de compte et entitlements | #23 | Fusionnée |
| KMD-006 | Registre comptable KnowCoins | #28 | Fusionnée |
| KMD-007 | Moteur de récompenses anti-abus | #30 | Fusionnée |
| KMD-008 | Défis versionnés et immuables | #32 | Fusionnée |
| KMD-009 | Facturation et Premium autoritaires | #34 | Fusionnée |
| KMD-010 | Vérification d’identité et badges séparés | #36 | Fusionnée |
| KMD-011 | Sécurité des comptes, 2FA et appareils fiables | #40 | Fusionnée |
| KMD-012 | Confidentialité, consentements et conservation | #45 | Fusionnée |
| KMD-013 | Intégrité applicative et validation des achats | #44 | Fusionnée |
| KMD-014 | Pipeline média privé et sécurisé | #46 | Fusionnée |
| KMD-015 | Anti-spam persistant et modération traçable | #47 | Fusionnée |
| KMD-016 | Feedback autoritaire et historique immuable des défis V2 | #49 | Fusionnée |
| KMD-017 | Registre XP et niveaux autoritaires | #50 | Fusionnée |
| KMD-018 | Séries d’activité saines | #51 | Fusionnée |
| KMD-019 | Quêtes quotidiennes autoritaires | #52 | Fusionnée |
| KMD-020 | Badges et titres autoritaires | #54 | Fusionnée |
| KMD-021 | Classement XP hebdomadaire limité et volontaire | #55 | Fusionnée |
| KMD-022 | Coffre quotidien déterministe | #56 | Fusionnée |
| KMD-023 | Positive Challenges autoritaires | #58 | Fusionnée |
| KMD-024 | Fondation d’animation Concept K | #59 | Fusionnée |
| KMD-025 | Catalogue d’assets originaux Concept K | #60 | Fusionnée |
| KMD-026 | Santé, quarantaine et fallback des assets Concept K | #61 | Fusionnée |
| KMD-027 | Catalogue cosmétique, inventaire autoritaire et équipement visuel | #63 | Fusionnée |
| KMD-028 | Boutique cosmétique KnowCoins et acquisitions idempotentes | #64 | Fusionnée |
| KMD-029 | Rendu public contrôlé des équipements cosmétiques | #65 | Fusionnée |
| KMD-030 | Presets cosmétiques et thèmes de profil synchronisés | #66 | Fusionnée |
| KMD-031 | Moteur de 100 thèmes et d’identité visuelle Web/Mobile | #67 | Fusionnée |
| KMD-032 | Orchestration de paiements Flutterwave, CinetPay, Google Play et Apple | #68 | Fusionnée |
| KMD-033 | Interfaces clientes de paiement Web et Mobile | #69 | Fusionnée |

## Livraison en validation

| Livraison | Domaine | Pull request | État |
| --- | --- | --- | --- |
| KMD-034 | Cadeaux sociaux visuels et KnowCoins atomiques | #70 | Build, tests, E2E, confidentialité, concurrence et clients Web/Mobile requis avant fusion |

## Prochaine livraison réservée

Aucun identifiant après `KMD-034` n’est réservé avant sa fusion verte.

KMD-034 est limité aux cadeaux sociaux purement visuels entre amitiés acceptées. Le prix est autoritaire côté serveur, le débit utilise le registre KnowCoins, le destinataire ne reçoit aucun solde, et le cadeau ne peut être revendu, transféré, converti en argent ou utilisé pour attribuer un avantage de jeu.

Les prochains candidats restent notamment le studio d’avatars, la marketplace de stickers, les publicités récompensées, les groupes et chaînes, ainsi que la messagerie enrichie. Ils ne sont pas implicitement inclus dans KMD-034.

Les rôles et badges Équipe KnowMe restent régis par RBAC et les comptes officiels. Aucun achat, cadeau ou webhook de paiement ne peut attribuer un rôle de staff, un badge Équipe KnowMe ou une permission administrative.

## Règles de mise à jour

Après chaque fusion majeure :

1. ajouter la livraison au tableau des livraisons fusionnées ;
2. enregistrer la PR et le domaine exact ;
3. réserver le prochain identifiant seulement après validation du périmètre ;
4. ne jamais réutiliser un identifiant `KMD` ;
5. conserver les anciens labels comme alias historiques, sans les présenter comme identifiants canoniques.
