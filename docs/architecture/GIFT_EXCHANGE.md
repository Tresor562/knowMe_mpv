# KMD-037 — Gift Exchange

## Décision

Le système KMD-034 est une première version sûre de cadeaux visuels : l’expéditeur paie, le destinataire reçoit une animation, mais le cadeau n’est ni transférable ni revendable.

Gift Exchange remplace progressivement cette logique par une économie de cadeaux possédés, collectionnables et échangeables.

## Expérience d’envoi

L’utilisateur peut :

- choisir un cadeau dans un catalogue ;
- filtrer par prix, rareté, événement, animation et disponibilité ;
- joindre un message ;
- envoyer anonymement lorsque la politique du destinataire l’autorise ;
- programmer une date de livraison ;
- choisir une animation d’emballage ;
- ajouter une musique ou un effet sonore autorisé ;
- prépayer l’amélioration en collectible ;
- envoyer à un ami, un groupe, une communauté ou un créateur selon les permissions ;
- offrir plusieurs exemplaires dans une distribution contrôlée.

Chaque envoi produit une instance possédée avec un identifiant stable et une provenance vérifiable.

## Cadeau standard et collectible

### Standard

Un cadeau standard possède :

- une définition ;
- un prix initial ;
- une animation ;
- un propriétaire ;
- une date d’acquisition ;
- une politique de transfert ;
- une politique de conversion ou d’amélioration.

### Collectible

L’amélioration transforme le cadeau en objet unique :

- numéro de série ;
- taille d’édition ;
- modèle visuel ;
- arrière-plan ;
- symbole ;
- effet ;
- signature éventuelle ;
- historique de propriétaires ;
- hash de provenance ;
- valeur estimative informative.

Les traits doivent être attribués de manière déterministe et auditable. Le serveur conserve la graine ou le résultat signé. Le client ne peut pas relancer gratuitement une génération jusqu’à obtenir une rareté supérieure.

## Affichage social

Un propriétaire peut :

- afficher un cadeau sur son profil ;
- créer plusieurs collections ;
- épingler ses favoris ;
- utiliser un cadeau compatible comme statut visuel ;
- utiliser un cadeau comme couverture de profil ;
- associer un cadeau à une pose d’avatar ;
- masquer le prix d’achat ;
- masquer le message reçu ;
- choisir qui voit ses collections.

La confidentialité du profil reste la limite supérieure.

## Marketplace

La marketplace permet :

- mise en vente à prix fixe ;
- retrait d’annonce ;
- recherche par collection, modèle, symbole, effet, rareté et numéro ;
- tri par prix, date, rareté et popularité ;
- offres directes ;
- contre-offres ;
- favoris ;
- historique de prix ;
- alertes de prix ;
- achat atomique ;
- transfert atomique de propriété ;
- versement vendeur ;
- commission KnowMe ;
- royalty créateur plafonnée.

Au lancement, tous les règlements restent en KnowCoins. Il n’existe pas de retrait automatique en argent réel ou crypto.

## Cycle de vie d’une instance

États principaux :

- `OWNED` ;
- `LISTED` ;
- `OFFER_LOCKED` ;
- `TRANSFER_LOCKED` ;
- `BURNED`.

Une instance listée ne peut pas être simultanément transférée, fusionnée, offerte ou supprimée.

Chaque changement d’état utilise une transaction sérialisable et une clé d’idempotence.

## Achat et règlement

Pour un prix de vente donné :

1. le portefeuille de l’acheteur est débité ;
2. la propriété est verrouillée ;
3. l’annonce est clôturée ;
4. le vendeur reçoit le montant net ;
5. la commission KnowMe est enregistrée ;
6. la royalty créateur est enregistrée ;
7. l’instance change de propriétaire ;
8. un délai de retransfert est appliqué ;
9. la provenance est mise à jour ;
10. acheteur et vendeur reçoivent une notification.

L’opération entière réussit ou échoue. Aucun débit isolé ne doit rester sans transfert de propriété.

## Offres directes

Une offre contient :

- acheteur ;
- cadeau ciblé ;
- montant ;
- expiration ;
- dépôt ou réservation de solde ;
- statut ;
- clé d’idempotence.

Le propriétaire peut accepter, refuser ou laisser expirer. Lors de l’acceptation, la même transaction atomique que la marketplace est utilisée.

