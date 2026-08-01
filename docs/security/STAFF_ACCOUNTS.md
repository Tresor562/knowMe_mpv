# Comptes officiels Équipe KnowMe

Les comptes officiels ne sont jamais reconnus à partir d’une liste d’adresses e-mail compilée dans l’API, le Web ou l’application mobile. L’identité officielle est un enregistrement `StaffAccount` lié à l’`accountId` immuable d’un utilisateur.

## Activation

Un administrateur autorisé recherche d’abord le compte concerné, puis saisit son `accountId` dans le panneau d’administration. L’activation exige une fonction, une décision explicite concernant l’accès administratif et une justification auditable.

Les adresses historiques ou officielles peuvent être utilisées par l’équipe pour retrouver le compte, mais elles ne constituent jamais une preuve d’autorisation. Changer l’adresse e-mail d’un compte ne crée ni ne supprime son statut staff.

## Badge public

Seul un enregistrement au statut `ACTIVE` produit le badge public :

- libellé `Équipe KnowMe` ;
- bouclier doré ;
- fonction officielle ;
- représentation différente d’un futur badge d’identité vérifiée ou d’un abonnement Premium.

Le client ne fabrique jamais ce badge. Il affiche uniquement la valeur renvoyée par l’API.

## Suspension et révocation

Une suspension ou une révocation :

1. désactive immédiatement le badge ;
2. restaure le rôle utilisateur précédent ;
3. révoque toutes les sessions actives ;
4. exige une nouvelle authentification ;
5. produit un journal d’audit corrélé à la requête administrative.

Un membre ne peut pas suspendre ou révoquer son propre compte staff. Cette protection évite la perte accidentelle du dernier accès administratif pendant les premières phases du projet. Une politique de quorum et de double validation sera ajoutée avec le RBAC avancé.

## Sessions autoritaires

Le rôle contenu dans le JWT n’est pas considéré comme l’autorité finale. Pour chaque requête protégée, l’API vérifie la session, l’état du compte, le rôle courant et le statut staff dans PostgreSQL. Une ancienne application ou un ancien JWT ne conserve donc pas un accès qui vient d’être retiré.
