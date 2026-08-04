# KnowMe — Miroir d’affinité explicable

## Objectif

KMD-053 ajoute un jeu relationnel volontaire construit sur la Game Platform autoritaire KMD-052.

Le jeu compare six préférences déclarées pendant une session et produit un instantané explicable. Il ne mesure pas la personnalité, la santé mentale, la qualité d’une relation, la compatibilité ou la probabilité qu’une relation dure.

## Consentement

Une invitation ne suffit pas à lancer les questions.

Après avoir rejoint la session, chaque participant doit envoyer une action `CONSENT` contenant :

- `accepted: true` ;
- son choix privé `shareAnswers`.

Le moteur n’accepte aucune réponse avant les deux consentements. Un participant qui ne souhaite plus continuer peut abandonner la session ; aucun résultat comparatif n’est alors calculé.

Le choix individuel de partager les réponses détaillées n’est jamais affiché pendant la session. Les détails ne sont inclus dans le résultat que lorsque les deux participants ont choisi `shareAnswers: true`.

## Politique d’invitation

Chaque compte dispose de trois préférences :

- invitations activées ou désactivées ;
- invitations réservées aux amis, activé par défaut ;
- proposition de partage détaillé, désactivée par défaut.

Une préférence absente en base utilise les valeurs sûres par défaut sans créer silencieusement une ligne persistante.

La création de session passe par `GameExperienceService`, qui applique la politique avant d’appeler le moteur transactionnel KMD-052.

## Contenu versionné

`affinity-mirror@1` contient six questions réparties en trois catégories :

- communication ;
- confiance pratique ;
- rythme partagé.

Les questions, options, règles et le moteur appartiennent au checksum immuable de la définition. Une modification de contenu exige une nouvelle version de jeu.

## Réponses cachées

Chaque question possède quatre options.

Le premier choix est stocké uniquement dans l’état autoritaire. L’état public indique seulement quelle position a déjà répondu. Il ne révèle ni l’option, ni le choix de partage, ni une interprétation intermédiaire.

Le second choix clôt la question. Le moteur calcule alors un score descriptif de proximité sur l’échelle de réponses et alterne le joueur qui commence la question suivante.

## Résultat explicable

Le résultat contient :

- le nombre de choix exactement identiques ;
- un score descriptif global borné entre 0 et 100 ;
- un score par catégorie ;
- trois explications factuelles ;
- un avertissement permanent ;
- éventuellement les choix textuels, uniquement avec double accord.

Il n’existe aucun gagnant, perdant, classement public, badge, entitlement, XP, KnowCoin ou récompense économique.

Les écarts sont présentés comme des préférences différentes dans ce jeu et non comme un défaut de l’un des participants.

## Replay privé

Le snapshot interne reste vérifié par checksum serveur.

Sans double accord :

- la graine n’est pas exposée ;
- les charges utiles `ANSWER` deviennent `{ redacted: true }` ;
- les états initial et final passent par la projection publique ;
- le replay reste interprétable mais n’est pas reproductible par le participant ;
- `verificationScope` vaut `SERVER`.

Avec double accord, les réponses détaillées peuvent être restituées aux deux participants. Un non-participant ne peut jamais lire la session ou le replay.

## Export et suppression

L’export de compte passe au format 14 seulement lorsqu’une préférence ou une partie d’affinité existe. Il inclut la préférence persistée et les actions du compte, mais jamais une graine active ni les réponses de l’autre participant.

Lors d’une suppression de compte :

1. la préférence est supprimée ;
2. les réponses du compte sont remplacées par une marque d’expurgation ;
3. les réponses sont retirées de l’état autoritaire, du résultat et du snapshot ;
4. le checksum du snapshot est recalculé ;
5. les identifiants d’auteur sont anonymisés par KMD-052 ;
6. le participant restant conserve uniquement un résultat agrégé et un replay privé vérifié.

## Surfaces clientes

Web et Mobile sont séparés de Pulse Duel. Ils :

- affichent la politique de confidentialité ;
- créent uniquement `affinity-mirror` ;
- demandent le consentement explicite ;
- transmettent une option et la séquence attendue ;
- affichent le résultat serveur ;
- ne calculent aucun score local ;
- indiquent clairement si le replay est expurgé.

## Hors périmètre

- diagnostic psychologique ;
- recommandation de rupture ou de relation ;
- comparaison publique de couples, amis ou cercles ;
- score global persistant entre deux personnes ;
- matchmaking automatique fondé sur les réponses ;
- publicité ciblée ou entraînement de modèle à partir des réponses ;
- mise, pari, cash prize, KnowCoins, XP ou achat de puissance.