## Enchères

Les enchères constituent un bloc ultérieur :

- prix de départ ;
- incrément minimal ;
- durée ;
- prolongation anti-sniping ;
- réservation du montant du meilleur enchérisseur ;
- remboursement automatique des réservations dépassées ;
- attribution atomique à la clôture ;
- limites par compte ;
- surveillance anti-collusion.

## Fusion et crafting

Certaines collections permettent de combiner plusieurs cadeaux compatibles pour créer un collectible supérieur.

Règles :

- recettes définies côté serveur ;
- cadeaux consommés explicitement ;
- aperçu du résultat possible ;
- aucun résultat falsifiable côté client ;
- provenance contenant les composants ;
- limites contre le farming abusif ;
- confirmation renforcée pour les objets rares.

## Fonctionnalités supplémentaires

### Cadeaux duo

Deux utilisateurs peuvent compléter une paire de cadeaux complémentaires et débloquer une animation sociale commune.

### Cadeaux évolutifs

Un cadeau peut changer visuellement selon des événements non compétitifs : anniversaire de réception, nombre d’affichages ou participation à une collection. L’évolution ne crée pas de pouvoir de jeu.

### Coffres cadeaux

Un utilisateur peut préparer une sélection de cadeaux avec plusieurs niveaux de révélation, sans hasard payant opaque. Le contenu et les probabilités éventuelles doivent être affichés clairement.

### Wishlist

Un utilisateur peut publier une liste de cadeaux souhaités avec visibilité configurable.

### Collections communautaires

Des créateurs vérifiés peuvent proposer des collections originales approuvées, recevoir une royalty plafonnée et consulter des statistiques agrégées.

### Réactions d’avatar

Lorsqu’un cadeau est ouvert, l’avatar peut jouer une animation correspondant à sa personnalité et au type de cadeau.

### Musée personnel

Mode galerie permettant de présenter les cadeaux, leur numéro, leurs traits et leur historique autorisé.

## Premium

Premium peut apporter :

- accès anticipé à certaines sorties ;
- collections réservées avec achat en KnowCoins ;
- davantage d’emplacements de présentation ;
- animations de galerie supplémentaires ;
- outils avancés de recherche et d’alerte.

Premium ne doit jamais :

- falsifier la rareté ;
- supprimer les commissions de sécurité ;
- permettre l’auto-achat ;
- contourner les délais de transfert ;
- créer des KnowCoins ;
- donner accès aux cadeaux d’un autre utilisateur.

## Sécurité et anti-fraude

Le système doit détecter :

- auto-achat ;
- achats circulaires entre comptes liés ;
- manipulation artificielle de prix ;
- ventes répétées à prix extrêmes ;
- comptes récemment créés à forte activité ;
- utilisation de soldes litigieux ;
- détournement de session ;
- revente avant fin du délai ;
- duplication d’instance ;
- double exécution d’une requête.

Mesures :

- propriété autoritaire ;
- transactions sérialisables ;
- verrouillage optimiste ou pessimiste ;
- idempotence ;
- limites quotidiennes ;
- délais de transfert ;
- audit ;
- revue renforcée des transactions à forte valeur ;
- suspension indépendante de l’accès marketplace ;
- système de contestation et de restitution administrée.

## Modèles persistants prévus

La phase transactionnelle ajoutera au minimum :

- `GiftDefinition` ;
- `GiftInstance` ;
- `GiftTrait` ;
- `GiftOwnershipEvent` ;
- `GiftListing` ;
- `GiftOffer` ;
- `GiftCollection` ;
- `GiftCollectionEntry` ;
- `GiftMarketEvent` ;
- `GiftCraftRecipe` ;
- `GiftCraftExecution`.

Les écritures KnowCoins continuent d’utiliser `KnowCoinWallet` et `KnowCoinLedgerEntry` comme source monétaire autoritaire.

## API fondation livrée

KMD-037 ajoute :

- `GET /gift-exchange/policy` ;
- `POST /gift-exchange/quotes/resale-settlement`.

Le domaine serveur valide déjà commissions, royalties, propriété, délai de transfert, prix autorisés, auto-achat, solde et estimation de valeur.

Les routes de mutation persistantes seront ajoutées avec les modèles Prisma et les tests E2E transactionnels.
