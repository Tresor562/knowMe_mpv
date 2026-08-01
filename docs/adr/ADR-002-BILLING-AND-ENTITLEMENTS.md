# ADR-002 — Abonnements, paiements et droits

- **Statut :** Accepté pour architecture future
- **Date :** 2026-08-01

## Contexte

Premium, vérification, stockage, IA et cosmétiques ont des règles différentes. Un champ `isPremium` ne permet pas de gérer essais, annulations, périodes de grâce, achats sur plusieurs plateformes ou avantages temporaires.

## Décision

1. Les fonctionnalités consultent des `entitlements` centralisés.
2. Les plans et prix sont séparés des droits.
3. Les abonnements conservent leur prestataire, identifiant externe et historique d’événements.
4. Les webhooks sont signés, idempotents et traités même s’ils arrivent dans le désordre.
5. Les avantages temporaires utilisent une date de début et de fin.
6. La vérification d’identité reste indépendante de l’abonnement.
7. Les données complètes de carte ne sont jamais stockées par KnowMe.

## Modèle indicatif

```text
BillingProduct
BillingPrice
Subscription
SubscriptionEvent
Invoice
PaymentTransaction
EntitlementDefinition
UserEntitlement
```

## Exemple

Un abonnement Premium actif peut produire :

```text
themes.premium
icons.premium
ai.advanced
storage.extended
reactions.animated
```

Le client peut afficher les avantages, mais l’API vérifie le droit avant toute action protégée.

## Conséquences

- changement de prestataire possible ;
- avantages testables sans paiement réel ;
- meilleure prise en charge Web, App Store, Play Store et Mobile Money ;
- complexité supplémentaire dans la synchronisation.

## Mesures

- simulateur de facturation en développement ;
- tests de répétition de webhook ;
- rapprochement périodique ;
- feature flag d’arrêt d’urgence ;
- journal d’audit des corrections manuelles.