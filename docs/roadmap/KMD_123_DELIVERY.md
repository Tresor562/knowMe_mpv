# KMD-123 — Hub Web d’organisation privée des conversations

## Objectif

Regrouper les surfaces personnelles de gestion des conversations déjà fusionnées dans un point Web unique, sans créer une nouvelle autorité métier ni modifier les conversations elles-mêmes.

## Dépendances fusionnées

- KMD-066 — messages enregistrés ;
- KMD-068 — brouillons synchronisés ;
- KMD-077 — dossiers privés ;
- KMD-086 — archives personnelles ;
- KMD-093 à KMD-112 — épingles privées et ordre autoritaire ;
- KMD-113/KMD-114 — recherche locale des dossiers ;
- KMD-119 à KMD-122 — détail et points d’entrée d’organisation par conversation.

## Livrables

- route authentifiée Web `/conversation-organization` ;
- accès regroupé aux dossiers, recherche locale, archives, épingles, brouillons et messages enregistrés ;
- descriptions explicites des frontières de chaque surface ;
- retour direct vers Messages ;
- aucune duplication de logique métier : chaque carte ouvre la surface canonique déjà fusionnée.

## Frontières d’autorité et de sécurité

- le hub n’appelle aucune API et ne déduit aucun droit d’accès ;
- aucune donnée privée n’est agrégée, copiée ou persistée dans le hub ;
- aucune mutation n’est effectuée par cette page ;
- les routes cibles restent seules responsables de l’authentification, de la revalidation d’accès et des mutations autorisées ;
- aucun identifiant de conversation, dossier, message, brouillon ou archive n’est accepté depuis une destination libre ;
- aucun comportement Nexus core, Nexus × KnowMe, Premium, KnowCoins, appels ou KMD-059 n’est modifié.

## Validation requise

1. Exécuter la CI monorepo standard sur le head final.
2. Confirmer le build Next.js/TypeScript de `@knowme/web`.
3. Vérifier que `/conversation-organization` exige une session authentifiée via le mécanisme Web existant.
4. Vérifier que chaque carte mène uniquement à une route interne canonique existante.
5. Vérifier que le hub n’émet aucune requête API ni mutation par lui-même.
6. Vérifier que les tests API existants des dossiers, archives, épingles, brouillons et messages enregistrés restent verts.

## Migration

Aucune migration de base de données. Aucun modèle persistant n’est ajouté ou modifié.

## Retour arrière

Supprimer la route `apps/web/app/conversation-organization/page.tsx` et ce document. Aucune donnée, migration ou autorité serveur n’est affectée.
