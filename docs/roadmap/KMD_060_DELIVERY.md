# KMD-060 — Liens courts sécurisés et navigation profonde

## État

En validation sur la PR #110. Cette livraison reste indépendante de KMD-059, dont la PR #108 demeure en validation matérielle réelle.

## Objectif

Permettre le partage de destinations KnowMe avec des codes courts non séquentiels et des deep links contrôlés, sans transformer le service en redirecteur ouvert ni exposer des données privées.

## Livrables

- persistance multi-fichier Prisma `ShortLink` et `ShortLinkReceipt` ;
- codes aléatoires base64url issus de 12 octets cryptographiques ;
- création authentifiée et idempotente derrière `short_links.creation` ;
- feature flag livré désactivé par défaut ;
- révocation idempotente et expiration bornée à un an ;
- résolution publique avec erreur identique pour lien inconnu, expiré ou révoqué ;
- compteur de résolutions agrégé et date de dernière résolution ;
- aucune adresse IP brute stockée par le sous-système de liens ;
- aucune URL externe arbitraire persistée ou acceptée ;
- cibles allowlistées : profil, défi, groupe, communauté, événement, cadeau et pack de stickers ;
- autorisation serveur pour profils existants, défis, groupes, cercles/communautés et cadeaux reçus ;
- événements et packs de stickers fermés par défaut jusqu'à liaison explicite de leur modèle d'accès canonique ;
- route Web `/s/:code` avec une seconde vérification interdisant une redirection externe ;
- export compte au format 19 lorsqu'un lien existe ;
- suppression des liens et receipts lors de la suppression du compte ;
- tests unitaires des destinations et tests E2E d'idempotence, expiration, révocation, autorisation, confidentialité et cycle de compte.

## Garanties permanentes

- un client ne peut pas fournir une URL libre comme destination ;
- `javascript:`, `data:`, chemins absolus et traversal sont refusés ;
- le code public ne contient pas l'identifiant du propriétaire ;
- la résolution publique ne renvoie pas `ownerId` ;
- une cible privée exige une autorisation serveur réelle ;
- une famille de cible non raccordée à son modèle d'autorisation reste indisponible ;
- la création peut être coupée sans déploiement via feature flag ;
- aucune donnée de navigation réseau brute n'est requise pour les analytics de base.

## Validation requise avant fusion

- `prisma:generate` ;
- `prisma:push` PostgreSQL ;
- build monorepo ;
- tests unitaires ;
- tests API E2E ;
- PR mergeable et CI verte sur le head final.

## Retour arrière

Désactiver `short_links.creation` pour bloquer immédiatement toute nouvelle création. Les liens déjà émis peuvent continuer à être résolus pendant une fenêtre de migration ou être révoqués. Aucun rollback ne doit introduire de redirecteur vers une URL fournie librement par le client.

## Suite

Le prochain identifiant KMD ne doit être attribué qu'après validation de KMD-060 et inspection du `main` canonique, des PR ouvertes et des dépendances restantes. KMD-059 conserve son identifiant et sa validation matérielle indépendante.
