# KMD-126 — Brouillons synchronisés dans le hub Mobile d’organisation

## Objectif

Exposer sur Mobile une vue personnelle de tous les brouillons synchronisés depuis le hub d’organisation fusionné, afin de reprendre rapidement une conversation sans créer de nouvelle autorité métier.

## Dépendances fusionnées

- autorité serveur existante `/conversation-drafts` ;
- autorité serveur existante `/conversations` ;
- surface Mobile `ConversationDraftExperience` par conversation ;
- KMD-124 — hub Mobile d’organisation privée ;
- KMD-125 — outil Mobile des messages enregistrés.

## Livrables

- nouvelle surface `ConversationDraftsExperience` ;
- lecture conjointe des brouillons personnels et des conversations encore accessibles ;
- filtrage des brouillons vides côté présentation uniquement ;
- aperçu du contenu, version et date de mise à jour ;
- ouverture de la vue d’organisation de la conversation pour continuer à éditer le brouillon avec l’autorité existante ;
- ajout de l’outil `Brouillons synchronisés` dans le hub Mobile.

## Frontières d’autorité et de sécurité

- aucun nouvel endpoint API ;
- aucune nouvelle persistance ni migration ;
- aucun envoi de message depuis la liste des brouillons ;
- aucune reconstruction d’une conversation inaccessible ;
- aucun élargissement de membership, rôle ou permission ;
- aucun changement Nexus core/intégration, Premium, KnowCoins, appels, matériel, permission OS, conformité juridique ou KMD-059.

## Validation requise

1. CI monorepo standard verte sur le head final.
2. Build TypeScript/Expo de `@knowme/mobile` vert, y compris les nouveaux imports et types.
3. Suite unitaire complète verte.
4. Suite API E2E PostgreSQL verte, en conservant les tests existants de l’autorité des brouillons et des conversations comme gate de sécurité/régression.
5. Vérifier qu’un brouillon vide n’apparaît pas dans la liste mais reste géré par le contrat serveur existant.
6. Vérifier qu’ouvrir un brouillon passe par la vue d’organisation existante et ne provoque aucun envoi implicite.

## Migration

Aucune migration de base de données. Aucun modèle persistant n’est ajouté ou modifié.

## Retour arrière

Retirer l’outil `drafts` et l’import `ConversationDraftsExperience` de `MessagesOrganizationExperience.tsx`, supprimer `ConversationDraftsExperience.tsx` et ce document. Aucun rollback de données ou de schéma n’est requis.
