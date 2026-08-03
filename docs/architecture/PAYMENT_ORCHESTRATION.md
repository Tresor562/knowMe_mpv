# KMD-032 — Orchestration de paiements multi-canaux

## Objectif

KMD-032 fournit le socle financier autoritaire de KnowMe pour le Web, Android et iOS. Il étend les modules déjà existants de facturation, d’entitlements, de KnowCoins, de vérification d’identité, d’audit et de contrôle d’accès.

Aucun fournisseur n’est simulé. Une configuration absente produit `503 Service Unavailable` et aucune commande n’est créée.

## Architecture

```text
Web / Android / iOS
        |
        v
Catalogue commercial KnowMe
        |
        v
PaymentOrder + prix serveur
        |
        +--> Flutterwave / CinetPay
        +--> Google Play Billing
        +--> Apple In-App Purchase
        |
        v
Vérification distante + webhook signé
        |
        v
PaymentAttempt unique
        |
        v
Attribution atomique
        +--> BillingSubscription + entitlements
        +--> KnowCoinLedgerEntry
        +--> EntitlementGrant
        +--> PaymentInvoice
```

## Modèles persistants

- `CommerceProduct` : produit logique KnowMe ;
- `CommercePrice` : projection par fournisseur, plateforme, pays et devise ;
- `PaymentOrder` : commande contenant le prix attendu avant tout paiement ;
- `PaymentAttempt` : preuve fournisseur vérifiée ;
- `PaymentWebhookLog` : journal idempotent des notifications ;
- `PaymentInvoice` : facture interne en unités mineures ;
- `PaymentRefund` : cycle de remboursement ;
- `PaymentFraudLog` : anomalies et collisions à traiter.

Les tables historiques `BillingPlan`, `BillingSubscription`, `EntitlementGrant`, `KnowCoinWallet` et `KnowCoinLedgerEntry` restent les sources de vérité. KMD-032 ne crée aucun second portefeuille et aucun second moteur d’abonnement.

## Catalogue initial

### Abonnements

- `premium_monthly` : 20,00 USD par mois ;
- `verified_monthly` : 25,00 USD par mois, vérification d’identité et revue requises.

Le badge `badge.verified` est distinct de `team.official`. Un achat ne peut jamais attribuer le badge Équipe KnowMe ni un rôle de staff.

### KnowCoins

La référence produit est `100 KnowCoins = 1,73 EUR`.

Les packs initiaux sont :

- 100 ;
- 250 ;
- 500 ;
- 1 000 ;
- 5 000 KnowCoins.

Les montants sont des entiers en unités mineures. Aucun nombre flottant n’est persisté.

### Produits mobiles

Les identifiants Google Play et Apple ne sont pas codés en dur. Ils sont fournis par `PAYMENTS_STORE_CATALOG_JSON` et doivent correspondre à un produit KnowMe existant.

Exemple de structure sans vrai identifiant :

```json
[
  {
    "productKey": "premium_monthly",
    "provider": "GOOGLE_PLAY",
    "platform": "ANDROID",
    "currency": "USD",
    "unitAmount": 2000,
    "externalProductId": "PLACEHOLDER_FROM_GOOGLE_PLAY"
  }
]
```

## Flux Web

1. Le client charge `GET /payments/catalog`.
2. Il envoie uniquement `productKey`, `provider`, pays et devise souhaités.
3. L’API exige `Idempotency-Key`.
4. L’API choisit le prix actif en base.
5. Une `PaymentOrder` est créée avant l’appel fournisseur.
6. Flutterwave ou CinetPay retourne une URL de paiement.
7. Le webhook signé déclenche une vérification distante.
8. Référence, montant et devise doivent correspondre à la commande.
9. L’attribution est exécutée une seule fois dans une transaction.

Le frontend ne peut jamais envoyer le montant à débiter.

## Flutterwave

Le service fournit :

- création de checkout Standard ;
- vérification distante de transaction ;
- validation HMAC-SHA256 du corps brut ;
- compatibilité de migration avec l’ancien hash de vérification ;
- demande de remboursement intégral.

Variables :

```env
FLUTTERWAVE_PUBLIC_KEY=
FLUTTERWAVE_SECRET_KEY=
FLUTTERWAVE_WEBHOOK_SECRET=
```

La clé publique est destinée aux futurs SDK clients. La clé secrète et le secret webhook restent exclusivement sur le backend.

## CinetPay

Le service fournit :

- initialisation du paiement ;
- vérification distante ;
- validation du `x-token` HMAC-SHA256 dans l’ordre de champs imposé ;
- prise en charge des contraintes de montant entier et de devise.

Variables :

```env
CINETPAY_API_KEY=
CINETPAY_SITE_ID=
CINETPAY_SECRET=
```

Les prix CinetPay doivent correspondre à la devise du compte marchand. Une conversion dynamique depuis USD ne doit pas être inventée par le client.

## Google Play Billing

Le backend :

- échange un JWT de compte de service contre un jeton OAuth ;
- vérifie les produits à achat unique ;
- vérifie les abonnements avec l’API V2 ;
- contrôle `obfuscatedExternalAccountId` ;
- reconnaît les états actif, grâce, annulé jusqu’à échéance, en attente et expiré ;
- accuse réception uniquement après attribution réussie ;
- valide le jeton OIDC Pub/Sub ;
- relit toujours l’état auprès de Google après une notification RTDN.

Variables :

```env
GOOGLE_PACKAGE_NAME=
GOOGLE_SERVICE_ACCOUNT_JSON=
GOOGLE_PUBSUB_AUDIENCE=
GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL=
```

