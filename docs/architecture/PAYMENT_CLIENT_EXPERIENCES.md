# KMD-033 — Interfaces clientes de paiement Web et Mobile

## Objectif

KMD-033 rend le socle KMD-032 utilisable depuis les applications KnowMe sans déplacer l’autorité financière vers le client.

Cette livraison ajoute :

- un catalogue Web filtrable par pays et devise ;
- la création idempotente de paiements Flutterwave et CinetPay ;
- un écran de retour fournisseur qui exige une vérification serveur ;
- l’historique et le détail des commandes ;
- un client Mobile pour Google Play et Apple App Store ;
- un contrat de pont natif qui interdit les preuves saisies manuellement ;
- l’affichage Mobile du catalogue et des commandes récentes ;
- les points d’entrée depuis les profils Web et Mobile.

KMD-033 ne crée aucun second moteur de paiement, portefeuille, abonnement, entitlement ou attribution.

## Dépendance autoritaire

KMD-033 dépend de KMD-032.

Les sources de vérité restent :

- `CommerceProduct` pour le produit ;
- `CommercePrice` pour le tarif ;
- `PaymentOrder` pour la commande ;
- les adaptateurs fournisseur pour la vérification ;
- `PaymentFulfillmentService` pour la livraison ;
- le registre KnowCoins, Billing et Entitlements pour les effets métier.

Le client ne fournit jamais :

- un montant arbitraire ;
- une devise non proposée par le catalogue ;
- un produit inconnu ;
- un statut de paiement réussi ;
- une attribution Premium, KnowCoins ou entitlement ;
- un rôle staff ou une permission administrative.

## Parcours Web

### Catalogue

Le navigateur appelle :

```text
GET /payments/catalog?platform=WEB&country=XX&currency=XXX
GET /payments/providers
```

Le serveur retourne uniquement les produits et prix actifs. Le bouton d’achat est désactivé si le fournisseur n’est pas complètement configuré.

### Création de commande

Le navigateur envoie :

```text
POST /payments/checkout
Idempotency-Key: checkout:<provider>:<product>:<nonce>
```

Le corps contient la clé produit, le fournisseur et les informations facultatives de facturation. Aucun montant client n’est accepté.

L’identifiant de commande est conservé temporairement dans `sessionStorage` avant la redirection vers le fournisseur. Cette valeur sert uniquement à retrouver la commande au retour ; elle n’autorise aucune livraison.

### Retour fournisseur

La page `/payments/return` :

1. retrouve la commande créée ;
2. récupère l’identifiant de transaction lorsqu’il est présent dans l’URL ;
3. demande explicitement la vérification serveur ;
4. affiche le statut retourné par KnowMe.

Le retour navigateur n’est jamais considéré comme une preuve. La livraison dépend toujours de :

```text
POST /payments/orders/:id/verify
```

Le serveur compare la référence, le montant et la devise avec la transaction du fournisseur.

### Historique

Les vues Web utilisent :

```text
GET /payments/me/orders
GET /payments/me/orders/:id
```

Elles affichent les tentatives, la facture et les remboursements déjà filtrés par le serveur. Les secrets, preuves mobiles chiffrées et réponses brutes fournisseur restent absents du contrat public.

## Parcours Mobile

### Catalogue par plateforme

Android demande le catalogue `ANDROID` et iOS le catalogue `IOS`.

Un produit n’est achetable que si :

- un `externalProductId` existe ;
- le fournisseur correspond à la plateforme ;
- le fournisseur serveur est configuré ;
- le pont d’achat natif signé est installé ;
- une référence de compte serveur a été obtenue.

### Référence de compte

Le client récupère :

```text
GET /payments/store/account-reference?provider=GOOGLE_PLAY
GET /payments/store/account-reference?provider=APPLE_APP_STORE
```

Cette référence doit être transmise au SDK natif comme identifiant de compte obfusqué ou équivalent fournisseur. Elle permet au serveur de vérifier que la preuve appartient au compte KnowMe attendu.

### Pont natif

`native-purchases.ts` définit un contrat minimal :

```ts
registerNativePurchaseBridge({
  isAvailable,
  purchase
});
```

Le pont réel devra être fourni par l’intégration native Google Play Billing ou StoreKit. Il retourne uniquement :

- le `purchaseToken` Google Play ; ou
- le `transactionId` Apple ;
- l’identifiant externe exact du produit.

L’interface KnowMe ne propose aucun champ permettant à l’utilisateur de coller une preuve, un reçu ou un jeton.

Sans pont natif, les boutons restent désactivés. Le client ne simule jamais un succès.

### Vérification Mobile

Après l’achat natif, le client envoie la preuve à :

```text
POST /payments/store/verify
```

Le serveur :

1. résout le produit et le tarif autoritaires ;
2. chiffre la preuve au repos ;
3. interroge Google Play ou Apple ;
4. vérifie le compte, le produit et l’état ;
5. exécute la livraison atomique ;
6. accuse réception Google lorsque les conditions sont réunies.

## Idempotence

Le Web génère une clé d’idempotence par tentative de création de commande. Une répétition avec la même clé doit retourner la même commande et ne peut pas changer de compte, produit ou fournisseur.

Sur Mobile, l’empreinte de la preuve fournisseur produit la clé d’idempotence serveur. Une preuve réutilisée pour un autre compte ou produit déclenche un signal de fraude.

## Confidentialité

Les clients ne stockent pas durablement :

- les secrets fournisseur ;
- les clés API ;
- les signatures webhook ;
- les preuves mobiles ;
- les réponses brutes fournisseur.

Le Web conserve temporairement l’identifiant de la dernière commande dans la session du navigateur. Le Mobile conserve seulement les jetons de session selon le mécanisme sécurisé existant.

## Accessibilité et erreurs

Les interfaces :

- affichent des statuts textuels ;
- désactivent les actions indisponibles ;
- présentent les références de support renvoyées par l’API ;
- permettent d’actualiser l’historique ;
- ne masquent pas les états `REVIEW_REQUIRED`, `FAILED`, `REFUNDED` ou `CANCELED`.

## Hors périmètre

KMD-033 n’inclut pas :

- l’installation d’un SDK Google Play Billing ou StoreKit particulier ;
- les achats promotionnels, cadeaux ou codes de réduction ;
- les paiements récurrents hors logique KMD-032 ;
- les remboursements initiés par l’utilisateur ;
- la fiscalité pays par pays ;
- la gestion d’un App Store Server API proxy supplémentaire ;
- un paiement fictif de démonstration.

## Critères de fusion

La livraison est fusionnable lorsque :

- le build Web réussit ;
- le build TypeScript Mobile réussit ;
- le build API reste vert ;
- les tests existants et E2E restent verts ;
- aucun montant libre n’est envoyé par les clients ;
- le retour Web ne livre rien sans vérification serveur ;
- le Mobile ne permet aucune saisie manuelle de preuve ;
- l’absence de pont natif bloque proprement les achats ;
- les liens profils Web et Mobile exposent les nouveaux parcours.
