# KMD-050 — Politique de téléchargement et gouvernance du cache média

## Statut

Livraison en validation. Aucune fusion avant génération Prisma, synchronisation PostgreSQL, builds des packages/API/Web/Mobile, tests unitaires et E2E entièrement verts.

## Objectif

Permettre à chaque personne de choisir les types de médias copiés localement selon le réseau, voir l’espace utilisé et nettoyer les copies, sans affaiblir le stockage privé KMD-014 ni exposer les jetons courts.

## Blocs livrés

1. durcissement du service worker Web ;
2. interdiction de cache API/média/authentifié ;
3. package partagé de politique média ;
4. types média canoniques ;
5. classes réseau canoniques ;
6. valeurs par défaut prudentes ;
7. normalisation déterministe ;
8. règle économie de données ;
9. règle arrière-plan ;
10. règle de quota ;
11. mapping MIME autoritaire ;
12. préférence Prisma versionnée ;
13. transaction sérialisable ;
14. conflit multi-appareil stable ;
15. audit des choix ;
16. endpoints authentifiés ;
17. export version 11 conditionnel ;
18. suppression transactionnelle ;
19. cache Web dédié ;
20. clés Web synthétiques sans URL signée ;
21. métadonnées Web minimales ;
22. URL objet révocable ;
23. statistiques Web ;
24. purge Web ;
25. éviction Web par dernier accès ;
26. cache Mobile Expo temporaire ;
27. index Mobile local sans jeton ;
28. détection réseau NetInfo ;
29. statistiques et purge Mobile ;
30. éviction Mobile par dernier accès ;
31. réglages Web synchronisés ;
32. réglages Mobile natifs ;
33. tests de politique ;
34. E2E de version, conflit, export et suppression ;
35. documentation d’architecture et règles d’intégration.

## Garanties

- aucun cache générique des réponses authentifiées ;
- aucun jeton ou chemin distant dans l’inventaire local ;
- aucun téléchargement automatique sur réseau inconnu ou hors ligne ;
- itinérance désactivée par défaut ;
- économie de données respectée par défaut ;
- quota borné entre 64 et 4096 Mo ;
- copie temporaire distincte du média serveur chiffré ;
- export historique inchangé tant qu’aucune préférence n’est persistée ;
- inventaires locaux absents de l’export ;
- préférence supprimée avec le compte.

## Hors périmètre

- remplacement du pipeline d’upload, chiffrement ou modération KMD-014 ;
- synchronisation serveur des fichiers locaux ;
- sauvegarde cloud des caches ;
- stockage permanent dans la galerie sans action explicite ;
- contournement des droits d’accès lorsque le média a été révoqué ;
- téléchargement automatique si la plateforme ne peut pas déterminer le contexte réseau.
