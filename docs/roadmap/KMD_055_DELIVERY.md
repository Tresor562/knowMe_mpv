# KMD-055 — Connexion sociale post-acceptation

## Statut

En validation dans la PR #98.

## Dépendances

- KMD-015 — anti-spam persistant ;
- KMD-038 — messagerie ;
- KMD-043 à KMD-048 — notifications et préférences ;
- KMD-049 — internationalisation ;
- KMD-054 — matchmaking volontaire, acceptation mutuelle et blocages.

## Livrables

### API et persistance

- intentions privées d’amitié et de conversation ;
- exécution serveur de l’intersection mutuelle ;
- réutilisation sûre d’une amitié ou conversation directe existante ;
- transaction sérialisable, idempotence et reprise sur conflit ;
- expiration à 72 heures ;
- révocation avant exécution ;
- limites anti-spam ;
- journal métier et audit ;
- routes authentifiées de lecture, choix et révocation.

### Gouvernance

- aucune création automatique après le match ;
- aucune exposition du choix détaillé du partenaire ;
- aucun lien avec Premium, KnowCoins, score économique ou priorité payante ;
- respect des blocages KMD-054 et sociaux ;
- gestion ultérieure de l’amitié et de la conversation par leurs modules existants.

### Cycle de vie

- expiration intégrée au worker de matchmaking ;
- export compte conditionnel au format 16 ;
- effacement avant anonymisation de la proposition ;
- conservation des frontières des autres domaines.

### Clients

- expérience Web post-acceptation ;
- expérience Mobile post-acceptation ;
- états attente, choix privé, résultat, expiration et révocation.

### Validation

Le scénario E2E vérifie :

- interdiction aux non-participants ;
- absence d’effet d’une intention unilatérale ;
- confidentialité du choix du partenaire ;
- intersection progressive amitié/conversation ;
- idempotence ;
- absence de duplication ;
- révocation avant exécution ;
- expiration ;
- export format 16 ;
- suppression de compte et partenaire anonymisé.

## Condition de fusion

La PR ne peut être fusionnée que lorsque les étapes suivantes sont entièrement vertes :

1. génération Prisma ;
2. application du schéma sur PostgreSQL ;
3. Build monorepo ;
4. tests unitaires ;
5. tests E2E complets.
