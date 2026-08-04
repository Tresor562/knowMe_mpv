# KnowMe — Matchmaking social volontaire et non sensible

## Objectif

KMD-054 propose des connexions sociales sur la base de critères fermés, choisis explicitement au moment de rejoindre la file.

Le système n’analyse pas le profil privé, les conversations, les réponses du Miroir d’affinité ou une donnée sensible. Il ne prédit pas la compatibilité personnelle. Il explique seulement pourquoi deux demandes de mise en relation sont compatibles.

## Consentement et sortie

La préférence `matchmakingEnabled` est désactivée par défaut. Une absence de ligne en base retourne cette valeur sûre sans écriture implicite.

Pour rejoindre la file, le compte doit :

- activer explicitement le matchmaking ;
- autoriser les propositions avec de nouvelles personnes ;
- envoyer une clé d’idempotence ;
- fournir uniquement les critères autorisés.

Désactiver l’une des préférences ou appeler `DELETE /social-matchmaking/queue` retire immédiatement le compte de la file. Une proposition ouverte est annulée et l’autre personne est remise en file uniquement si son propre consentement reste actif.

## Critères autorisés

Le schéma et les DTO n’acceptent que :

- objectif : discuter, jouer, apprendre ou créer ;
- rythme : temps réel, asynchrone ou flexible ;
- une à cinq langues BCP 47 simplifiées ;
- un à huit sujets appartenant à une liste publique fermée ;
- un à quatorze créneaux hebdomadaires exprimés en jour et minutes UTC.

Aucun texte libre ne participe au score.

## Critères interdits

Le service ne possède aucune dépendance ou colonne pour :

- réponses ou résultats du Miroir d’affinité ;
- messages, conversations ou contacts privés ;
- religion, santé, handicap, orientation sexuelle ou identité de genre ;
- opinions politiques ou appartenance syndicale ;
- biométrie ou vérification d’identité ;
- données financières, achats, Premium, KnowCoins, XP ou rang ;
- adresse, GPS, latitude, longitude ou localisation précise ;
- origine ethnique ou nationalité ;
- décisions de modération privées.

Les centres d’intérêt existants du profil ne sont pas lus. Les sujets doivent être sélectionnés à nouveau dans la file.

## Algorithme explicable

Deux entrées sont compatibles uniquement si :

1. elles partagent le même objectif ;
2. elles partagent au moins une langue choisie ;
3. elles partagent au moins un sujet choisi ;
4. leurs rythmes sont identiques ou l’un est flexible ;
5. elles possèdent au moins trente minutes UTC communes ;
6. aucun blocage n’existe dans un sens ou l’autre ;
7. aucune proposition active n’occupe l’un des comptes ;
8. aucun refus récent ne crée un cooldown de quatorze jours.

Le score borné sur 100 additionne uniquement :

- sujets partagés : maximum 40 ;
- langues partagées : maximum 20 ;
- compatibilité du rythme : maximum 20 ;
- disponibilité commune : maximum 20.

Chaque proposition persiste une explication indiquant les langues, sujets, minutes communes et la raison du rythme. Elle persiste également quatre marqueurs `false` attestant que les données sensibles, réponses d’affinité, messages privés et localisation précise n’ont pas été utilisés.

## Concurrence et idempotence

Une seule entrée existe par compte. Rejoindre la file met à jour cette entrée et incrémente sa version.

La création d’une proposition s’exécute dans une transaction `Serializable`. Les deux entrées doivent encore être `QUEUED` avec les versions observées. Une proposition active préexistante empêche la création concurrente d’un doublon.

Les opérations de file et de décision utilisent des reçus persistants `(userId, idempotencyKey)`.

## Décisions

Chaque participant peut :

- accepter ;
- refuser ;
- bloquer.

Une connexion n’est acceptée qu’après deux décisions `ACCEPT` persistées.

Un refus retire son auteur de la file et remet l’autre personne en file si son consentement et son expiration le permettent. Un blocage ajoute une exclusion bidirectionnelle pour l’algorithme, clôt la proposition et reste révocable depuis la liste personnelle des blocages.

Le partenaire reçoit seulement une notification neutre de clôture ; la décision détaillée n’est pas divulguée.

## Limites anti-abus

Le service persiste les événements de file et de décision. Il limite les entrées répétées et les décisions quotidiennes avant toute transaction.

Le worker de maintenance :

- expire les entrées après quarante-huit heures ;
- expire les propositions après vingt-quatre heures ;
- remet les participants éligibles en file ;
- tente les appariements par lots bornés ;
- empêche deux ticks concurrents dans un même processus.

La sécurité multi-instance repose sur les versions, les statuts conditionnels et les transactions sérialisables.

## Gouvernance

Le tableau d’exploitation exige `matchmaking.manage`. Il affiche les volumes par statut, les propositions récentes et confirme que les quatre catégories interdites sont désactivées.

Les modérateurs peuvent inspecter l’état opérationnel, mais aucun endpoint administratif ne révèle de messages privés ou de réponses d’affinité, car ces données ne sont jamais lues ni stockées par ce domaine.

## Export et suppression

L’export passe au format 15 seulement lorsqu’une préférence, une entrée, une décision, une proposition ou un blocage existe. Il contient les critères explicitement fournis par le compte et les interactions auxquelles il participe.

Lors d’une suppression :

1. les propositions ouvertes sont annulées ;
2. l’autre compte est remis en file s’il reste volontaire ;
3. préférences, entrée, décisions, reçus, événements et blocages sont supprimés ;
4. une proposition acceptée conserve son statut mais remplace l’identifiant supprimé par un tombstone aléatoire ;
5. aucun critère sensible ne nécessite d’être expurgé, car aucun n’est collecté.

## Surfaces clientes

Web et Mobile utilisent la même liste fermée de critères. Ils affichent :

- l’opt-in ;
- les critères transmis ;
- l’état de la file ;
- la personne proposée ;
- les explications du score ;
- les quatre exclusions ;
- les actions accepter, refuser, bloquer et quitter.

Aucun score n’est recalculé côté client.

## Hors périmètre

- recommandation amoureuse ;
- profilage psychologique ;
- recherche par proximité géographique ;
- filtrage par données sensibles ;
- classement de popularité ;
- boost payant ;
- enchère, mise ou priorité achetée ;
- création automatique d’amitié ou de conversation avant double acceptation ;
- utilisation publicitaire ou entraînement de modèle.
