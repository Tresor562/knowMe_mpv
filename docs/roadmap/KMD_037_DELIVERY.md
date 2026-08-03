# KMD-037 — Avatar Universe + Gift Exchange

## Statut de cette livraison

Cette livraison corrige le périmètre trop limité de KMD-034 et KMD-035.

Elle livre immédiatement :

- le domaine serveur de personnalité d’avatar ;
- les paramètres morphologiques ;
- les nouveaux slots d’équipement ;
- la règle d’un avatar normal complet et gratuit ;
- les modes d’acquisition gratuits, KnowCoins, Premium + KnowCoins, récompenses et événements ;
- le calcul serveur du prix des objets et bundles ;
- le contrôle des références sous licence ;
- la politique de rendu 3D progressif ;
- le domaine de cadeaux possédés et collectibles ;
- les règles de transfert et de revente ;
- le calcul de commission et de royalty ;
- les protections d’auto-achat, de cooldown et de prix ;
- les endpoints publics de politique et de devis ;
- les tests unitaires des invariants économiques.

## Ce qui n’est pas encore prétendu comme terminé

Cette livraison ne prétend pas fournir en un seul bloc :

- un moteur 3D AAA final ;
- une bibliothèque complète de modèles 3D ;
- des collaborations officielles avec des licences de jeux ou d’animes ;
- les migrations Prisma de la marketplace ;
- l’achat transactionnel des bundles d’avatar ;
- la revente persistante de cadeaux ;
- les enchères ;
- le crafting ;
- un cash-out réel ou crypto.

Ces éléments nécessitent des modèles persistants, des assets, une direction artistique, des contrats de licence et des tests de charge.

## Découpage de réalisation

### KMD-037A — Fondation de domaine

- types ;
- politiques ;
- calculs de prix ;
- starter kit gratuit ;
- règles Premium ;
- tests unitaires ;
- documentation.

### KMD-037B — Persistance Avatar Universe

- `AvatarIdentityProfile` ;
- `AvatarMorphologyPreset` ;
- `AvatarPersonalityPreset` ;
- extension des slots Cosmetics ;
- bundles prêts à utiliser ;
- achat de bundle transactionnel ;
- teintures et matériaux ;
- presets versionnés ;
- export et suppression de compte.

### KMD-037C — Rendu 3D

- squelette commun ;
- modèles GLB ;
- matériaux PBR ;
- blend shapes ;
- animations ;
- LOD ;
- fallback 2D ;
- viewer Web ;
- viewer Mobile ;
- photo mode ;
- tests de performance par catégorie d’appareil.

### KMD-037D — Persistance Gift Exchange

- définitions et instances ;
- numéros de série ;
- traits collectibles ;
- collections de profil ;
- provenance ;
- transfert ;
- amélioration ;
- marketplace à prix fixe ;
- offres directes ;
- transactions KnowCoins atomiques ;
- exports et suppressions.

### KMD-037E — Marché avancé

- enchères ;
- crafting ;
- collections créateurs ;
- royalties ;
- alertes ;
- historique de prix ;
- détection de wash trading ;
- revue des transactions à forte valeur.

## Critères d’équité

- un avatar normal complet reste gratuit ;
- aucun cosmétique ne produit d’avantage de gameplay ;
- Premium ne remplace pas le paiement KnowCoins lorsqu’un objet l’exige ;
- aucun drapeau Premium envoyé par le client n’est accepté ;
- les prix sont calculés ou validés côté serveur ;
- les bundles ne contournent pas la propriété des objets ;
- les cadeaux ne peuvent pas être dupliqués ;
- une revente est atomique ;
- le vendeur ne peut pas acheter son propre cadeau ;
- les commissions et royalties sont plafonnées ;
- les designs de franchises nécessitent une licence.

## Validation CI attendue

- build API ;
- tests unitaires Avatar Universe ;
- tests unitaires Gift Exchange ;
- non-régression des tests existants.
