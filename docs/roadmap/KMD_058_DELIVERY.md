# KMD-058 — Configuration ICE et credentials TURN éphémères

## Objectif

Rendre les appels utilisables derrière des réseaux restrictifs sans embarquer de secret TURN dans le navigateur ni conserver de données réseau sensibles.

## Livrables

- endpoint participant `GET /calls/:callId/ice-configuration` ;
- validation de l'appel vivant par KMD-057 ;
- URL STUN/TURN pilotées par environnement ;
- credentials TURN REST HMAC-SHA1 liés à l'utilisateur, l'appel et l'expiration ;
- TTL borné ;
- refus fermé en production sans TURN ;
- quota de renouvellement par participant et appel ;
- audit par empreinte sans secret ;
- client Web utilisant exclusivement la configuration serveur ;
- tests unitaires de cryptographie, confidentialité, état et quotas ;
- documentation d'exploitation et de rotation.

## Garanties permanentes

- `CALL_TURN_SECRET` ne quitte jamais l'API ;
- aucun credential éphémère n'est persisté ;
- aucun utilisateur extérieur à l'appel ne reçoit la configuration ;
- un appel terminal ne peut plus demander de credentials ;
- aucun serveur STUN public n'est codé en dur dans l'application Web.

## Retour arrière

Le courtier peut être désactivé en retirant la route, mais le client ne doit pas réintroduire de secret statique ni de relais codé en dur. Un retour temporaire à STUN seul doit être explicite, limité aux environnements hors production et documenté.

## Suite réservée

KMD-059 — disponibilité, confidentialité, préparation des appareils et contrôles d'appel.
