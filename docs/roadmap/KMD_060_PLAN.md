# KMD-060 — Liens courts sécurisés et navigation profonde

## Objectif

Fournir un système serveur autoritaire de liens courts pour les profils, défis, groupes, communautés, événements, cadeaux et packs, avec redirection Web/Mobile sûre, révocation, expiration et analytics minimisés.

## Dépendances

- `main` stable après KMD-058 ;
- authentification, audit, feature flags, permissions et stockage métier existants ;
- KMD-059 n'est pas requis.

## Livrables

- modèle persistant `ShortLink` avec code non séquentiel et destination allowlistée ;
- création authentifiée et idempotente de liens ;
- résolution publique privacy-safe ;
- expiration et révocation ;
- prévention des collisions ;
- redirection Web vers une destination interne connue ;
- métadonnées de deep-link compatibles Android/iOS sans URL externe arbitraire ;
- compteur agrégé de résolutions sans journaliser d'adresse IP brute ;
- audit des créations/révocations ;
- export/suppression de compte pour les liens possédés ;
- tests unitaires et E2E ;
- documentation de retour arrière.

## Frontières de sécurité

- aucune URL externe libre fournie par le client ;
- aucune redirection `javascript:`, `data:`, `file:` ou schéma arbitraire ;
- les destinations sont des types métier allowlistés et des identifiants opaques ;
- la résolution publique ne révèle ni propriétaire interne ni données privées ;
- aucun identifiant séquentiel exposé comme code court ;
- un lien expiré, révoqué ou inconnu renvoie une erreur stable sans oracle supplémentaire ;
- les analytics restent agrégés et ne stockent pas d'IP brute.

## Retour arrière

Désactiver la création via feature flag et conserver la résolution des liens existants pendant une fenêtre de migration. La suppression de la route publique ne doit pas laisser des liens redirigeant vers des destinations externes non contrôlées.
