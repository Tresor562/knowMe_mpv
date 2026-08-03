# KMD-036 — Protocole de stickers signés et bibliothèque d’origine

## Objectif

Ajouter des stickers visuels sûrs à la messagerie KnowMe sans accepter d’URL, de HTML, de SVG, de fichier ou d’asset arbitraire fourni par le client.

## Frontières de confiance

- le catalogue est fermé, versionné et défini côté serveur ;
- un utilisateur doit appartenir à la conversation avant de pouvoir envoyer un sticker ;
- le serveur crée le contenu persistant du message ;
- le jeton est lié à la conversation, au pack, au sticker, aux versions et à une date d’expiration ;
- les signatures HMAC sont vérifiées en temps constant ;
- la rotation de clés accepte une clé active et des clés précédentes ;
- un sticker invalide reste un texte opaque et n’est jamais interprété comme HTML ;
- les messages texte continuent de passer par le même anti-spam et la même persistance autoritaire.

## Livraison

1. catalogue original gratuit et versionné ;
2. contrat de présentation partagé par les réponses API ;
3. service de signature et de résolution côté NestJS ;
4. endpoint de catalogue authentifié ;
5. endpoint d’envoi de sticker vérifiant l’appartenance ;
6. enrichissement de l’historique et du temps réel ;
7. aperçu de notification neutre ;
8. interface Web intégrée à la conversation ;
9. expérience Mobile intégrée ;
10. tests de falsification, expiration et conversation croisée ;
11. configuration et documentation de rotation ;
12. validation Prisma, builds, tests unitaires et E2E.

## Hors périmètre

- marketplace payante ;
- packs créateurs ;
- upload utilisateur ;
- transfert ou revente ;
- droits Premium ;
- animation distante ;
- attribution de rôle, permission, badge ou avantage de jeu.
