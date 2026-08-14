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

## Disponibilité et préparation — KMD-059

Chaque compte authentifié dispose de préférences d'appel autoritaires :

- appels entrants activés ou désactivés ;
- autorisation distincte des appels audio et vidéo ;
- plage silencieuse en minutes locales et fuseau IANA ;
- micro et caméra activés ou non par défaut ;
- passage obligatoire ou non par l'aperçu des appareils.

L'API expose :

- `GET /calls/preferences` pour obtenir les valeurs persistées ou les valeurs par défaut ;
- `PUT /calls/preferences` pour remplacer l'ensemble des préférences avec `expectedVersion`.

Une plage silencieuse peut traverser minuit. Lorsque ses deux bornes sont égales et qu'elle est activée, elle couvre toute la journée. La création d'un appel est refusée par le serveur si le destinataire est indisponible, a désactivé le média demandé ou se trouve dans sa plage silencieuse. Le refus utilise toujours `CALL_RECIPIENT_UNAVAILABLE` afin de ne pas révéler la raison privée au demandeur.

Les mises à jour sont validées, versionnées et auditées. Les préférences participent à l'export et à la suppression du compte. Les choix micro, caméra et aperçu ne donnent jamais accès aux périphériques côté serveur : ils préparent uniquement l'expérience locale avant l'appel.

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

Terminer KMD-059 côté Web avec un écran de préparation local, la sélection des périphériques disponibles et des états explicites de permission, sans transmettre d'identifiant matériel ni de flux média à l'API.
