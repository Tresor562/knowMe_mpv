# KMD-122 — Point d’entrée Mobile vers l’organisation privée des conversations

## Objectif

Relier la surface Messages Mobile existante au détail d’organisation privé KMD-120 sans modifier la messagerie, les dossiers, les archives, les brouillons, les messages enregistrés, les permissions ou la persistance.

## Livrables

- wrapper `MessagesOrganizationExperience` autour de la messagerie temps réel existante ;
- action `Organisation privée` accessible depuis la section Messages ;
- chargement de la liste des conversations déjà autorisées via `GET /conversations` uniquement à l’ouverture de cette surface ;
- sélection explicite d’une conversation puis affichage du composant KMD-120 `ConversationOrganizationDetail` ;
- retours explicites vers la liste des conversations d’organisation puis vers la messagerie ;
- conservation intacte de `RealtimeMessagesPanel` pour le temps réel, les messages, Nexus et les épingles.

## Frontières d’autorité et de sécurité

- l’entrée d’organisation ne crée aucun nouveau droit d’accès ;
- la liste vient uniquement de `GET /conversations`, déjà filtrée par l’autorité serveur ;
- le détail KMD-120 reste en lecture seule et recharge les ressources personnelles depuis leurs API autorisées ;
- aucun identifiant de conversation inaccessible n’est reconstruit ou deviné ;
- aucun dossier, archive, brouillon, message enregistré, message ou épingle n’est muté par KMD-122 ;
- aucune logique Nexus core, Nexus × KnowMe, Premium ou KnowCoins n’est introduite.

## Validation requise

1. Exécuter la CI monorepo standard.
2. Confirmer la compilation TypeScript Mobile.
3. Ouvrir `Mon cercle > Messages` et vérifier que `Organisation privée` est disponible sans modifier la messagerie.
4. Ouvrir l’organisation et vérifier que seules les conversations renvoyées par `GET /conversations` sont proposées.
5. Sélectionner une conversation et vérifier que le détail KMD-120 correspond exactement à son identifiant.
6. Revenir à la liste puis à Messages et vérifier que la messagerie temps réel reste utilisable.
7. Vérifier qu’aucune requête de mutation d’organisation n’est émise par ce parcours.
8. Confirmer que les tests API existants protégeant dossiers, archives, brouillons et messages enregistrés restent verts.

## Migration

Aucune migration de base de données. Aucun modèle persistant n’est ajouté ou modifié.

## Retour arrière

Revenir sur les commits KMD-122 qui ajoutent `MessagesOrganizationExperience`, reconnecter `SocialHub` directement à `RealtimeMessagesPanel`, puis supprimer ce document. Aucun rollback de données ni down migration n’est nécessaire.
