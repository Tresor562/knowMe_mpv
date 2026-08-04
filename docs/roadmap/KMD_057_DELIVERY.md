# KMD-057 — Cycle de vie persistant et autoritaire des appels

## Objectif

Remplacer les identifiants d'appel inventés par le navigateur et la signalisation sans mémoire par un domaine serveur persistant, traçable et respectueux de la confidentialité.

## Livrables

- modèles Prisma `CallSession`, `CallEvent` et `CallReceipt` ;
- création idempotente d'un appel avec identifiant serveur ;
- validation des participants et de la conversation partagée ;
- machine d'états autoritaire ;
- autorisation des offres, réponses, candidats ICE et fins d'appel ;
- limite de vélocité et exclusion des participants déjà occupés ;
- worker d'expiration et notifications d'appels manqués ;
- historique API et interface Web ;
- export de domaine et primitives d'anonymisation ;
- tests E2E.

## Garanties permanentes

- aucun contenu audio ou vidéo n'est enregistré ;
- aucune description SDP, candidat ICE ou adresse réseau WebRTC n'est persisté ;
- le client ne choisit jamais l'identifiant canonique ;
- seul un participant exact peut signaler ou terminer l'appel ;
- aucun appel ne modifie un solde, une permission ou un entitlement.

## Retour arrière

La fonction peut être retirée en désactivant les routes et la signalisation autoritaire. Les tables sont additives. Les anciens événements Socket.IO ne doivent toutefois pas être réactivés sans contrôle serveur.

## Validation

La CI doit exécuter génération Prisma, compilation API/Web et E2E du cycle complet : création, idempotence, offre, réponse, ICE, fin, expiration, notification et historique minimisé.

## Suite réservée

KMD-058 — distribution sécurisée de configuration ICE et identifiants TURN éphémères.
