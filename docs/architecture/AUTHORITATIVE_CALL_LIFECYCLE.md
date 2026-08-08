# KMD-057 — Cycle de vie autoritaire des appels

## Frontière d'autorité

Le navigateur contrôle uniquement les flux média locaux et les objets WebRTC éphémères. Le serveur contrôle l'identité de l'appel, ses participants, son état, son expiration et son historique.

Le client ne peut fournir ni identifiant canonique, ni participant alternatif, ni état final. Les descriptions SDP et candidats ICE transitent en temps réel mais ne sont jamais écrits en base.

## Création

`POST /calls` exige un destinataire appartenant à une conversation partagée. L'opération est idempotente, limitée en vélocité et refuse tout participant déjà engagé dans un appel `RINGING` ou `ACTIVE`.

Le serveur retourne un identifiant opaque. Cet identifiant devient obligatoire pour toute signalisation ultérieure.

## Transitions

- `RINGING` vers `ACTIVE` : uniquement lorsque le destinataire répond après une offre autorisée.
- `RINGING` vers `REJECTED` : refus explicite du destinataire.
- `RINGING` vers `CANCELLED` : annulation avant réponse.
- `RINGING` vers `MISSED` : expiration autoritaire.
- `ACTIVE` vers `ENDED` : raccrochage d'un participant.

Toute autre transition retourne un code d'erreur stable.

## Confidentialité

La base conserve les participants, le type audio/vidéo, les horodatages et la raison terminale. Elle ne conserve aucun contenu média, SDP, ICE, adresse IP issue de WebRTC, secret TURN ou diagnostic réseau détaillé.

## Résilience

Un worker borné marque les appels expirés et émet une notification d'appel manqué. Les mises à jour critiques utilisent des transactions sérialisables et des versions optimistes.

## Cycle de vie du compte

Le domaine expose un export minimisé et une suppression ordonnée : un appel vivant est annulé, les reçus personnels sont supprimés et les identifiants historiques sont remplacés par un tombstone.

## Dépendance suivante

KMD-058 doit fournir la configuration ICE et les identifiants TURN éphémères. Le secret de signature reste exclusivement côté serveur.
