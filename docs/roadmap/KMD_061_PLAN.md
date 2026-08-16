# KMD-061 — Registre autoritaire de liens courts

## Objectif

Étendre KMD-060 avec un registre serveur persistant pour les liens courts KnowMe, sans créer un second contrat de deep link ni un redirecteur ouvert.

KMD-061 dépend directement de KMD-060 / PR #109, qui définit le contrat partagé `@knowme/link-contract`, le schéma `knowme://v1/...` et les chemins `/open/v1/...`.

KMD-061 reste indépendant de KMD-059 : aucune validation matérielle d’appel n’est contournée ou modifiée.

## Livrables

- registre Prisma `ShortLink` et receipts idempotents ;
- codes courts non séquentiels issus de 12 octets cryptographiques ;
- création authentifiée derrière le feature flag serveur `short_links.creation` ;
- expiration facultative bornée à un an ;
- révocation idempotente ;
- aperçu public anti-phishing avant continuation ;
- résolution publique vers le contrat KMD-060 uniquement ;
- réautorisation de la cible lors de chaque aperçu et résolution ;
- analytics agrégés `resolveCount` et `lastResolvedAt` sans stockage d’IP brute par ce sous-système ;
- export et suppression avec le cycle de vie du compte ;
- interface Web `/s/:code` sans redirection automatique ;
- tests unitaires et PostgreSQL E2E.

## Cibles

KMD-061 ne change pas l’allowlist de KMD-060 :

- `profile` ;
- `challenge` ;
- `community` ;
- `event` ;
- `gift` ;
- `sticker-pack`.

Les cibles dont le modèle d’autorisation n’est pas encore lié explicitement au registre restent fermées par défaut. En particulier, `event` et `sticker-pack` ne sont pas créables dans cette livraison tant que leur autorité canonique n’est pas raccordée.

## Frontières de sécurité

- aucune URL libre n’est acceptée du client ;
- aucune route admin ou paramètre `next` n’est accepté ;
- le format de destination est construit exclusivement par `@knowme/link-contract` ;
- l’aperçu ne révèle ni `ownerId`, ni `targetId` ;
- un lien inconnu, expiré, révoqué ou devenu non autorisé renvoie la même erreur publique ;
- une perte d’accès du propriétaire invalide immédiatement l’aperçu et la résolution ;
- la consultation de l’aperçu ne compte pas comme une résolution ;
- aucun secret, token de session, IP brute ou URL externe arbitraire n’est persisté.

## Déploiement

Le registre peut être déployé avec la création désactivée. L’absence du feature flag `short_links.creation` équivaut à `false`. L’activation doit être explicite via le système KMD-001 existant.

## Retour arrière

Désactiver `short_links.creation` bloque les nouvelles créations sans casser le contrat KMD-060. Les liens existants peuvent être conservés en lecture pendant une migration ou révoqués. Un rollback ne doit jamais remplacer la résolution typée par une redirection URL libre.

## Critères de fusion

- branche basée sur le `main` contenant KMD-060 ;
- Prisma generate/push verts ;
- build monorepo vert ;
- tests unitaires verts ;
- API E2E PostgreSQL verts ;
- PR mergeable ;
- aucun mélange avec Nexus core ou KMD-059.
