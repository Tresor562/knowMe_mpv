# ADR-005 — Feature flags et livraison progressive

- **Statut :** Accepté pour architecture future
- **Date :** 2026-08-01

## Contexte

Premium, paiements, IA, marketplace, jeux, animations lourdes et fonctions expérimentales doivent pouvoir être activés progressivement ou arrêtés sans publier une nouvelle version de tous les clients.

## Décision

1. Les fonctionnalités importantes sont protégées par des feature flags évalués côté serveur.
2. Les clients peuvent recevoir un aperçu des flags utiles à l’interface, mais ne prennent aucune décision de sécurité.
3. Les règles peuvent cibler plateforme, version, pays, cohorte, pourcentage ou utilisateur de test.
4. Les fonctions sensibles possèdent un arrêt d’urgence.
5. Les changements de flags sensibles sont audités.
6. Un flag temporaire possède un propriétaire et une date de révision.
7. Un flag ne remplace pas une permission ou un entitlement.

## Modèle indicatif

```text
FeatureFlag
- key
- description
- enabled
- riskLevel
- owner
- reviewAt

FeatureFlagRule
- flagId
- platform
- country
- minVersion
- rolloutPercentage
- audience

FeatureFlagOverride
- flagId
- userId
- enabled
- expiresAt
```

## Ordre d’évaluation

1. arrêt global ;
2. compatibilité de version ;
3. règles territoriales ;
4. override explicite ;
5. cohorte ;
6. pourcentage stable basé sur l’utilisateur ;
7. valeur par défaut.

## Conséquences

- déploiements plus sûrs ;
- tests privés ;
- limitation par pays ;
- possibilité d’arrêter une intégration défaillante ;
- risque d’accumulation de flags obsolètes.

## Mesures

- inventaire des flags ;
- date d’expiration ;
- suppression après stabilisation ;
- tests de valeur activée et désactivée ;
- métriques séparées par cohorte.