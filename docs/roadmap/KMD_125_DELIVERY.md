# KMD-125 — Messages enregistrés dans le hub Mobile d’organisation

## Objectif

Exposer directement sur Mobile la surface personnelle des messages enregistrés depuis le hub d’organisation fusionné en KMD-124, sans créer de nouvelle autorité métier et sans élargir les permissions.

## Dépendances fusionnées

- autorité serveur existante des messages enregistrés ;
- surface Mobile canonique `SavedMessagesExperience` ;
- KMD-120 — détail d’organisation par conversation ;
- KMD-122 — point d’entrée Mobile depuis Messages ;
- KMD-124 — hub Mobile d’organisation privée.

## Livrables

- ajout d’un outil `Messages enregistrés` dans le hub Mobile ;
- réutilisation directe de `SavedMessagesExperience` plutôt que duplication de logique ;
- lecture uniquement des messages encore accessibles renvoyés par l’autorité serveur ;
- retrait d’un message enregistré via l’endpoint existant ;
- retour explicite vers le hub puis vers Messages.

## Frontières d’autorité et de sécurité

- aucun nouveau endpoint API ;
- aucune nouvelle persistance ni migration ;
- aucun message inaccessible n’est reconstruit localement ;
- l’enregistrement d’un message reste une référence privée et ne crée aucun droit d’accès ;
- aucune modification de membership, rôle, notification, Premium, KnowCoins, Nexus core/intégration, appel, matériel, permission OS, conformité juridique ou KMD-059.

## Validation requise

1. Exécuter la CI monorepo standard sur le head final.
2. Confirmer le build TypeScript/Expo de `@knowme/mobile`.
3. Confirmer que l’import de `SavedMessagesExperience` reste valide.
4. Confirmer que les tests existants de l’autorité `saved-messages` restent verts dans les suites unitaires/API E2E.
5. Vérifier que fermer l’outil restaure le hub sans modifier la messagerie temps réel.
6. Vérifier que le retrait d’un message enregistré reste soumis au contrat API existant.

## Migration

Aucune migration de base de données. Aucun modèle persistant n’est ajouté ou modifié.

## Retour arrière

Retirer l’outil `saved` et l’import `SavedMessagesExperience` de `MessagesOrganizationExperience.tsx`, puis supprimer ce document. Aucun rollback de données ou de schéma n’est requis.
