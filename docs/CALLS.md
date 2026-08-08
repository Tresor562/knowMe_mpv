# Appels WebRTC KnowMe

## Cycle de vie autoritaire — KMD-057

La signalisation transite par Socket.IO mais l'API contrôle l'identité, les participants, l'état, l'expiration et l'historique de chaque appel.

États persistés : `RINGING`, `ACTIVE`, `ENDED`, `REJECTED`, `MISSED` et `CANCELLED`.

Garanties :

- conversation partagée obligatoire ;
- aucun identifiant d'appel accepté depuis le client ;
- un seul appel vivant par participant ;
- création idempotente et limite anti-spam ;
- expiration serveur après quarante-cinq secondes ;
- historique et notifications d'appels manqués ;
- aucune offre SDP, réponse SDP, candidat ICE ou adresse réseau persistée ;
- aucun enregistrement audio ou vidéo.

## Transport sécurisé — KMD-058

Le navigateur ne contient plus de serveur STUN codé en dur. Chaque participant demande :

`GET /calls/:callId/ice-configuration`

L'API vérifie que le demandeur participe à un appel vivant, puis retourne une configuration ICE limitée dans le temps.

Les identifiants TURN suivent le mécanisme REST coturn :

- nom d'utilisateur lié à l'expiration, au participant et à l'appel ;
- credential HMAC-SHA1 calculé avec un secret exclusivement serveur ;
- TTL borné entre soixante et trois mille six cents secondes ;
- aucun credential persistant ;
- journalisation par empreinte SHA-256, jamais par secret ou credential brut ;
- douze émissions maximum par participant et par appel sur dix minutes ;
- refus fermé en production si TURN est requis mais absent.

Variables :

- `CALL_STUN_URLS_JSON` ;
- `CALL_TURN_URLS_JSON` ;
- `CALL_TURN_SECRET` ;
- `CALL_TURN_TTL_SECONDS` ;
- `CALL_REQUIRE_TURN_IN_PRODUCTION` ;
- `CALL_MAINTENANCE_ENABLED` ;
- `CALL_MAINTENANCE_INTERVAL_MS` ;
- `CALL_MAINTENANCE_BATCH_SIZE`.

## Événements temps réel

- `call:offer`
- `call:incoming`
- `call:answer`
- `call:answered`
- `call:ice-candidate`
- `call:end`
- `call:ended`
- `call:error`

## Étape suivante

KMD-059 doit ajouter les préférences de disponibilité, les horaires silencieux, le contrôle audio/vidéo et la préparation des appareils avant appel.
