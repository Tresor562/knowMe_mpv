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

## Prochaine livraison réservée

`KMD-016` est réservé au feedback autoritaire et à l’historique des défis V2.

Cette livraison appartient à la Phase 6 de la Product Roadmap V2 et dépend uniquement de systèmes déjà fusionnés : versioning des défis, récompenses, audit, confidentialité et anti-spam.

## Règles de mise à jour

Après chaque fusion majeure :

1. ajouter la livraison à ce tableau ;
2. enregistrer la PR et le domaine exact ;
3. réserver le prochain identifiant seulement après validation du périmètre ;
4. ne jamais réutiliser un identifiant `KMD` ;
5. conserver les anciens labels comme alias historiques, sans les présenter comme identifiants canoniques.