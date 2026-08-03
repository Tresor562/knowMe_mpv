# KMD-044 — Préférences de notifications et gouvernance humaine

## Objectif

Donner aux utilisateurs le contrôle sur le bruit des profils collectifs sans leur permettre de manquer silencieusement une modification importante de propriété, rôle, participation ou contenu personnel.

## Préférences

Chaque compte possède :

- interrupteur général des notifications facultatives ;
- invitations ;
- membres et adhésions ;
- gouvernance ;
- contenus ;
- famille ;
- affichage temps réel ;
- liste de structures silencieuses.

Les préférences sont privées, auditées et modifiables uniquement par le propriétaire authentifié.

## Catégories

### Invitations

- invitation ;
- acceptation ;
- refus.

### Membres

- départ ;
- retrait ;
- demande d’adhésion ;
- acceptation ou refus d’adhésion.

### Gouvernance

- pause, reprise ou fin ;
- changement de rôle ;
- transfert de propriété.

### Contenus

- verdict sur un moment ou une Story.

### Famille

- proposition ;
- acceptation ;
- refus ;
- retrait d’un lien déclaré.

## Événements transactionnels obligatoires

Les événements suivants restent dans la boîte même lorsque les alertes facultatives ou la structure sont coupées :

- retrait d’un membre ;
- changement de rôle ;
- création, acceptation ou annulation d’un transfert de propriété ;
- approbation, masquage ou retrait d’un contenu personnel.

La justification est qu’ils modifient directement les droits, la propriété, la participation ou le statut d’un contenu appartenant au destinataire.

Ils ne contournent pas le réglage d’affichage temps réel. Un utilisateur peut donc conserver la trace dans sa boîte sans recevoir l’apparition instantanée.

## Structures silencieuses

Une structure silencieuse bloque les notifications facultatives qui lui sont liées. Elle ne supprime pas :

- les données de la structure ;
- les notifications déjà créées ;
- les événements transactionnels obligatoires.

La liste est limitée à cinq cents identifiants normalisés.

## Résolution avant livraison

Avant de créer un dispatch, le serveur :

1. déduplique les destinataires ;
2. retire l’acteur par défaut ;
3. charge les préférences existantes ;
4. applique la catégorie ;
5. applique la structure silencieuse ;
6. conserve les événements obligatoires ;
7. sépare les destinataires de boîte et les destinataires temps réel.

Un destinataire supprimé par ses préférences n’obtient aucune ligne de notification facultative.

## Interface

Page : `/settings/profile-circle-notifications`.

Elle permet :

- d’activer ou désactiver chaque catégorie ;
- de désactiver uniquement le WebSocket ;
- de rendre une structure silencieuse ;
- de revenir à la boîte ou au centre collectif.

## Gouvernance sans identifiants

Page : `/profile-circle-members`.

Le membre choisit :

- une structure par son nom ;
- une personne par nom, pseudo et rôle.

L’interface permet ensuite, selon les permissions :

- modifier un rôle ;
- proposer un transfert de propriété ;
- proposer un lien familial déclaré.

Les identifiants restent utilisés dans les requêtes sécurisées, mais ne sont plus une donnée que l’utilisateur doit rechercher, copier ou comprendre.

La page n’affiche jamais :

- email ;
- KnowCoins ;
- portefeuille ;
- données de sécurité ;
- activité privée.

## API

- `GET /profile-circle-notification-preferences/me` ;
- `PUT /profile-circle-notification-preferences/me` ;
- `PUT /profile-circle-notification-preferences/me/circles/:circleId/mute` ;
- `PUT /profile-circle-notification-preferences/me/circles/:circleId/unmute`.

## Garanties

- filtrage avant création de la notification ;
- événements obligatoires limités aux changements directs ;
- temps réel désactivable indépendamment ;
- préférences auditées ;
- données inconnues non exposées ;
- permissions de gouvernance toujours vérifiées par l’API ;
- aucun rôle Owner attribuable par le formulaire de rôle ;
- transfert toujours soumis à l’acceptation du destinataire.

## Limites restantes

- horaires silencieux ;
- résumé groupé quotidien ;
- préférences push mobile ;
- préférences email ;
- centre administrateur de reprise des livraisons échouées ;
- journal visible des changements de rôle ;
- notifications de mention dans les moments ;
- sélection graphique des membres dans le centre de contenus historique.
