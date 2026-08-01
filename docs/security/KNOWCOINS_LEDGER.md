# Registre comptable KnowCoins

Le nombre affiché par un client KnowMe n’est jamais une autorité. Le solde officiel est conservé dans `KnowCoinWallet` et chaque modification produit une entrée immuable dans `KnowCoinLedgerEntry`.

## Règles comptables

Une écriture conserve obligatoirement :

- l’`accountId` concerné ;
- le montant signé ;
- le solde avant l’opération ;
- le solde après l’opération ;
- le type et la source ;
- une clé d’idempotence unique ;
- l’acteur serveur ou administratif ;
- la référence métier ;
- la justification et la date.

Le service refuse les montants nuls, non entiers, trop élevés et tout débit qui produirait un solde négatif.

## Idempotence

Chaque récompense, achat, remboursement, webhook ou ajustement doit posséder une clé stable créée par le serveur ou par le prestataire vérifié. Rejouer exactement la même clé retourne l’écriture existante sans modifier le solde. Réutiliser cette clé avec un autre compte ou un autre montant est rejeté.

Exemples de clés futures :

```text
challenge-complete:<participantId>
purchase:<provider>:<transactionId>
daily-reward:<accountId>:<date>
gift:<giftTransactionId>
```

## Atomicité et concurrence

Le portefeuille, le cache temporaire `User.knowCoins` et l’entrée de registre sont modifiés dans une transaction PostgreSQL sérialisable. Les conflits de concurrence sont retentés de façon limitée. La contrainte unique sur la clé d’idempotence constitue la dernière défense contre les doubles crédits simultanés.

## Compatibilité

`User.knowCoins` reste temporairement synchronisé pour les écrans historiques. Les réponses de profil privilégient toujours `KnowCoinWallet.balance`. Les anciens comptes sans portefeuille sont initialisés une seule fois depuis leur ancien compteur lors du premier accès.

## Administration

Les ajustements exigent la permission `wallet.manage`, un `accountId`, un montant, une clé d’idempotence et une justification. Ils sont journalisés avec le request ID et le compte cible. Aucun endpoint utilisateur ne permet de définir ou d’incrémenter directement son solde.

## Évolutions prévues

Le même service devra être utilisé par les quêtes, coffres, cadeaux, marketplace, publicités récompensées et achats. Aucun de ces modules ne devra modifier directement `KnowCoinWallet`, `KnowCoinLedgerEntry` ou `User.knowCoins`.
