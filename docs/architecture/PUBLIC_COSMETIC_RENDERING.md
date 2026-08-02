# KMD-029 — Rendu public contrôlé des cosmétiques

## Objectif

KMD-029 permet d’afficher les objets cosmétiques équipés sur un profil sans faire confiance au client et sans révéler la provenance économique des objets.

Le rendu public est un snapshot calculé par le serveur à partir de :

- `CosmeticEquipment` pour l’état équipé ;
- `CosmeticItemDefinition` pour l’asset versionné ;
- `PrivacyPreference` pour l’audience et les slots masqués ;
- `Friendship` pour vérifier une audience `FRIENDS`.

Aucun identifiant envoyé par le client ne peut ajouter un objet au snapshot.

## Confidentialité

Deux préférences sont ajoutées :

- `cosmeticVisibility` : `FOLLOW_PROFILE`, `PRIVATE`, `FRIENDS` ou `PUBLIC` ;
- `hiddenCosmeticSlots` : liste validée des slots à omettre.

La visibilité du profil constitue toujours une limite supérieure. Par exemple :

- profil `PRIVATE` + cosmétiques `PUBLIC` = cosmétiques privés ;
- profil `FRIENDS` + cosmétiques `PUBLIC` = amis uniquement ;
- profil `PUBLIC` + cosmétiques `FRIENDS` = amis uniquement ;
- `FOLLOW_PROFILE` reprend exactement la visibilité du profil.

Le propriétaire peut toujours prévisualiser son propre rendu. Un membre non autorisé reçoit `visible: false`, aucun asset et aucun avatar public dans ce snapshot.

## Masquage par slot

Les slots initiaux sont :

- `AVATAR_FRAME` ;
- `PROFILE_BACKGROUND` ;
- `CHAT_BUBBLE` ;
- `PROFILE_BADGE`.

Un slot présent dans `hiddenCosmeticSlots` est entièrement omis du snapshot public. L’API ne précise pas quel objet était équipé ni pourquoi le slot est absent.

## Résolution des assets

Le serveur recharge chaque définition équipée et vérifie :

- `active = true` ;
- `startsAt <= serverTime` ;
- `endsAt` absent ou futur.

Un objet retiré, désactivé ou hors fenêtre produit un slot avec :

- `item: null` ;
- `fallback: true` ;
- `fallbackReason: ASSET_UNAVAILABLE`.

Le client peut alors afficher son fallback local sans charger un asset obsolète.

## Données volontairement absentes

Le snapshot ne contient jamais :

- la source d’attribution (`ADMIN`, `EVENT`, `PURCHASE`, etc.) ;
- un prix KnowCoins ;
- une offre ou un reçu d’achat ;
- une permission, un entitlement ou un statut Premium lié à l’objet ;
- un effet de jeu, un boost ou une priorité.

Une possession gratuite et une possession achetée sont donc visuellement équivalentes une fois équipées.

## API

### Lecture authentifiée

- `GET /cosmetics/public/:username` : snapshot public selon le propriétaire, la relation d’amitié et les préférences.

### Mise à jour des préférences

La route existante `PATCH /privacy/preferences` accepte désormais :

- `cosmeticVisibility` ;
- `hiddenCosmeticSlots`.

Les mises à jour utilisent l’audit de confidentialité déjà présent.

## Expérience Web et Mobile

- `/profile/:username` affiche le snapshot public ;
- `/privacy/cosmetics` configure l’audience et les slots ;
- le profil personnel fournit des liens directs vers l’aperçu et les réglages ;
- le client Mobile expose `fetchPublicCosmetics` et `updateCosmeticPrivacy`.

## Cycle de vie des données

Les nouvelles préférences sont automatiquement incluses dans l’export de confidentialité existant. Elles sont supprimées avec `PrivacyPreference` lors de la suppression du compte.

## Validation

La suite KMD-029 couvre :

- la visibilité par défaut réservée aux amis ;
- la prévisualisation propriétaire ;
- l’accès d’un ami accepté ;
- l’accès public explicite ;
- le plafond imposé par la visibilité du profil ;
- le masquage d’un slot ;
- l’absence de source et de prix ;
- le fallback d’un asset désactivé ;
- l’audit des préférences ;
- l’export ;
- la suppression du compte.