Le client Android doit envoyer le `purchaseToken` et utiliser comme identifiant de compte obfusqué la référence fournie par KnowMe.

## Apple In-App Purchase

Le backend :

- crée un JWT ES256 App Store Server API ;
- interroge la production puis le sandbox uniquement si la transaction n’existe pas en production ;
- vérifie le JWS de transaction ;
- vérifie la chaîne X.509 contre les racines Apple configurées ;
- contrôle le bundle, l’identifiant d’application, le produit et `appAccountToken` ;
- vérifie les App Store Server Notifications V2.

Variables :

```env
APPLE_KEY_ID=
APPLE_ISSUER_ID=
APPLE_TEAM_ID=
APPLE_PRIVATE_KEY=
APPLE_BUNDLE_ID=
APPLE_APP_ID=
APPLE_ROOT_CA_PEMS_JSON=[]
```

`APPLE_ROOT_CA_PEMS_JSON` contient un tableau JSON de certificats racines complets au format PEM. Les certificats doivent provenir de la source officielle Apple et ne doivent pas être commités dans le dépôt.

## Chiffrement des preuves mobiles

Google peut nécessiter le `purchaseToken` pour les renouvellements et les RTDN. Les preuves mobiles sont donc :

- hachées pour la recherche et l’unicité ;
- chiffrées par AES-256-GCM pour la revalidation ;
- liées cryptographiquement au contexte de la commande ;
- supprimées des réponses API et des logs.

Variable :

```env
PAYMENTS_DATA_ENCRYPTION_KEY=
```

Elle doit contenir exactement 32 octets aléatoires encodés en base64. Sa rotation nécessite une procédure de rechiffrement versionnée.

## Webhooks

Routes :

- `POST /api/webhooks/flutterwave` ;
- `POST /api/webhooks/cinetpay` ;
- `POST /api/webhooks/google` ;
- `POST /api/webhooks/apple`.

NestJS conserve le corps brut avec `rawBody: true`. Un webhook est journalisé avec :

- fournisseur ;
- identifiant externe ;
- hash du payload ;
- résultat de signature ;
- nombre de tentatives ;
- état de traitement ;
- contenu redacted.

Un identifiant d’événement réutilisé avec un autre contenu produit un signal de fraude critique.

## Attribution

### Premium et Badge Certifié

Une transaction crée ou synchronise `BillingSubscription`, puis les `EntitlementGrant` liés au plan.

### KnowCoins

Un crédit passe exclusivement par `WalletService.applyInTransaction` avec une clé d’idempotence dérivée de la commande.

### Produits futurs

Les thèmes, avatars, stickers, cadeaux et Event Pass utiliseront `fulfillmentType=ENTITLEMENT` ou une livraison métier dédiée. Ils ne doivent jamais créditer directement une table depuis un webhook fournisseur.

## Remboursements

KMD-032 automatise uniquement le remboursement intégral.

- Flutterwave : demande par API ;
- CinetPay : opération marchand puis confirmation avec référence ;
- Google Play et Apple : opération gérée dans la console/fournisseur puis notification ou preuve externe.

Après confirmation :

- les entitlements sont révoqués ;
- l’abonnement passe à `REFUNDED` ;
- les KnowCoins sont débités avec une entrée de registre compensatoire ;
- la facture passe à `REFUNDED`.

Si les KnowCoins ont déjà été dépensés, aucun solde négatif silencieux n’est créé : le remboursement passe à `RECOVERY_REQUIRED` avec un signal de fraude/récupération.

## API

### Publique

- `GET /payments/catalog` ;
- `GET /payments/providers`.

### Authentifiée

- `POST /payments/checkout` ;
- `POST /payments/orders/:id/verify` ;
- `POST /payments/store/verify` ;
- `GET /payments/me/orders` ;
- `GET /payments/me/orders/:id`.

### Administration — `billing.manage`

- `GET /admin/payments/summary` ;
- `GET /admin/payments/products` ;
- `GET /admin/payments/orders` ;
- `GET /admin/payments/refunds` ;
- `POST /admin/payments/orders/:id/refunds` ;
- `POST /admin/payments/refunds/:id/confirm` ;
- `GET /admin/payments/webhooks` ;
- `GET /admin/payments/fraud` ;
- `PATCH /admin/payments/fraud/:id`.

## Mise en production

1. Créer les comptes marchands et produits dans chaque console officielle.
2. Définir les URLs HTTPS publiques KnowMe.
3. Déposer les secrets dans le gestionnaire de secrets de l’infrastructure, jamais dans Git.
4. Construire `PAYMENTS_STORE_CATALOG_JSON` avec les vrais SKU.
5. Configurer les webhooks vers les quatre routes.
6. Configurer Pub/Sub Google avec une identité de push dédiée.
7. Installer les certificats racines Apple officiels dans le secret prévu.
8. Exécuter Prisma migrate dans le pipeline de déploiement.
9. Tester les environnements sandbox avec de vrais sandbox providers, jamais avec des paiements fictifs enregistrés comme réussis.
10. Activer progressivement les prix et fournisseurs après rapprochement comptable.

## Limites explicites

- KMD-032 ne crée pas encore une interface de checkout Next.js ou les adaptateurs natifs UI Android/iOS.
- Il ne crée pas les cadeaux, avatars, stickers, groupes ou chaînes.
- Il ne traite pas les remboursements partiels ni la dette virtuelle.
- Il ne remplace pas un prestataire fiscal ou un système légal de facturation pays par pays.
- Il ne garantit pas à lui seul la résistance DDoS : WAF, CDN, files, observabilité et procédures d’incident restent des couches d’infrastructure.
