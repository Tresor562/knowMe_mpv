# KMD-054 — Livraison Matchmaking social volontaire

## Résultat

KMD-054 introduit une file de mise en relation sociale fondée exclusivement sur des critères non sensibles choisis au moment de l’inscription.

Le système ne mesure pas la compatibilité personnelle. Il calcule une compatibilité opérationnelle entre deux demandes et explique chaque composant de son score.

## Livré

- opt-in désactivé par défaut ;
- préférence d’autoriser de nouvelles personnes ;
- objectifs, rythmes, langues, sujets et créneaux UTC fermés ;
- normalisation et hash déterministes ;
- score explicable borné ;
- marqueurs persistants confirmant l’absence de données sensibles, d’affinité, de messages privés et de localisation précise ;
- file unique par compte ;
- reçus d’idempotence ;
- appariement transactionnel concurrent sûr ;
- propositions expirables ;
- acceptation mutuelle ;
- refus, cooldown, blocage et déblocage ;
- sortie immédiate et remise en file conditionnelle ;
- événements anti-abus ;
- worker de maintenance borné ;
- permission `matchmaking.manage` et tableau d’exploitation ;
- notifications neutres ;
- export format 15 ;
- suppression et anonymisation ;
- expérience Web `/matchmaking` ;
- expérience Mobile native ;
- tests unitaires et E2E ;
- configuration et documentation d’architecture.

## Garanties permanentes

- aucune utilisation des réponses du Miroir d’affinité ;
- aucune lecture de message ou conversation ;
- aucune localisation précise ;
- aucune donnée de santé, religion, politique, orientation, biométrie ou finance ;
- aucun score de richesse, Premium, KnowCoins, XP ou popularité ;
- aucun boost payant ;
- aucune mise en contact acceptée unilatéralement ;
- aucun texte libre dans le calcul ;
- aucun score recalculé côté client ;
- aucune création automatique d’amitié ou de conversation avant double acceptation.

## Validation attendue

La livraison ne peut être fusionnée qu’après succès complet de :

1. génération Prisma ;
2. application PostgreSQL ;
3. builds API, Web et Mobile ;
4. tests unitaires ;
5. E2E complet d’opt-in, idempotence, appariement, acceptation, blocage, export et suppression.

## Suite réservée

KMD-055 pourra livrer la **connexion sociale post-acceptation**, avec demande d’amitié ou ouverture de conversation choisie par les deux personnes, protections anti-spam et révocation, sans contourner la double acceptation KMD-054.
