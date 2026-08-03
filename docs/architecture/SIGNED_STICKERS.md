# Stickers signés KnowMe

## Résumé

KMD-036 ajoute un format de message visuel sûr au-dessus de la table `Message` existante. Aucun nouveau stockage d’asset, inventaire ou portefeuille n’est créé.

Le contenu persistant est un jeton opaque :

```text
KNOWME_STICKER_V1.<keyId>.<payloadBase64Url>.<signatureBase64Url>
```

Le client ne construit jamais ce jeton. Il envoie uniquement `packKey` et `stickerKey` à l’API authentifiée.

## Catalogue fermé

Le catalogue est compilé dans l’API et contient uniquement :

- une clé de pack ;
- une version ;
- un nom et une description ;
- une clé de sticker ;
- une version ;
- un libellé ;
- un glyphe Unicode borné ;
- un texte d’accessibilité.

Il ne contient aucune URL, balise HTML, donnée SVG, chemin local fourni par un utilisateur, script ou contenu distant.

## Création autoritaire

`POST /conversations/:conversationId/stickers` :

1. authentifie le compte ;
2. applique la même politique anti-spam que l’envoi d’un message ;
3. vérifie l’appartenance à la conversation ;
4. vérifie le pack et le sticker dans le catalogue fermé ;
5. signe le jeton avec la clé active ;
6. persiste le message dans la transaction habituelle ;
7. publie la notification et le temps réel après création ;
8. renvoie une présentation structurée sûre.

Un client ne peut pas choisir un asset, une URL, un prix, une propriété, un droit Premium ou un effet de jeu.

## Payload signé

Le payload contient :

- `schemaVersion` ;
- `conversationId` ;
- `packKey` et `packVersion` ;
- `stickerKey` et `stickerVersion` ;
- `issuedAt` et `expiresAt` ;
- un nonce UUID.

La signature couvre le préfixe, l’identifiant de clé et le payload encodé.

## Résolution

La résolution refuse :

- un préfixe inconnu ;
- des segments supplémentaires ;
- un identifiant de clé invalide ;
- un payload trop grand ;
- une signature différente ;
- un JSON invalide ;
- un schéma incorrect ;
- une date future anormale ;
- un jeton expiré ;
- une conversation différente ;
- un pack ou sticker absent ;
- une version remplacée.

La comparaison de signature est faite en temps constant après vérification de longueur.

En cas d’échec, le contenu reste un message texte opaque. Il n’est jamais rendu comme HTML.

## Rotation des clés

- `STICKER_TOKEN_ACTIVE_KEY_ID` et `STICKER_TOKEN_ACTIVE_SECRET` signent les nouveaux messages ;
- `STICKER_TOKEN_PREVIOUS_KEYS_JSON` contient au maximum dix anciennes clés de lecture ;
- un identifiant ne doit jamais être réutilisé avec un autre secret ;
- une ancienne clé doit être conservée jusqu’à l’expiration des messages qui en dépendent.

En production, l’absence d’une clé dédiée échoue fermée. Le fallback sur `JWT_SECRET` existe uniquement hors production pour simplifier les environnements locaux et la CI.

## Web et Mobile

L’API renvoie une propriété `presentation` :

```json
{
  "kind": "STICKER",
  "pack": { "key": "knowme-sparks", "version": 1, "name": "KnowMe Sparks" },
  "sticker": {
    "key": "bravo",
    "version": 1,
    "label": "Bravo",
    "glyph": "👏✨",
    "accessibilityLabel": "Applaudissements brillants"
  },
  "visualOnly": true,
  "externalAssetAllowed": false,
  "arbitraryHtmlAllowed": false
}
```

Les clients affichent uniquement cette présentation structurée. Les messages texte conservent `presentation.kind = TEXT`.

## Limites volontaires

KMD-036 ne fournit pas :

- de marketplace ;
- de packs payants ;
- de créations utilisateur ;
- de transfert ou revente ;
- de téléchargement d’asset ;
- de sticker animé distant ;
- de licence tierce ;
- de pouvoir Premium, rôle, permission ou badge.
