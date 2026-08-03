# KMD-042 — Gouvernance, contenus collectifs et famille

## Gouvernance

Les profils collectifs possèdent quatre rôles :

- propriétaire ;
- administrateur ;
- officier ;
- membre.

Le propriétaire conserve les permissions irréversibles : gestion des rôles, transfert de propriété et fin définitive de la structure.

Les administrateurs peuvent gérer l’apparence, les membres, les demandes d’adhésion, la modération et les Stories.

Les officiers peuvent traiter les demandes, modérer et publier du contenu public.

Un Duo ne possède pas de hiérarchie administrative. Il contient un propriétaire technique et un membre, mais l’expérience visuelle reste équilibrée.

## Transfert de propriété

Le transfert suit un processus à deux étapes :

1. le propriétaire choisit un membre actif ;
2. le destinataire accepte explicitement.

Garanties :

- durée de validité de 1 à 168 heures ;
- un seul transfert actif par structure ;
- aucune modification de propriété avant acceptation ;
- expiration automatique ;
- annulation possible par l’expéditeur ou le destinataire ;
- transaction sérialisable au moment de l’acceptation ;
- annulation des autres transferts concurrents ;
- journal d’audit.

## Moments collectifs

Types : texte, photo, dessin, GIF, cadeau et succès.

Audiences :

- membres ;
- public.

Un contenu réservé aux membres peut être publié immédiatement par un membre actif. Un contenu public créé par un membre ordinaire reste en attente. Les officiers, administrateurs et propriétaires peuvent publier publiquement selon leurs permissions.

La file de modération permet :

- approuver ;
- masquer ;
- retirer.

Un contenu approuvé crédite l’XP une seule fois grâce à une clé d’idempotence.

## Stories collectives

Types : texte, photo, vidéo, cadeau et succès.

Durées maximales liées au niveau gagné :

- niveau 1 : 24 heures ;
- niveau 2 : 48 heures ;
- niveaux 3 à 5 : 72 heures.

Aucune Story permanente n’est autorisée dans ce bloc. Premium ne peut pas acheter un niveau ni augmenter la durée accordée par le niveau.

Les Stories expirées, cachées ou en attente sont absentes de la vue publique.

## Famille KnowMe

Un lien familial est déclaratif et volontaire. KnowMe ne déduit jamais une relation biologique, légale ou sentimentale.

Types :

- parent ;
- enfant ;
- frère ou sœur ;
- cousin ou cousine ;
- partenaire ;
- responsable déclaré ;
- autre lien personnalisé.

Règles :

- la structure doit être de type Famille ;
- les deux personnes doivent être membres actifs ;
- le proposant doit être l’une des deux personnes concernées ;
- l’autre personne doit accepter ;
- le lien reste invisible avant acceptation ;
- chaque paire possède un lien unique par Famille ;
- chaque participant peut retirer le lien ;
- l’affichage public précise qu’il ne constitue pas une preuve biologique ou légale.

## Vie privée publique

La page collective omet :

- contenus en attente ;
- contenus masqués ou retirés ;
- Stories expirées ;
- transferts de propriété ;
- rôles et décisions internes non publics ;
- liens familiaux en attente ou refusés ;
- données privées des membres.

L’accès à la page passe toujours par le moteur de visibilité collective KMD-041.

## API

- `GET /profile-circle-governance/public/:slug` ;
- `GET /profile-circle-governance/me/transfers` ;
- `GET /profile-circle-governance/me/family-relations/pending` ;
- `PATCH /profile-circle-governance/:circleId/members/:memberUserId/role` ;
- `POST /profile-circle-governance/:circleId/transfers` ;
- `POST /profile-circle-governance/transfers/:transferId/accept` ;
- `POST /profile-circle-governance/transfers/:transferId/cancel` ;
- `POST /profile-circle-governance/:circleId/moments` ;
- `POST /profile-circle-governance/:circleId/stories` ;
- `GET /profile-circle-governance/:circleId/moderation` ;
- `POST /profile-circle-governance/moments/:momentId/moderate` ;
- `POST /profile-circle-governance/stories/:storyId/moderate` ;
- `POST /profile-circle-governance/:circleId/family-relations` ;
- `POST /profile-circle-governance/family-relations/:relationId/action`.

## Interfaces

- `/profile-circle-governance` : gestion des rôles, contenus, transferts et liens familiaux ;
- `/circles/:slug` : Stories, moments et arbre familial autorisés ;
- `/profile-circles` : cycle de vie général et adhésions.

## Limites restantes

- sélecteur de membres par pseudo au lieu des identifiants techniques ;
- notifications temps réel ;
- médias réels branchés au pipeline de modération ;
- éditeur graphique de l’arbre familial ;
- vues Story plein écran ;
- réactions et commentaires sur les moments ;
- historique de versions des rôles ;
- récupération renforcée après compromission du propriétaire ;
- clients mobiles natifs.
