# Identité de compte et droits exclusifs autoritaires côté serveur

## Objectif

KnowMe part du principe réaliste que les clients Web et Mobile peuvent être inspectés, modifiés ou reconstruits. La sécurité ne dépend donc jamais du secret du code client.

Un APK modifié, une extension navigateur, une variable JavaScript changée ou un stockage local falsifié peut modifier l’interface affichée, mais ne doit jamais permettre d’obtenir une donnée, une action ou une récompense exclusive sur le serveur.

## Identité canonique

Chaque compte possède un identifiant canonique immuable : `User.id`.

Dans les réponses d’identité, cet identifiant est également exposé comme `accountId` pour clarifier son rôle métier. Le nom d’utilisateur, l’e-mail, le nom affiché et l’avatar peuvent changer ; `accountId` ne change pas.

Règles :

- toutes les relations métier utilisent l’identifiant interne du compte ;
- aucun accès n’est accordé sur la base d’un nom d’utilisateur ou d’un e-mail fourni par le client ;
- l’identité de la requête provient uniquement du JWT validé par le serveur ;
- le serveur utilise le `sub` du JWT comme identifiant du compte ;
- les identifiants présents dans un body ou un header ne remplacent jamais l’identité authentifiée.

## Feature flags et droits

Les feature flags et les entitlements ont deux responsabilités différentes.

- Un feature flag décide si une fonctionnalité est livrée ou activée pour une population.
- Un entitlement décide si un compte précis possède le droit d’utiliser une fonctionnalité exclusive.

Un feature flag activé n’accorde aucun droit Premium. Un entitlement actif n’oblige pas l’équipe à livrer une fonctionnalité dont le flag global est désactivé.

Pour une fonctionnalité exclusive, l’autorisation finale est :

```text
feature disponible ET entitlement actif ET permission métier valide
```

## Source de vérité

Les droits sont enregistrés dans `EntitlementGrant`.

Un grant contient notamment :

- le compte bénéficiaire ;
- la clé du droit ;
- la source ;
- la date de début ;
- la date d’expiration éventuelle ;
- la révocation éventuelle ;
- une référence externe de paiement ou d’abonnement ;
- une justification et des métadonnées d’audit.

Un droit est actif uniquement lorsque :

```text
startsAt <= maintenant
ET revokedAt est null
ET expiresAt est null ou supérieur à maintenant
```

Le client ne peut pas envoyer `premium=true`, `x-entitlements`, un faux niveau d’abonnement ou une valeur locale pour influencer ce calcul.

## Protection des routes

Toute route exclusive utilise `@RequireEntitlements(...)` avec `EntitlementsGuard`.

La garde :

1. récupère le compte depuis l’authentification serveur ;
2. lit les grants actifs en base ;
3. refuse l’accès lorsqu’un droit manque ;
4. ignore totalement les déclarations de droits envoyées par le client.

L’interface peut masquer un bouton pour améliorer l’expérience, mais le serveur refait toujours la vérification au moment de l’action.

## Paiements et abonnements

Les futures intégrations de paiement devront suivre ces règles :

- ne jamais faire confiance à un simple message de réussite du client ;
- vérifier les reçus auprès du fournisseur ;
- traiter les webhooks signés et idempotents ;
- enregistrer la référence externe ;
- créer ou prolonger le grant uniquement après vérification serveur ;
- révoquer ou expirer le grant après remboursement, annulation ou fraude confirmée ;
- journaliser chaque transition.

## Limites réalistes

Aucune application distribuée sur l’appareil d’un utilisateur ne peut être rendue mathématiquement impossible à modifier.

La stratégie KnowMe consiste à rendre la modification inutile pour les fonctions protégées : le client modifié peut afficher un faux badge ou un faux bouton, mais le serveur refuse les contenus, actions, avantages, monnaies, objets et données exclusives.

Les protections complémentaires futures incluront :

- Play Integrity sur Android ;
- App Attest ou DeviceCheck sur iOS ;
- détection de versions obsolètes ou compromises ;
- limitation de débit et analyse de risque ;
- rotation de sessions ;
- vérification des achats côté serveur ;
- détection d’automatisation et d’abus.

Ces signaux renforcent la sécurité, mais ne remplacent jamais l’autorisation serveur.
