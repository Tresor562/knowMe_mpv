# KMD-036 — Protocole de stickers signés et bibliothèque d’origine

## Objectif

KMD-036 introduit un format de sticker sûr pour la messagerie KnowMe sans accepter d’URL, de HTML, de SVG ou de média fournis par le client.

Cette livraison est volontairement limitée à une bibliothèque gratuite de démarrage. Elle prépare la marketplace future sans mélanger dès maintenant achat, possession et rendu des messages.

## Catalogue

Le catalogue immuable se trouve dans :

```text
apps/web/lib/sticker-catalog.ts
```

Il contient deux packs originaux :

- `KnowMe Sparks` ;
- `Friendship Orbit`.

Chaque pack et chaque sticker possède :

- une clé stable ;
- une version entière ;
- un nom ;
- un texte alternatif ;
- un emoji de fallback ;
- un `assetToken` interne ;
- un état actif.

Le catalogue public est exposé par :

```text
GET /api/stickers/catalog
```

Aucun champ ne permet au navigateur de soumettre un asset.

## Token de message

Un sticker envoyé dans une conversation reste stocké dans le champ texte existant de `Message` sous la forme :

```text
KNOWME_STICKER_V1.<payload-base64url>.<hmac-base64url>
```

Le payload contient :

- la version du schéma ;
- la clé et la version du pack ;
- la clé et la version du sticker ;
- l’identifiant de conversation ;
- la date d’émission ;
- un nonce aléatoire.

Le serveur Web signe le payload avec HMAC-SHA-256.

## Secret

La variable suivante est obligatoire :

```text
STICKER_TOKEN_SECRET=<au moins 32 caractères aléatoires>
```

Le secret ne doit jamais être exposé au navigateur ni au bundle Mobile.

KMD-036 utilise une clé stable unique. Une rotation qui invaliderait l’historique est hors périmètre : avant toute rotation, une livraison suivante devra ajouter un identifiant de clé et une liste de clés de vérification historiques.

## Émission

Le client demande :

```text
POST /api/stickers/token
{
  "packKey": "knowme-sparks",
  "stickerKey": "tiny-win",
  "conversationId": "..."
}
```

Le serveur :

1. normalise les clés ;
2. confirme que le pack est actif ;
3. confirme que le sticker est actif ;
4. refuse un identifiant de conversation malformé ;
5. fixe les versions autoritaires ;
6. crée un nonce ;
7. signe le payload.

Le client envoie ensuite le token comme contenu via l’endpoint de messagerie existant :

```text
POST /conversations/:id/messages
```

La messagerie reste responsable de l’authentification, de l’appartenance à la conversation, de l’anti-spam, du temps réel et de la persistance.

Le token est lié à la conversation. Un token recopié dans une autre conversation ne doit pas être rendu comme sticker.

## Résolution

Le rendu appelle :

```text
POST /api/stickers/resolve
{
  "token": "KNOWME_STICKER_V1..."
}
```

La résolution :

1. vérifie le préfixe et le nombre de segments ;
2. recalcule la signature ;
3. utilise une comparaison en temps constant ;
4. valide le schéma du payload ;
5. résout la clé dans le catalogue ;
6. exige la même version du pack et du sticker ;
7. retourne uniquement la définition interne connue.

Une signature invalide, un sticker retiré ou une version inconnue ne produit aucun rendu riche.

## Rendu

La vue Web sticker-aware affiche :

- le nom et l’emoji du sticker ;
- le texte alternatif ;
- le nom du pack ;
- l’état « signature valide ».

Les messages ordinaires restent du texte préformaté.

Un contenu commençant par le préfixe mais invalide est signalé comme sticker non reconnu. Il n’est jamais interprété comme HTML et aucune URL du contenu n’est chargée.

## Mobile

Le Mobile utilise :

```text
EXPO_PUBLIC_WEB_URL=https://web.knowme.example
```

Le client Mobile :

- récupère le catalogue public ;
- demande le token signé au serveur Web ;
- envoie le token via l’API de messagerie authentifiée ;
- peut résoudre un token via la même API Web.

Le composant `StickerLibraryExperience` est réutilisable dans toute vue de conversation en lui transmettant `conversationId`.

## Frontières de confiance

Le client ne peut pas fournir :

- une URL d’image ;
- du HTML ;
- un `assetToken` ;
- une version ;
- une signature ;
- un état actif ;
- un effet de jeu ;
- un prix ou une possession.

Les stickers KMD-036 sont :

- gratuits ;
- purement visuels ;
- non revendables ;
- non transférables comme actifs ;
- sans récompense ;
- sans effet RBAC, Premium ou staff.

## Anti-abus

La création d’un token ne livre aucune valeur et ne crée aucun message.

L’envoi réel passe par la messagerie existante et hérite de ses protections :

- authentification ;
- appartenance à la conversation ;
- limites de fréquence ;
- modération ;
- audit et temps réel existants.

Une future marketplace devra vérifier la possession côté serveur avant la signature. Cette vérification n’est pas simulée dans KMD-036 puisque tous les packs livrés ici sont gratuits.

## Données

KMD-036 n’ajoute aucune table et aucune migration.

Le message conserve le token signé dans son champ de contenu. L’export et la suppression de compte bénéficient donc automatiquement du cycle de vie existant de la messagerie.

## Hors périmètre

KMD-036 n’inclut pas :

- packs payants ;
- ownership de packs ;
- cadeaux de packs ;
- création de stickers par les utilisateurs ;
- GIF externes ;
- marketplace ;
- revente ;
- animation vidéo ;
- rotation multi-clé ;
- recherche ou recommandation de stickers.

## Critères de fusion

La livraison est fusionnable lorsque :

- le build Web et Mobile réussit ;
- le catalogue ne contient que des définitions versionnées ;
- le secret reste exclusivement serveur ;
- un token falsifié ne peut pas être résolu ;
- un token d’une autre conversation ne peut pas être rendu ;
- aucun asset client n’est accepté ;
- les messages texte continuent de fonctionner ;
- le Mobile n’embarque aucune clé de signature ;
- l’absence de secret échoue explicitement sans fallback faible.
