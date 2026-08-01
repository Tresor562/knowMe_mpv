# Moteur de récompenses KnowMe

Les récompenses ne sont jamais déclenchées par une valeur envoyée par le Web ou l’APK. Le client soumet uniquement l’action métier normale, par exemple les réponses d’un défi. L’API vérifie ensuite l’événement, applique une politique persistée et écrit la récompense dans le registre KnowCoins.

## Politiques versionnées

`RewardPolicy` conserve la règle exacte appliquée :

- clé et numéro de version ;
- type d’événement ;
- montant unitaire ;
- plafond quotidien par compte ;
- maximum par entité ;
- critères métier comme le nombre minimum de questions ;
- fenêtre d’activation ;
- auteur et justification.

Une modification importante crée une nouvelle version. Les événements passés restent liés à leur ancienne version et demeurent explicables.

## Journal des décisions

Chaque première évaluation crée un `RewardEvent` :

- `AWARDED` lorsque le crédit est validé ;
- `REJECTED` lorsqu’une limite anti-abus est atteinte ;
- `IGNORED` lorsque l’événement n’est pas éligible.

Le journal conserve le compte, l’entité métier, la politique, le montant, le code de décision, l’explication et l’entrée du registre comptable lorsqu’un crédit existe.

## Idempotence

La complétion d’un défi utilise une clé déterministe basée sur l’identifiant immuable du participant :

```text
reward:challenge-completion:<participantId>
```

L’écriture comptable utilise une clé dérivée distincte. Deux requêtes simultanées, une reconnexion, une modification de réponses ou le rejeu d’une requête ne créent donc ni second événement ni second crédit.

## Atomicité

L’évaluation anti-abus, le calcul du plafond journalier, la modification du portefeuille, l’entrée de ledger et le `RewardEvent` sont exécutés dans une transaction PostgreSQL sérialisable. Un conflit de concurrence est retenté de façon limitée.

## Première règle : complétion de défi

La politique initiale crédite 25 KnowCoins, avec un plafond de 100 KnowCoins par jour et un minimum de trois questions. Le participant doit :

1. avoir rejoint le défi ;
2. répondre à toutes les questions pendant que le défi est actif ;
3. ne pas être le créateur ;
4. ne pas avoir déjà reçu la récompense pour ce défi ;
5. rester sous le plafond journalier.

Le créateur peut répondre à son propre défi, mais l’événement est enregistré comme `IGNORED` avec le code `SELF_CHALLENGE`.

## Administration

La permission `rewards.manage` protège la lecture globale des événements, la création de nouvelles versions et l’activation ou la désactivation d’une politique. Toute modification est auditée. Les interfaces clientes peuvent masquer les contrôles, mais l’API revérifie la permission à chaque action.

## Extension

Les futures quêtes, coffres, streaks, cadeaux, publicités récompensées et programmes communautaires devront produire leurs propres événements métier et politiques. Ils ne devront jamais incrémenter directement `User.knowCoins` ou `KnowCoinWallet.balance`.
