# KMD-048 — Centre de notifications intelligent

## Objectif

Construire une couche globale et cohérente au-dessus des événements `Notification` existants, sans dupliquer la persistance des transports KMD-046/KMD-047.

## Principes

- toute notification métier reste persistée pour l’audit ;
- la visibilité, le temps réel et les résumés sont décidés côté serveur ;
- les catégories Sécurité et Système restent toujours visibles ;
- les heures calmes et le fuseau sont évalués par l’API ;
- la règle la plus restrictive l’emporte ;
- les actions utilisateur sont idempotentes ;
- les archives, reports et masquages ne détruisent pas l’événement original ;
- le centre ne stocke aucun jeton push, adresse e-mail ou secret ;
- les endpoints chiffrés, quotas, circuits fournisseurs et files mortes restent la responsabilité de KMD-046/KMD-047.

## Livraison

1. schéma Prisma pour préférences, états, reçus et file de résumé ;
2. classification stable des catégories ;
3. politiques de visibilité, temps réel et résumé ;
4. heures calmes traversant minuit ;
5. préférences globales normalisées ;
6. pagination stable par curseur ;
7. vues active, archivée, reportée et masquée ;
8. regroupement horaire des événements collectifs ;
9. actions masquer, archiver, reporter et restaurer ;
10. reçus d’action idempotents ;
11. compteur non lu après politique serveur ;
12. diffusion temps réel soumise à la politique ;
13. file de résumés horaires et quotidiens ;
14. worker de résumé multi-instance idempotent ;
15. dashboard d’exploitation administrateur ;
16. centre Web complet ;
17. composant Mobile réutilisable ;
18. tests unitaires et E2E ;
19. documentation d’architecture ;
20. mise à jour du registre canonique après fusion.

## Modes

- `INSTANT` : temps réel immédiat hors heures calmes ;
- `HOURLY` : résumé in-app à la fin de l’heure ;
- `DAILY` : résumé in-app quotidien selon le fuseau ;
- `CENTER_ONLY` : visible uniquement lors de l’ouverture du centre.

Les événements critiques ne sont jamais supprimés par les préférences et restent instantanés.

## Hors périmètre

- nouveau fournisseur push ;
- stockage de jeton brut ;
- duplication du dispatcher résilient ;
- marketing automatisé ;
- données financières ou KnowCoins dans les préférences ;
- suppression physique des événements d’audit.
