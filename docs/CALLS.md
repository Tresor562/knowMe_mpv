# Appels WebRTC — MVP

La signalisation passe par Socket.IO.

Événements :

- `call:offer`
- `call:incoming`
- `call:answer`
- `call:answered`
- `call:ice-candidate`
- `call:end`
- `call:ended`

## Important

Le serveur STUN public suffit parfois en développement, mais pas en production.

Une version fiable nécessite :

- un serveur TURN ;
- HTTPS ;
- gestion des permissions caméra/micro ;
- état d’appel persistant ;
- historique des appels ;
- gestion des appels manqués ;
- tests sur réseaux mobiles.
