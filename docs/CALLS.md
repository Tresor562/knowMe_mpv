# Appels WebRTC KnowMe

## État livré par KMD-057

La signalisation continue de transiter par Socket.IO, mais elle n'est plus autoritaire.

Avant toute offre WebRTC, l'API crée un `CallSession` et émet l'identifiant d'appel. Chaque événement `call:offer`, `call:answer`, `call:ice-candidate` ou `call:end` est ensuite vérifié contre cet état persistant.

États persistés :

- `RINGING` ;
- `ACTIVE` ;
- `ENDED` ;
- `REJECTED` ;
- `MISSED` ;
- `CANCELLED`.

Garanties :

- conversation partagée obligatoire ;
- aucun identifiant d'appel accepté depuis le client ;
- un seul appel vivant par participant ;
- création idempotente et limite anti-spam ;
- expiration serveur après quarante-cinq secondes ;
- historique d'appels et notifications d'appels manqués ;
- aucune offre SDP, réponse SDP, candidat ICE ou adresse réseau persistée ;
- aucun enregistrement audio ou vidéo.

## Événements temps réel

- `call:offer`
- `call:incoming`
- `call:answer`
- `call:answered`
- `call:ice-candidate`
- `call:end`
- `call:ended`
- `call:error`

## Exploitation

Le worker d'expiration utilise :

- `CALL_MAINTENANCE_ENABLED` ;
- `CALL_MAINTENANCE_INTERVAL_MS` ;
- `CALL_MAINTENANCE_BATCH_SIZE`.

## Étapes suivantes

KMD-058 doit remplacer le STUN public codé en dur par une configuration ICE livrée par le serveur et des identifiants TURN éphémères, sans exposer le secret TURN.

KMD-059 doit ajouter les préférences de disponibilité, les horaires silencieux et la préparation des appareils avant appel.
