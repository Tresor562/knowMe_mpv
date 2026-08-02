# KMD-027 — Catalogue cosmétique et inventaire autoritaire

## Objectif

Ce bloc introduit la fondation de personnalisation visuelle de KnowMe. KMD-027 a été livré initialement sans boutique ni achat ; KMD-028 ajoute ensuite les acquisitions KnowCoins sans modifier la séparation fondamentale de l’inventaire.

Les trois responsabilités suivantes sont séparées :

1. `CosmeticItemDefinition` décrit une version publiée d’un objet ;
2. `CosmeticOwnership` prouve qu’un compte possède cette version ;
3. `CosmeticEquipment` indique quel objet possédé est actuellement affiché dans un emplacement.

La publication d’un objet ne donne jamais automatiquement sa possession. La possession ne l’équipe jamais automatiquement.

## Garanties de confiance

- les versions publiées sont immuables : une correction crée une nouvelle version ;
- le catalogue public ne retourne que la version active la plus récente de chaque clé ;
- une fenêtre `startsAt` / `endsAt` borne la disponibilité ;
- l’inventaire est calculé côté serveur ;
- un compte doit posséder un objet non révoqué pour l’équiper ;
- le slot de l’objet doit correspondre exactement au slot demandé ;
- un seul objet peut être équipé par slot et par compte ;
- une révocation retire immédiatement l’objet de tous les slots du compte ;
- les attributions et révocations administratives sont auditées ;
- l’équipement et le déséquipement utilisateur sont audités ;
- l’export de compte inclut l’historique de possession et l’équipement courant ;
- la suppression de compte efface possession et équipement.

## Slots initiaux

- `AVATAR_FRAME` ;
- `PROFILE_BACKGROUND` ;
- `CHAT_BUBBLE` ;
- `PROFILE_BADGE`.

## Sources de possession

KMD-027 autorise les attributions suivantes :

- `ADMIN` ;
- `ACHIEVEMENT` ;
- `QUEST` ;
- `EVENT` ;
- `MIGRATION`.

KMD-028 ajoute `PURCHASE` uniquement à travers la boutique transactionnelle. Cette source ne peut pas être forgée par le client ou utilisée dans l’API d’attribution administrative. Elle réutilise exactement `CosmeticOwnership`, les registres KnowCoins et les protections d’achat existantes.

## Politique anti-pay-to-win

Les objets cosmétiques sont purement visuels. Ils ne peuvent pas :

- augmenter l’XP ou les KnowCoins ;
- modifier un score, un classement, une quête, une série ou un coffre ;
- augmenter la visibilité d’un profil ou d’une publication ;
- modifier une probabilité, un cooldown ou une limite ;
- accorder un statut social implicite non expliqué ;
- contourner une règle grâce à Premium ou à un achat.

L’API publie explicitement les indicateurs `visualOnly`, `gameplayEffectsAllowed`, `purchasesEnabled` et `paidPriorityAllowed` pour permettre aux clients de présenter ces garanties.

## API

### Utilisateur authentifié

- `GET /cosmetics/catalog` : catalogue actif et politique ;
- `GET /cosmetics/me` : possessions actives et équipement ;
- `PUT /cosmetics/equipment/:slot` : équiper un objet possédé ou envoyer `itemId: null` pour libérer le slot.

Les routes d’offres et d’achats sont documentées séparément dans `COSMETICS_KNOWCOINS_SHOP.md`.

### Administration protégée par `cosmetics.manage`

- `POST /admin/cosmetics/items` : publier une version immuable ;
- `POST /admin/cosmetics/grants` : attribuer ou réactiver une possession de manière idempotente ;
- `PATCH /admin/cosmetics/grants/:id/revoke` : révoquer et déséquiper immédiatement.

## Validation

La suite KMD-027 couvre :

- l’interdiction d’administration pour un membre ;
- l’unicité clé/version ;
- la politique visuelle ;
- le refus d’équiper un objet non possédé ;
- l’idempotence d’une attribution ;
- l’isolation des inventaires entre comptes ;
- la compatibilité stricte des slots ;
- la révocation et le déséquipement atomiques ;
- la réactivation ;
- l’audit ;
- l’export ;
- la suppression du compte.

KMD-028 ajoute une suite indépendante pour les offres, débits, reçus et rejeux d’achat.
