# ADR-003 — Registre KnowCoins

- **Statut :** Accepté pour architecture future
- **Date :** 2026-08-01

## Contexte

Un simple entier `knowCoins` ne suffit pas pour expliquer les gains, empêcher les doubles crédits, gérer les achats, remboursements, cadeaux, commissions et futures réservations de mise.

## Décision

1. Le solde provient d’un registre d’écritures immuables.
2. Chaque écriture possède une référence métier unique.
3. Une erreur est corrigée par une écriture compensatrice, jamais par suppression.
4. Débit et crédit liés sont effectués dans une transaction.
5. Les récompenses sont idempotentes.
6. Les réservations sont distinctes du solde disponible.
7. Le solde mis en cache doit toujours pouvoir être recalculé.

## Modèle indicatif

```text
Wallet
- id
- userId
- availableBalance
- reservedBalance

WalletEntry
- id
- walletId
- amount
- operationType
- referenceType
- referenceId
- idempotencyKey
- metadata
- createdAt

WalletReservation
WalletTransfer
```

## Migration

1. créer un wallet par utilisateur ;
2. ajouter une écriture d’ouverture égale au solde historique ;
3. vérifier la cohérence ;
4. basculer les récompenses vers le ledger ;
5. interdire les modifications directes du champ historique ;
6. supprimer ce champ après observation et migration complète.

## Conséquences

- historique explicable ;
- achats et cadeaux atomiques ;
- meilleure détection de fraude ;
- coût supplémentaire de stockage et de requêtes.

## Mesures

- index sur références et clés d’idempotence ;
- tests de concurrence ;
- alerte sur divergence ;
- outil administrateur de compensation avec justification obligatoire.