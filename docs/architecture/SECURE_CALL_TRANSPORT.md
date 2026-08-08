# KMD-058 — Transport sécurisé des appels

## Menace traitée

Une configuration STUN publique codée dans le navigateur ne garantit ni la disponibilité derrière les NAT restrictifs, ni le contrôle du relais, ni la rotation des accès. Un secret TURN statique côté client serait récupérable et réutilisable hors KnowMe.

## Courtier ICE

L'API agit comme courtier de configuration ICE. Elle vérifie le JWT, l'appartenance exacte à l'appel et l'état `RINGING` ou `ACTIVE` avant toute émission.

La réponse contient uniquement les URL ICE nécessaires et, lorsqu'un relais est configuré, un nom d'utilisateur et un credential temporaires. Le secret partagé coturn reste côté serveur.

## Construction des credentials

Le nom d'utilisateur est :

`<expiration-unix>:<user-id>:<call-id>`

Le credential est :

`base64(HMAC-SHA1(CALL_TURN_SECRET, username))`

Cette forme est compatible avec le mécanisme TURN REST de coturn. Le TTL est borné et doit rester court.

## Minimisation

KnowMe ne persiste jamais :

- le secret TURN ;
- le credential éphémère ;
- une description SDP ;
- un candidat ICE ;
- une adresse réseau extraite du navigateur.

Le journal conserve seulement l'expiration, les indicateurs STUN/TURN et une empreinte SHA-256 non réutilisable comme credential.

## Politique de production

Lorsque `NODE_ENV=production` et `CALL_REQUIRE_TURN_IN_PRODUCTION` n'est pas explicitement désactivé, l'API refuse de fournir une configuration si les URL TURN ou le secret sont absents.

Cette politique évite un faux succès reposant uniquement sur STUN dans des environnements où les appels doivent fonctionner derrière des réseaux restrictifs.

## Rotation

La rotation du secret invalide naturellement les credentials futurs signés avec l'ancienne valeur. Le TTL court limite la fenêtre durant laquelle les credentials déjà émis restent valides. La rotation doit être coordonnée avec coturn.

## Anti-abus

Chaque participant est limité à douze émissions par appel sur dix minutes. Le quota protège le service de signature et le relais contre les boucles de renouvellement ou les clients compromis.
