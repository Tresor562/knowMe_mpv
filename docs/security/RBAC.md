# Contrôle d’accès granulaire KnowMe

KnowMe applique le principe du moindre privilège. Un rôle lisible par un humain regroupe des permissions techniques précises, tandis qu’une attribution relie temporairement ou durablement ce rôle à un `accountId`.

## Modèle

- `Permission` : action atomique, par exemple `moderation.reports.resolve` ;
- `AccessRole` : ensemble nommé de permissions ;
- `RolePermission` : relation entre un rôle et une permission ;
- `UserRoleGrant` : attribution auditable, datée, expirable et révocable.

Les rôles système initiaux sont Owner, Administrator, Moderator, Support, Developer et Community Manager. Leur catalogue est synchronisé au démarrage de l’API. Les attributions restent dans PostgreSQL et ne sont jamais prises depuis un header ou le stockage local.

## Autorisation

Les contrôleurs déclarent l’action nécessaire :

```ts
@RequirePermissions('moderation.reports.resolve')
```

`PermissionsGuard` récupère l’`accountId` depuis la session JWT déjà validée, puis recalcule les permissions actives depuis la base. Une attribution n’est active que si sa date de début est atteinte, qu’elle n’est pas révoquée et qu’elle n’est pas expirée.

## Compatibilité de migration

Les anciens comptes `role=ADMIN` sans compte staff actif conservent provisoirement toutes les permissions afin de ne pas interrompre l’administration pendant la migration. Les comptes staff actifs utilisent leurs attributions granulaires et ne bénéficient pas de ce raccourci. Ce mode de compatibilité devra être supprimé lorsque tous les administrateurs historiques auront une attribution explicite.

## Protection contre la perte d’accès

Un utilisateur ne peut pas révoquer sa propre attribution lorsqu’elle contient `rbac.manage`. La gestion future des propriétaires ajoutera un quorum, une double validation et une procédure de récupération hors ligne.

## Frontends

Le Web et le Mobile peuvent masquer les fonctions indisponibles à partir de `GET /access/me`, mais cette information n’est qu’une aide d’interface. Chaque opération sensible est revérifiée par l’API au moment de l’action.
