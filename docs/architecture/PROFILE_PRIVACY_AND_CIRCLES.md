# KMD-041 — Confidentialité financière, statistiques et profils collectifs

## Règle KnowCoins

Le portefeuille KnowCoins est une donnée privée.

Un autre utilisateur ne reçoit jamais :

- le solde actuel ;
- le solde disponible ;
- le solde bloqué ;
- les crédits et débits cumulés ;
- les revenus créateur ;
- les paiements attendus ;
- les KnowCoins gagnés ;
- les KnowCoins dépensés.

Cette règle s’applique même si le propriétaire rend sa section Statistiques publique.

Le tableau de bord personnel peut afficher ces informations au propriétaire authentifié. La vue publique utilise une liste blanche de statistiques autorisées. Toute nouvelle clé inconnue est privée par défaut.

## Liste blanche publique

Les statistiques actuellement autorisées sont :

- niveau ;
- XP ;
- défis créés ;
- défis gagnés ;
- affinité moyenne agrégée ;
- quiz créés ;
- quiz terminés ;
- jeux gagnés ;
- nombre d’amis ;
- followers ;
- abonnements ;
- streak quotidien ;
- cadeaux reçus ;
- cadeaux envoyés.

Les messages envoyés, le temps d’utilisation et toutes les métriques financières sont privés.

La façade publique retire aussi les clés financières si elles apparaissent par erreur dans une autre partie du snapshot.

## Statistiques issues d’événements

Les statistiques de profil ne doivent pas être modifiées directement par le client.

Chaque modification est enregistrée comme un événement serveur :

- clé autorisée ;
- opération autorisée ;
- valeur bornée ;
- source ;
- identifiant source ;
- clé d’idempotence ;
- date d’occurrence.

Opérations :

- `INCREMENT` ;
- `SET_MAX` ;
- `SET_VALUE`.

La clé d’idempotence empêche une victoire, un cadeau ou une transaction rejouée de créditer deux fois la statistique.

Le propriétaire peut consulter son historique privé et reconstruire son snapshot depuis les événements validés. Il ne possède aucun endpoint pour s’attribuer arbitrairement une victoire, de l’XP ou des KnowCoins.

## Profils collectifs

Types :

- Duo Couple ;
- Duo Meilleurs amis ;
- Duo Fratrie ;
- Duo Gaming ;
- Duo Créatif ;
- Équipe ;
- Famille ;
- Guilde.

## Cycle de vie

États :

- `PENDING` ;
- `ACTIVE` ;
- `PAUSED` ;
- `ENDED`.

Règles :

- une relation en attente n’est pas publique ;
- les relations exigeant le consentement restent en attente jusqu’aux acceptations nécessaires ;
- un membre peut refuser une invitation ;
- un membre non propriétaire peut quitter ;
- quitter un Duo termine le Duo ;
- quitter une structure à consentement unanime la met en pause si elle conserve assez de membres ;
- le propriétaire doit transférer ou terminer la structure avant de partir ;
- seul le propriétaire peut mettre en pause, reprendre ou terminer ;
- une structure terminée ne peut pas être réactivée.

## Visibilité collective

Une page collective publique ne renvoie que :

- identité collective ;
- membres actifs ;
- rôles publics ;
- fragments de bio autorisés ;
- progression ;
- activité récente sans données privées.

Sont omis :

- invitations ;
- demandes d’adhésion ;
- membres partis, refusés ou retirés ;
- données privées des membres ;
- raisons internes de modération.

Une structure privée n’est visible que par ses membres actifs. Les structures en pause, terminées ou en attente ne sont visibles que par leurs membres.

## Guildes

Seules les guildes peuvent être ouvertes aux demandes d’adhésion.

Conditions :

- guilde active ;
- option d’adhésion activée ;
- capacité disponible ;
- demandeur non membre ;
- demande unique par membre et par guilde.

Le propriétaire, un administrateur ou un officier peut accepter ou refuser. L’acceptation crée ou réactive la participation dans une transaction unique.

## Progression collective

Niveaux :

- niveau 1 : 0 XP ;
- niveau 2 : 5 000 XP ;
- niveau 3 : 20 000 XP ;
- niveau 4 : 80 000 XP ;
- niveau 5 : 250 000 XP.

L’XP vient d’événements idempotents : défis gagnés, jeux gagnés, moments, Stories, événements, cadeaux et contributions.

Premium ne peut ni acheter ni augmenter le niveau collectif.

## Interfaces

- `/profile-circles` : centre de gestion ;
- `/circles/:slug` : page collective publique ou réservée ;
- `/profile` : accès direct au centre collectif ;
- `/profile-studio` : création initiale des relations.

## Endpoints

### Confidentialité et statistiques

- `GET /profile-experience/public/:username` : snapshot filtré par la façade publique ;
- `GET /profile-stats/policy` ;
- `GET /profile-stats/me/history` ;
- `POST /profile-stats/me/rebuild`.

### Profils collectifs

- `GET /profile-circles/me` ;
- `GET /profile-circles/public/:slug` ;
- `PATCH /profile-circles/:circleId` ;
- `POST /profile-circles/:circleId/decline` ;
- `POST /profile-circles/:circleId/leave` ;
- `POST /profile-circles/:circleId/lifecycle` ;
- `POST /profile-circles/:circleId/join-requests` ;
- `GET /profile-circles/:circleId/join-requests` ;
- `POST /profile-circles/:circleId/join-requests/:requestId/review` ;
- `POST /profile-circles/:circleId/members/:memberUserId/remove`.

## Garanties

- le client ne décide jamais de la visibilité ;
- les champs inconnus sont privés par défaut ;
- le solde KnowCoins n’est pas une statistique publique ;
- les événements rejoués ne doublent pas les gains ;
- les niveaux collectifs ne sont pas achetables ;
- aucune invitation ou demande d’adhésion n’est exposée publiquement.
