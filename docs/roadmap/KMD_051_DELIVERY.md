# KMD-051 — Fondation Créateurs et audience

## Statut

Livraison en validation. Aucune fusion avant génération Prisma, synchronisation PostgreSQL, builds API/Web/Mobile, tests unitaires et E2E entièrement verts.

## Objectif

Créer un statut créateur volontaire, une audience directionnelle, une page publique et des statistiques minimisées sans confondre créateur, staff, Premium ou vérification.

## Blocs livrés

1. modèle de profil créateur ;
2. slug public unique ;
3. version optimiste ;
4. état actif, en pause ou suspendu ;
5. visibilité publique ou non listée ;
6. catégories contrôlées ;
7. séparation staff/Premium/vérification ;
8. graphe d’abonnement directionnel ;
9. suivi idempotent ;
10. désabonnement idempotent ;
11. compteur atomique d’abonnés ;
12. notification unique de suivi ;
13. page publique serveur ;
14. publications récentes ;
15. trois positions d’épinglage ;
16. validation de propriété des pins ;
17. métriques quotidiennes ;
18. vues uniques authentifiées ;
19. HMAC journalier sans identifiant brut ;
20. rétention de 35 jours ;
21. worker borné de nettoyage ;
22. tableau de bord propriétaire sur 30 jours ;
23. agrégats likes/commentaires ;
24. permission `creators.manage` ;
25. suspension avec raison ;
26. restauration en pause ;
27. audit de gouvernance ;
28. export version 12 conditionnel ;
29. exclusion des HMAC de l’export ;
30. suppression transactionnelle ;
31. page Web publique ;
32. réglages et tableau de bord Web ;
33. réglages et statistiques Mobile ;
34. E2E activation, suivi, métriques, gouvernance et suppression ;
35. documentation d’architecture et frontières de monétisation.

## Garanties

- aucun rôle, badge staff, Premium ou vérification accordé ;
- aucun stockage d’adresse IP ou d’empreinte appareil pour les vues ;
- aucune vue anonyme comptée par une identification cachée ;
- aucun double comptage quotidien par compte et créateur ;
- aucun double abonnement ou double notification ;
- aucune publication d’un autre auteur épinglée ;
- aucune réactivation automatique après suspension ;
- aucun reçu haché dans l’export ;
- aucune donnée créateur après suppression du compte.

## Hors périmètre

Monétisation, revenus, commissions, codes créateur, campagnes de marque, publicité, lives, abonnements payants et paiements créateurs.
