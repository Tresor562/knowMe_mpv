# KMD-054 — Plan de livraison

## Domaine

Matchmaking social volontaire, explicable et limité à des critères non sensibles.

## Dépendances fusionnées

- KMD-004 : RBAC ;
- KMD-012 : export, suppression et minimisation ;
- KMD-015 : anti-abus persistant ;
- KMD-046 à KMD-048 : notifications et centre utilisateur ;
- KMD-049 : erreurs localisables ;
- KMD-052 : transactions autoritaires et concurrence ;
- KMD-053 : garanties de volontariat et de non-profilage relationnel.

## Blocs fonctionnels

1. Schéma Prisma des préférences, files, propositions, décisions, blocages, événements et reçus.
2. Opt-in désactivé par défaut sans écriture implicite.
3. Objectifs sociaux fermés.
4. Rythmes fermés.
5. Langues explicitement choisies.
6. Liste fermée de sujets non sensibles.
7. Créneaux UTC bornés et validés.
8. Normalisation et hash déterministes.
9. Algorithme explicable borné sur 100.
10. Exclusion technique des données sensibles.
11. Exclusion technique des réponses d’affinité.
12. Exclusion technique des conversations privées.
13. Exclusion technique de la localisation précise.
14. File unique et idempotente par compte.
15. Appariement `Serializable` avec versions optimistes.
16. Proposition unique et expiration de vingt-quatre heures.
17. Acceptation mutuelle obligatoire.
18. Refus avec cooldown de quatorze jours.
19. Blocage révocable et exclusion bidirectionnelle.
20. Sortie immédiate de la file.
21. Remise en file conditionnée au consentement restant.
22. Limites anti-abus persistantes.
23. Worker borné d’expiration et d’appariement.
24. Permission `matchmaking.manage`.
25. Tableau d’exploitation sans données privées.
26. Export format 15 seulement en présence de données.
27. Suppression transactionnelle et anonymisation des connexions acceptées.
28. Tests unitaires de critères, score et exclusions.
29. E2E d’opt-in, idempotence, proposition, décisions, blocage, export et suppression.
30. Surface Web.
31. Surface Mobile native.
32. Configuration et documentation d’architecture.
33. Registre canonique.

## Critères de validation

- Prisma generate et db push verts ;
- builds API, Web et Mobile verts ;
- tests unitaires verts ;
- E2E complet vert ;
- aucune dépendance vers les réponses d’affinité ou les conversations ;
- aucun champ de localisation précise ou de donnée sensible ;
- aucune priorité payante ;
- aucune fusion avant succès complet de la CI.

## Hors périmètre

Rencontres amoureuses, diagnostic, recommandation relationnelle, critères sensibles, GPS, classement de popularité, boost payant, publicité ciblée, entraînement de modèle, mise et récompense économique.
