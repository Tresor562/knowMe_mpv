# KMD-053 — Plan de livraison

## Domaine

Jeu d’affinité explicable, volontaire et respectueux de la confidentialité.

## Dépendances fusionnées

- KMD-008 et KMD-016 : contenus versionnés et historiques immuables ;
- KMD-012 : export, suppression et minimisation ;
- KMD-038 et KMD-042 : relations, cercles et profils collectifs ;
- KMD-049 : erreurs localisables ;
- KMD-052 : catalogue, sessions, séquences, idempotence et replays autoritaires.

## Blocs fonctionnels

1. Préférences Prisma d’invitation et de partage.
2. Valeurs sûres par défaut sans écriture implicite.
3. Définition `affinity-mirror@1` immuable.
4. Six questions versionnées en trois catégories.
5. Moteur déterministe sans gagnant.
6. Consentement explicite des deux participants.
7. Choix individuel de partage masqué pendant la session.
8. Réponses cachées jusqu’à la comparaison.
9. Alternance du premier répondant.
10. Score descriptif global borné.
11. Résultats par catégorie.
12. Explications factuelles et avertissement non diagnostique.
13. Détails uniquement avec double accord.
14. Restriction aux amis activée par défaut.
15. Refus global des invitations.
16. Façade de domaine appliquant les politiques.
17. Replay expurgé sans double accord.
18. Vérification serveur et portée explicite du replay.
19. Export de compte format 14 uniquement en présence de données.
20. Suppression réelle des réponses, états et snapshots.
21. Recalcul des hashes après expurgation.
22. Tests unitaires de consentement, scoring et confidentialité.
23. E2E PostgreSQL de politique, session, replay, export et suppression.
24. Surface Web dédiée.
25. Surface Mobile native dédiée.
26. Isolation stricte de Pulse Duel.
27. Documentation d’architecture et registre canonique.

## Critères de validation

- Prisma generate et db push verts ;
- builds API, Web et Mobile verts ;
- tests unitaires verts ;
- E2E complet vert ;
- aucun score calculé dans les clients ;
- aucun gagnant ;
- aucun détail sans double accord ;
- aucune réponse supprimée encore présente dans les snapshots ;
- aucune fusion avant succès complet de la CI.

## Hors périmètre

Diagnostics, recommandations relationnelles, classement public, matchmaking par réponses, publicité ciblée, entraînement de modèle, récompenses économiques, mises et achats de puissance.
