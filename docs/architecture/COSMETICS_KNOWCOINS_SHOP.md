# KMD-028 — Boutique cosmétique KnowCoins

## Objectif

KMD-028 ajoute des acquisitions cosmétiques payées en KnowCoins au-dessus de l’inventaire autoritaire de KMD-027.

La boutique ne crée aucun second inventaire. Une acquisition réussie produit une `CosmeticOwnership` identique, du point de vue de l’équipement et de l’affichage, à une attribution gratuite obtenue par événement, quête, succès ou administration.

## Modèle

### `CosmeticOfferDefinition`

Une offre publiée est versionnée et immuable. Elle référence exactement une version d’objet cosmétique et contient :

- une clé fonctionnelle et une version ;
- un prix entier strictement positif en KnowCoins ;
- une fenêtre `startsAt` / `endsAt` ;
- un état actif ;
- l’auteur et la raison de publication.

Le catalogue de boutique ne retourne que la version active la plus récente de chaque clé d’offre, à condition que l’offre et l’objet soient tous deux disponibles.

### `CosmeticPurchaseReceipt`

Le reçu relie :

- le compte acheteur ;
- l’offre et l’objet exacts ;
- le prix payé ;
- une clé d’idempotence propre au compte ;
- l’entrée du registre KnowCoins ;
- la date d’achat.

Un compte ne peut acheter qu’une fois une même version d’objet. Une révocation administrative ne transforme pas le reçu historique et ne permet pas un second débit.

## Transaction autoritaire

L’achat s’exécute dans une transaction sérialisable :

1. vérifier un éventuel reçu existant ;
2. charger l’offre et l’objet ;
3. vérifier leurs fenêtres de disponibilité ;
4. refuser un objet déjà possédé ;
5. débiter le portefeuille via `WalletService.applyInTransaction` ;
6. créer ou réactiver la possession avec la source `PURCHASE` ;
7. créer le reçu lié à l’entrée de registre.

Une erreur avant la validation finale annule le débit, la possession et le reçu. Les conflits de transaction sérialisable sont rejoués de manière bornée.

## Idempotence

Le client fournit `clientPurchaseId`. Le serveur construit des clés isolées par compte pour le reçu et le registre.

Le rejeu de la même clé et de la même offre :

- retourne le reçu, la possession et l’entrée de registre existants ;
- indique `replayed: true` ;
- ne débite jamais une seconde fois.

La réutilisation de cette clé pour une autre offre est refusée.

## Équité

La boutique publie explicitement les garanties suivantes :

- devise unique `KNOWCOINS` ;
- registre vérifié obligatoire ;
- débit et possession atomiques ;
- achats idempotents ;
- objets purement visuels ;
- aucun effet sur l’XP, les scores, les quêtes, les séries, les coffres ou les classements ;
- aucune priorité payante ;
- aucun boost de visibilité sociale ;
- aucun contournement Premium.

Le prix et la rareté sont descriptifs. Ils ne représentent ni la valeur humaine du compte, ni son importance, ni son autorité dans la communauté.

## API

### Utilisateur authentifié

- `GET /cosmetics/shop` : offres disponibles, possession, accessibilité financière et solde ;
- `POST /cosmetics/shop/purchases` : achat idempotent ;
- `GET /cosmetics/shop/purchases` : historique des reçus.

### Administration protégée par `cosmetics.manage`

- `POST /admin/cosmetics/offers` : publier une version immuable d’offre.

## Cycle de vie du compte

L’export de compte conserve les reçus et les définitions d’offre et d’objet associées. La suppression de compte efface les reçus, l’équipement et les possessions avant la suppression du compte, tout en laissant le registre d’audit global suivre ses règles existantes.

## Validation

La suite KMD-028 couvre :

- le RBAC de publication ;
- l’unicité clé/version ;
- la visibilité et l’accessibilité financière des offres ;
- le débit unique ;
- la création atomique de possession ;
- le rejeu idempotent ;
- le solde insuffisant sans effet partiel ;
- l’historique ;
- l’audit ;
- l’export ;
- la suppression de compte.
