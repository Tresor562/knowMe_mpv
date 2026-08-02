# KMD-022 — Coffre quotidien déterministe

## Objectif

Le coffre quotidien transforme la quête du jour en une récompense légère sans reproduire les mécanismes de hasard, de pression ou de paiement associés aux loot boxes.

## Éligibilité

Le serveur autorise une ouverture uniquement lorsque la quête `daily_challenge_explorer` du même jour UTC possède le statut `COMPLETED`.

Les données du client, un bouton modifié, Premium, un achat ou une valeur locale ne peuvent pas rendre le coffre éligible.

## Récompense fixe

Chaque coffre crédite exactement 10 KnowCoins.

- aucun tirage aléatoire ;
- aucune rareté ;
- aucun multiplicateur ;
- aucun boost Premium ;
- aucun achat requis ;
- aucune pénalité en cas de jour manqué ;
- aucun effet sur les séries.

## Atomicité

Une transaction PostgreSQL sérialisable réalise ensemble :

1. la vérification de la quête ;
2. l’écriture dans le registre KnowCoins ;
3. la création du reçu `DailyChestClaim` ;
4. l’écriture d’audit.

La clé d’idempotence est dérivée du compte et du jour UTC. La contrainte unique `(userId, claimDate)` interdit une seconde attribution.

Les doubles clics, rejeux et requêtes concurrentes retournent le reçu existant sans modifier une seconde fois le solde.

## Cycle de vie

- statut via `GET /daily-chest/today` ;
- ouverture via `POST /daily-chest/claim` ;
- aucun montant accepté depuis le client ;
- reçu inclus dans l’export de compte v6 ;
- suppression du reçu et de l’écriture comptable avec le compte.
