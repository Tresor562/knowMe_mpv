# KMD-043 — Sélecteur de membres et notifications

## Livré

### Recherche de membres

- endpoint authentifié ;
- pseudo ou nom affiché ;
- normalisation de `@pseudo` ;
- limite de résultats ;
- comptes suspendus exclus ;
- utilisateur courant exclu ;
- contexte d’amitié ;
- contexte de participation collective ;
- email et KnowCoins omis par sélection serveur ;
- tests de confidentialité.

### Création Web

- composant réutilisable `ProfileMemberPicker` ;
- sélection sans identifiant technique visible ;
- capacités Duo, Équipe, Famille et Guilde ;
- page `/profile-circle-create` ;
- accès depuis le profil ;
- invitations envoyées après création.

### Notifications

- dispatch idempotent ;
- livraison par destinataire ;
- états Pending, Processing, Delivered et Failed ;
- transaction sérialisable ;
- récupération des traitements bloqués ;
- émission via `RealtimeGateway` ;
- invitations et acceptations ;
- refus, départs et retraits ;
- demandes d’adhésion et décisions ;
- changements d’état ;
- rôles ;
- transferts ;
- décisions de modération ;
- liens familiaux.

## Vérifications attendues

- génération Prisma ;
- synchronisation PostgreSQL ;
- build API ;
- build Web ;
- build Mobile ;
- tests unitaires ;
- E2E existants.

## Prochains blocs

- préférences de notification ;
- push mobile ;
- regroupement des notifications ;
- outil de reprise des livraisons échouées ;
- sélecteur de membres dans la gouvernance ;
- recherche phonétique ;
- suggestions de relations ;
- tests E2E dédiés aux notifications temps réel.
