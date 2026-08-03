# KMD-034 — Cadeaux sociaux visuels et KnowCoins atomiques

## Objectif

KMD-034 permet à deux comptes liés par une amitié acceptée d’échanger un geste visuel original KnowMe.

Le système ne crée pas de monnaie transférable. Il ne crédite pas le destinataire, ne produit aucun avantage compétitif et ne peut attribuer ni rôle, ni badge Équipe KnowMe, ni entitlement.

## Sources de vérité

KMD-034 réutilise deux registres existants :

- `KnowCoinLedgerEntry` pour le débit irréversible et auditable de l’expéditeur ;
- `Notification` pour le reçu social reçu et son état de lecture.

Aucun second portefeuille et aucun solde parallèle ne sont créés.

Le reçu de cadeau contient un instantané immuable de la définition visuelle : clé, version, nom, description, emoji, rareté, jeton d’animation et prix. Une évolution future du catalogue ne modifie donc pas l’historique.

## Catalogue

Le catalogue est versionné dans `social-gift.catalog.ts`.

Chaque définition fournit :

- une clé stable ;
- une version ;
- un nom et une description originaux ;
- un emoji et un jeton d’animation interne ;
- un prix KnowCoins entier et positif ;
- une rareté visuelle ;
- un état actif.

Les clients consultent :

```text
GET /social/gifts/catalog
GET /social/gifts/policy
```

Le client envoie uniquement `giftKey`. Le prix est toujours résolu par le serveur.

## Envoi atomique

L’envoi utilise :

```text
POST /social/gifts
Idempotency-Key: gift:<recipient>:<gift>:<nonce>
```

Le corps contient :

```json
{
  "recipientId": "...",
  "giftKey": "spark",
  "message": "facultatif, 160 caractères maximum"
}
```

Dans une transaction PostgreSQL `SERIALIZABLE`, le serveur :

1. vérifie la clé d’idempotence ;
2. interdit l’auto-cadeau ;
3. résout le produit et le prix autoritaires ;
4. confirme que le destinataire existe et n’est pas suspendu ;
5. confirme une amitié `ACCEPTED` ;
6. applique les limites quotidiennes ;
7. débite le portefeuille KnowCoins de l’expéditeur ;
8. crée le reçu de notification du destinataire ;
9. publie l’événement temps réel seulement après le commit.

Si la transaction échoue, ni le débit ni le reçu ne persistent.

## Idempotence

La clé d’idempotence du client est stockée dans le registre KnowCoins, qui impose son unicité.

Un identifiant de reçu déterministe est dérivé de :

```text
senderId + idempotencyKey
```

Lors d’un replay, le serveur vérifie :

- le compte expéditeur ;
- le montant négatif attendu ;
- le type et la source du registre ;
- l’identifiant du reçu ;
- la clé du cadeau ;
- le destinataire ;
- le message.

Une même clé ne peut donc pas être réutilisée pour modifier le cadeau, son prix ou son destinataire.

## Anti-abus

La politique initiale impose par jour UTC :

- 20 cadeaux maximum ;
- 10 000 KnowCoins de dépense maximum.

Les cadeaux sont réservés aux amitiés acceptées. Les relations en attente, refusées, supprimées ou bloquées ne sont pas éligibles.

Le destinataire ne reçoit aucun KnowCoin. Cette règle évite le transfert de valeur, le blanchiment de récompenses, les marchés secondaires et les échanges hors plateforme.

## Propriétés immuables

Tous les cadeaux KMD-034 sont :

- purement visuels ;
- non convertibles en argent ;
- non revendables ;
- non transférables ;
- sans effet de jeu ;
- sans effet RBAC ;
- sans attribution Premium ou staff.

## Historique

Les routes suivantes sont authentifiées :

```text
GET /social/gifts/inbox
GET /social/gifts/sent
PATCH /social/gifts/:giftId/viewed
```

La boîte de réception provient des notifications `SOCIAL_GIFT` du compte.

L’historique envoyé provient des écritures `SOCIAL_GIFT_SENT` du registre KnowCoins. Le reçu et le débit ne peuvent donc pas diverger silencieusement.

## Temps réel

La notification est créée dans la transaction financière. Après le commit, `NotificationsService.publishCreated` émet `notification:created` vers la salle temps réel du destinataire.

Aucun événement de succès n’est envoyé avant la validation de la transaction.

## Confidentialité et suppression

Le reçu ne stocke pas le nom, le pseudo, l’email ou l’avatar de l’expéditeur. Il stocke seulement son identifiant de compte afin que les interfaces puissent demander le profil public actuel.

Lors de la suppression d’un compte, `SocialGiftsService.deleteForAccount` supprime :

- les cadeaux reçus par ce compte ;
- les reçus encore détenus par d’autres comptes lorsque ce compte en était l’expéditeur.

Le registre KnowCoins de l’expéditeur est supprimé ensuite par la cascade du compte. Les reçus sociaux ne conservent donc pas un identifiant pseudonyme après suppression.

Les cadeaux reçus apparaissent déjà dans l’export de compte via les notifications du compte. Les débits envoyés restent audités dans l’historique du portefeuille tant que le compte existe.

## Clients

### Web

La page `/gifts` affiche :

- le solde KnowCoins ;
- les amis acceptés ;
- le catalogue ;
- le message facultatif ;
- l’historique reçu et envoyé ;
- les limites serveur.

### Mobile

`SocialGiftsExperience` expose les mêmes garanties dans le profil Mobile. Le client Mobile génère une clé d’idempotence par action et ne transmet aucun prix.

## Hors périmètre

KMD-034 n’inclut pas :

- les cadeaux achetés directement en monnaie réelle ;
- la revente ou le transfert d’un cadeau reçu ;
- les cadeaux anonymes ;
- les enchères ou probabilités aléatoires ;
- les cadeaux de groupe ;
- les stickers de messagerie ;
- les avatars ;
- les effets compétitifs ;
- les remboursements automatiques après livraison.

## Critères de fusion

La livraison est fusionnable lorsque :

- le build API, Web et Mobile réussit ;
- les tests unitaires et E2E sont verts ;
- l’amitié acceptée est obligatoire ;
- le prix client est ignoré parce qu’il n’existe pas dans le contrat ;
- le débit et le reçu sont atomiques ;
- le replay ne crée aucun second débit ;
- les limites quotidiennes sont appliquées ;
- le destinataire ne reçoit aucun solde ;
- la suppression de compte efface les identifiants de reçus associés ;
- les clients affichent clairement la nature visuelle et non transférable.
