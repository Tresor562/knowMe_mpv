# KMD-027 — Catalogue cosmétique et inventaire autoritaires

## Objectif

KMD-027 crée la fondation unifiée des objets visuels KnowMe sans ouvrir de boutique ni de paiement.

Le système sépare strictement trois responsabilités :

1. **la définition** décrit un objet versionné publié par l’équipe ;
2. **l’attribution** prouve qu’un compte possède cet objet ;
3. **l’équipement** choisit au plus un objet possédé dans chaque slot visuel.

Aucune valeur envoyée par le client ne peut créer une propriété.

## Catalogue

Une `CosmeticDefinition` contient une clé stable, une version immuable, un type, un slot, un nom, une description, un asset facultatif, une rareté d’affichage et des métadonnées visuelles.

Les slots initiaux sont volontairement bornés :

- `AVATAR_FRAME` ;
- `PROFILE_THEME` ;
- `CHAT_BUBBLE` ;
- `PROFILE_ACCENT`.

Dans ce premier bloc, le type doit correspondre au slot. Cette contrainte évite les objets polymorphes difficiles à contrôler avant l’introduction éventuelle de collections plus riches.

## Propriété

Une `CosmeticGrant` est créée uniquement par une route administrative protégée par `rewards.manage`.

Chaque attribution possède :

- un compte destinataire ;
- une définition active ;
- une source et une raison ;
- une clé d’idempotence ;
- un historique de révocation.

Le couple compte/définition est unique. Un rejeu ne crée pas de doublon.

## Équipement

`CosmeticEquipment` ne contient qu’une sélection visuelle. Le service vérifie avant chaque équipement que :

- l’attribution appartient au compte authentifié ;
- elle n’est pas révoquée ;
- sa définition est active ;
- son slot correspond au slot demandé.

Une révocation supprime immédiatement l’équipement lié dans la même transaction.

## Garanties produit

La politique publiée par l’API fixe les invariants suivants :

- autorité serveur ;
- effets purement visuels ;
- achats désactivés ;
- aucun pouvoir Premium ;
- aucune propriété créée par le client ;
- un objet maximum par slot.

KnowCoins, Premium, achats et cosmétiques restent donc séparés dans KMD-027.

## Audit et cycle de vie

Les créations de définition, attributions, équipements, retraits et révocations sont audités.

L’export de compte contient les attributions et l’équipement. La suppression du compte efface d’abord l’équipement, puis les attributions, avant la suppression de l’utilisateur.

## Surfaces

- `GET /cosmetics/me` : inventaire, équipement, historique et politique ;
- `PATCH /cosmetics/equipment/:slot` : équiper ou retirer un objet ;
- `GET /admin/cosmetics/catalog` : catalogue administratif ;
- `POST /admin/cosmetics/definitions` : publier une définition ;
- `GET /admin/cosmetics/grants` : consulter les attributions ;
- `POST /admin/cosmetics/grants` : attribuer un objet ;
- `PATCH /admin/cosmetics/grants/:id/revoke` : révoquer et déséquiper ;
- `/cosmetics` : expérience Web utilisateur.

## Hors périmètre

KMD-027 n’implémente ni prix, ni commande, ni panier, ni achat KnowCoins, ni achat réel, ni échange entre comptes, ni rareté fonctionnelle, ni bonus de progression.
