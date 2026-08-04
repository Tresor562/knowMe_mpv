# KMD-052 — Plan de livraison

## Domaine

Game Platform autoritaire et fondation déterministe des jeux KnowMe.

## Dépendances fusionnées

- KMD-002 : erreurs stables et audit ;
- KMD-004 : RBAC ;
- KMD-011 : sessions et sécurité des comptes ;
- KMD-012 : export et suppression ;
- KMD-015 : anti-abus et gouvernance ;
- KMD-046 à KMD-048 : notifications et centre utilisateur ;
- KMD-049 : erreurs localisables.

## Blocs fonctionnels

1. Schéma Prisma des définitions, sessions, participants, actions et replays.
2. Catalogue versionné et checksum immuable.
3. Contrat d’adaptateur déterministe.
4. Jeu de référence Pulse Duel V1.
5. Création de session idempotente.
6. Invitations fermées et contrôle d’éligibilité.
7. Rejoindre et activation atomique.
8. État serveur canonique et hash SHA-256.
9. Séquence monotone et concurrence optimiste.
10. Actions idempotentes avec reçus persistants.
11. Choix caché dans l’état public.
12. Résultat et gagnant calculés uniquement par le serveur.
13. Reconnexion et resynchronisation.
14. Abandon et annulation contrôlés.
15. Replay terminal reproductible et vérifié.
16. Expiration bornée des sessions.
17. Tableau d’exploitation et permission `games.manage`.
18. Export minimisé et suppression/anonymisation.
19. Tests unitaires déterministes.
20. E2E complet avec falsification, replay et cycle de vie.
21. Surface Web.
22. Surface Mobile native.
23. Configuration d’exploitation.
24. Documentation d’architecture et registre canonique.

## Critères de validation

- Prisma generate et db push verts ;
- builds API, Web et Mobile verts ;
- tests unitaires verts ;
- E2E complet vert ;
- aucune graine active exposée ;
- aucune entrée client de score, gagnant, état ou mise ;
- aucune fusion avant succès complet de la CI.

## Hors périmètre

Matchmaking, tournois, ELO, spectateurs, récompenses économiques, paris, mises, cash prizes et achats de puissance.
