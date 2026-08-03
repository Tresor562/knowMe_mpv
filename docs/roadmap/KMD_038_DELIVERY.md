# KMD-038 — Messenger, communautés et KnowMe Secret

## Livré dans cette fondation

### Messenger Experience

- cinq onglets fonctionnels définis ;
- styles de bulles ;
- fonds gratuits, personnels, IA et animés Premium ;
- réglages de flou, luminosité, opacité et filtres ;
- effets de messages ;
- intégration avatars, cadeaux, jeux et défis ;
- règles des messages vocaux ;
- règles de fichiers et sécurité ;
- statuts personnels de 24 heures ;
- séparation explicite de Secret ;
- politique d’évolution vers le chiffrement de bout en bout.

### Groupes et chaînes

- types Groupe et Chaîne ;
- public et privé ;
- rôles et permissions ;
- liens permanents, temporaires et sur approbation ;
- Stories de 1 h à 72 h ;
- Stories Premium 7, 14, 30 jours ou permanentes sous conditions ;
- cinq niveaux prestigieux ;
- XP serveur ;
- conditions d’ancienneté, activité et réputation ;
- plafonds de messages ;
- pénalités contre le spam et les violations ;
- déblocages par niveau ;
- limites de participants ;
- vérification séparée de la progression ;
- groupes participatifs et chaînes orientées diffusion.

### KnowMe Secret

- domaine entièrement séparé ;
- catégories de messages ;
- activation et identifiant public ;
- personnalisation ;
- filtres anti-harcèlement ;
- termes bloqués ;
- limite d’envoi ;
- ancienneté minimale ;
- vérification anti-robot ;
- blocage par token opaque ;
- indices Premium consentis ou agrégés ;
- interdiction de révéler identité, IP ou localisation exacte ;
- tests de confidentialité et de sécurité.

### API de fondation

- `GET /messenger-experience/policy` ;
- `GET /communities/policy` ;
- `POST /communities/progression/evaluate` ;
- `POST /communities/stories/validate-duration` ;
- `GET /knowme-secret/policy`.

## Ce qui n’est pas encore prétendu comme terminé

Cette PR ne prétend pas livrer immédiatement :

- appels WebRTC ;
- chiffrement de bout en bout complet ;
- stockage de fichiers de 2 Go en production ;
- transcription et traduction réelles ;
- modèles Prisma des communautés ;
- interface complète Web et Mobile ;
- découverte et recherche communautaire ;
- moteurs de bots ;
- monétisation des chaînes ;
- persistance et livraison des messages Secret ;
- modération IA de production.

## Blocs suivants

### KMD-038A — Persistance Messenger

- `ConversationType` ;
- préférences par membre ;
- réponses et réactions ;
- pièces jointes structurées ;
- événements cadeaux/jeux/défis ;
- messages programmés ;
- messages temporaires ;
- thèmes de conversation ;
- statut et audience ;
- export et suppression.

### KMD-038B — Médias, voix et appels

- upload multipart ;
- scan de malware ;
- transcodage ;
- CDN signé ;
- messages vocaux ;
- transcription ;
- traduction ;
- WebRTC ;
- appels de groupe ;
- partage d’écran ;
- avatar vidéo.

### KMD-038C — Persistance communautés

Modèles prévus :

- `Community` ;
- `CommunitySpace` ;
- `CommunityMembership` ;
- `CommunityRole` ;
- `CommunityRolePermission` ;
- `CommunityInviteLink` ;
- `CommunityJoinRequest` ;
- `CommunityBan` ;
- `CommunityPost` ;
- `CommunityComment` ;
- `CommunityStory` ;
- `CommunityEvent` ;
- `CommunityProgressSnapshot` ;
- `CommunityXpEvent` ;
- `CommunityBadge` ;
- `CommunityMemberBadge` ;
- `CommunityAuditLog`.

### KMD-038D — Clients groupes et chaînes

- création de groupe multisélection ;
- création de chaîne ;
- profil public ;
- chat groupe ;
- publications chaîne ;
- commentaires ;
- Stories ;
- rôles ;
- membres ;
- liens ;
- progression ;
- personnalisation ;
- statistiques.

### KMD-038E — KnowMe Secret transactionnel

Modèles prévus :

- `SecretPage` ;
- `SecretPageAppearance` ;
- `SecretInboxPreference` ;
- `SecretMessage` ;
- `SecretMessageModeration` ;
- `SecretSenderToken` ;
- `SecretBlock` ;
- `SecretReport` ;
- `SecretPublicReply` ;
- `SecretAggregateMetric`.

Mutations :

- activer/désactiver ;
- personnaliser ;
- envoyer ;
- lire ;
- supprimer ;
- bloquer ;
- signaler ;
- répondre publiquement.

## Critères obligatoires

- aucun niveau achetable ;
- Premium ne modifie jamais l’XP ;
- aucun compteur client ne crée d’XP ;
- seuls des événements serveur validés comptent ;
- une Story longue vérifie Premium et niveau ;
- les chaînes n’accordent pas la publication aux abonnés par défaut ;
- Messenger ne mélange jamais les messages anonymes ;
- Secret ne révèle jamais l’identité à Premium ;
- les médias personnels sont modérés ;
- la réduction des animations est respectée ;
- tous les changements sensibles sont audités.

## Validation CI attendue

- build de tous les workspaces ;
- tests Messenger Experience ;
- tests Communities ;
- tests KnowMe Secret ;
- tests E2E existants sans régression.
