# KMD-124 — Hub Mobile d’organisation privée des conversations

## Objectif

Regrouper sur Mobile les surfaces personnelles d’organisation des conversations déjà fusionnées, sans créer une nouvelle autorité métier, sans élargir les permissions et sans modifier le contenu des conversations.

## Dépendances fusionnées

- KMD-077 — dossiers privés ;
- KMD-086 — archives personnelles ;
- KMD-093 à KMD-112 — épingles privées et ordre autoritaire ;
- KMD-113/KMD-114 — recherche locale des dossiers ;
- KMD-119/KMD-120 — détail d’organisation par conversation ;
- KMD-122 — point d’entrée Mobile depuis Messages ;
- KMD-123 — hub Web d’organisation privée.

## Livrables

- l’entrée Mobile `Organisation privée` ouvre désormais un hub unique ;
- accès direct aux dossiers privés, à la recherche locale, aux archives personnelles et aux conversations épinglées ;
- conservation de la liste des conversations accessibles pour ouvrir leur vue personnelle ;
- la vue par conversation continue d’exposer dossier, archive, brouillon et messages enregistrés ;
- chaque surface existante reste la seule responsable de ses appels API et de ses mutations ;
- navigation de retour explicite vers le hub puis vers Messages.

## Frontières d’autorité et de sécurité

- aucun nouveau endpoint API ;
- aucune nouvelle persistance ;
- aucun droit d’accès n’est déduit ou élargi par le hub ;
- les composants canoniques existants continuent d’appliquer les contrats serveur actuels ;
- les identifiants de conversations proviennent uniquement des réponses authentifiées de KnowMe ;
- aucun comportement Nexus core, Nexus × KnowMe, Premium, KnowCoins, appels, matériel, permissions OS ou KMD-059 n’est modifié.

## Validation requise

1. Exécuter la CI monorepo standard sur le head final.
2. Confirmer le build TypeScript/Expo de `@knowme/mobile` dans le build monorepo.
3. Confirmer que les imports des quatre surfaces Mobile existantes restent valides.
4. Vérifier que l’entrée `Organisation privée` n’interrompt pas le panneau de messages temps réel lorsqu’elle est fermée.
5. Vérifier que les retours `Organisation` et `Messages` restaurent un état local cohérent.
6. Vérifier que les tests API existants des dossiers, archives, épingles, brouillons et messages enregistrés restent verts.

## Migration

Aucune migration de base de données. Aucun modèle persistant n’est ajouté ou modifié.

## Retour arrière

Restaurer `apps/mobile/src/MessagesOrganizationExperience.tsx` à sa version KMD-122 et supprimer ce document. Aucun rollback de données ou de schéma n’est requis.
