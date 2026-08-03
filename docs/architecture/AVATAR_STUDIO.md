# KMD-035 — Studio d’avatar composable et rendu autoritaire

## Objectif

KMD-035 transforme l’inventaire cosmétique existant en studio d’avatar par couches, sans créer un second inventaire, un second moteur d’achat ou une seconde source de vérité.

Les possessions restent dans `CosmeticOwnership`. L’équipement reste dans `CosmeticEquipment`. Les presets existants peuvent déjà mémoriser les nouveaux slots. Les réglages publics restent régis par `PrivacyPreference` et le snapshot cosmétique KMD-029.

## Couches

Le studio ajoute les slots suivants :

1. `AVATAR_SKIN` — base et peau ;
2. `AVATAR_HAIR` — cheveux ;
3. `AVATAR_FACE` — visage ;
4. `AVATAR_OUTFIT` — tenue ;
5. `AVATAR_ACCESSORY` — accessoire ;
6. `AVATAR_AURA` — aura.

`AVATAR_FRAME`, déjà existant, est ajouté à la fin du manifest de rendu.

L’ordre serveur est stable : 10, 20, 30, 40, 50, 60 et 70. Le client ne peut pas choisir le `zIndex`.

## Inventaire autoritaire

Le client ne transmet que :

```text
PUT /avatar-studio/equipment/:slot
{
  "itemId": "..." | null
}
```

`AvatarStudioService` refuse tout slot hors des six couches éditables puis délègue l’opération à `CosmeticsService.equip`.

Cette délégation conserve les garanties KMD-027 :

- possession active obligatoire ;
- objet actif et dans sa fenêtre de disponibilité ;
- correspondance exacte entre l’objet et le slot ;
- un seul objet par slot ;
- suppression de l’équipement lorsque `itemId` vaut `null` ;
- aucune confiance accordée au client sur la rareté, l’asset ou le nom.

## Manifest de rendu

Le serveur renvoie un manifest `LAYERED_ASSET_V1` de 512 × 512 :

```json
{
  "renderer": "LAYERED_ASSET_V1",
  "width": 512,
  "height": 512,
  "legacyAvatarUrl": null,
  "fallback": {
    "kind": "INITIALS",
    "initials": "TU",
    "paletteToken": "avatar-palette-4"
  },
  "layers": [],
  "cacheKey": "..."
}
```

Chaque couche contient le slot, son `zIndex`, un instantané minimal de l’objet équipé ou `null`, et un indicateur de fallback.

La `cacheKey` dépend exclusivement des slots, identifiants et versions d’objets. Le client peut l’utiliser pour invalider un rendu local sans inventer une version.

## Fallback sûr

Lorsqu’aucune couche n’est équipée :

1. l’ancienne `avatarUrl` peut être affichée pour compatibilité ;
2. sinon, le serveur fournit les initiales du nom affiché ;
3. une palette déterministe est dérivée du pseudo et du nom.

Lorsqu’un asset est retiré, expiré ou masqué, la couche devient `null`. Le client ne doit pas conserver une ancienne couche en cache en contournant la nouvelle `cacheKey`.

## Confidentialité

Le snapshot public utilise :

```text
GET /avatar-studio/public/:username
```

Cette route appelle `CosmeticsPublicService.snapshot`. Elle hérite donc de :

- la visibilité globale du profil comme limite supérieure ;
- l’audience cosmétique ;
- la relation d’amitié actuelle ;
- `hiddenCosmeticSlots` ;
- l’omission des objets inactifs ou hors fenêtre ;
- l’absence de source d’acquisition, de prix et d’historique privé.

Si l’audience refuse le viewer, le manifest devient `HIDDEN` et ne contient aucune couche.

Si une seule couche est masquée, le profil peut rester visible, mais cette couche apparaît comme un fallback `null`.

Les pages Web de confidentialité exposent désormais chacun des six slots d’avatar.

## Clients

### Web

`/avatar-studio` fournit :

- aperçu superposé ;
- inventaire regroupé par couche ;
- équipement et retrait ;
- accès au profil public, aux réglages de confidentialité et à l’inventaire complet ;
- explication des garanties serveur.

### Mobile

`AvatarStudioExperience` est intégré au profil Mobile. Le rendu utilise des images absolues ordonnées par le `zIndex` serveur.

Le Mobile ne peut pas modifier l’ordre des couches ni soumettre une URL d’asset.

## Sécurité

Le studio interdit explicitement :

- les uploads personnalisés ;
- les URLs d’assets fournies par le client ;
- l’équipement sans possession ;
- les effets de jeu ;
- l’attribution Premium, RBAC ou staff ;
- la priorité de rendu payante ;
- l’exposition publique au-delà des préférences de confidentialité.

Les assets sont ceux des `CosmeticItemDefinition` déjà administrés et audités par le domaine Cosmetics.

## Données et suppression

KMD-035 n’ajoute aucune table.

L’export de compte Cosmetics inclut automatiquement les possessions, équipements et presets des nouveaux slots.

La suppression du compte bénéficie des suppressions existantes de `CosmeticsService` et `CosmeticPresetsService`. Aucun manifest matérialisé n’est conservé : il est recalculé à la demande.

## E2E

Le test E2E du studio :

1. crée un propriétaire et un viewer ;
2. crée une couche cheveux active ;
3. accorde la possession au propriétaire ;
4. équipe la couche via l’API ;
5. vérifie l’ordre et le contenu du manifest propriétaire ;
6. rend le snapshot visible publiquement ;
7. masque `AVATAR_HAIR` ;
8. confirme que la couche publique devient `null` sans masquer le profil entier.

## Hors périmètre

KMD-035 n’inclut pas :

- génération d’images par IA ;
- upload de visage ;
- capture biométrique ;
- animation 3D ;
- marketplace ou revente ;
- création d’assets depuis le client ;
- effets compétitifs ;
- synchronisation avec un avatar externe.

## Critères de fusion

La livraison est fusionnable lorsque :

- le build API, Web et Mobile réussit ;
- les tests unitaires et E2E sont verts ;
- les nouveaux slots passent par Cosmetics ;
- un objet non possédé reste impossible à équiper ;
- le manifest garde un ordre stable ;
- le fallback ne dépend d’aucun asset client ;
- les couches masquées ne sont pas exposées publiquement ;
- aucun nouveau stockage parallèle n’est introduit.
