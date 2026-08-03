# KMD-047 — Résilience et gouvernance des notifications

## Objectif

Faire évoluer l’orchestration KMD-046 vers un système de livraison explicable, limité, réparable et indépendant des fournisseurs.

## 20 blocs

1. contrat de livraison et limites de confiance ;
2. persistance des préférences, fournisseurs, suppressions, quotas, modèles, reçus et file morte ;
3. politiques de priorité, routage et reprise ;
4. configuration runtime de résilience ;
5. préférences utilisateur par canal ;
6. liste de suppression autoritaire ;
7. quotas transactionnels ;
8. catalogue de modèles versionnés ;
9. santé fournisseur et circuit breaker ;
10. file morte administrable ;
11. reçus fournisseurs idempotents ;
12. planification de reprise adaptative ;
13. routage multi-canal ;
14. dispatcher résilient ;
15. maintenance périodique ;
16. alertes opérationnelles ;
17. dashboard enrichi ;
18. cycle de vie utilisateur ;
19. tests unitaires ;
20. câblage et documentation de livraison.

## Principes

- le client ne choisit jamais un fournisseur ni un statut de livraison ;
- les préférences facultatives sont relues avant chaque tentative ;
- les alertes obligatoires restent séparées des communications facultatives ;
- les quotas sont évalués côté serveur ;
- les reprises utilisent un backoff borné avec jitter déterministe ;
- un fournisseur dégradé ouvre son circuit et cesse de recevoir du trafic ;
- une tentative définitivement échouée rejoint une file morte réparable ;
- les reçus fournisseurs sont authentifiés, idempotents et corrélés ;
- aucune adresse d’utilisateur, clé fournisseur ou charge complète n’entre dans les journaux ;
- chaque transition sensible reste auditée par son état persistant.

## Sortie attendue

Une panne ou une dégradation externe ne bloque pas la boîte KnowMe, ne crée pas de boucle infinie et peut être diagnostiquée puis rejouée sans double envoi.