# KMD-055 — Connexion sociale post-acceptation

## Objet

KMD-055 ajoute une étape volontaire distincte après l’acceptation mutuelle d’une proposition KMD-054.

L’acceptation d’un match ne crée jamais automatiquement une amitié ou une conversation. Chaque participant enregistre séparément et de manière privée les actions qu’il souhaite autoriser :

- créer une amitié ;
- ouvrir une conversation directe ;
- les deux.

Le serveur exécute uniquement l’intersection des choix actifs des deux participants.

## Invariants permanents

1. Une proposition `ACCEPTED` avec `acceptedAt` est obligatoire.
2. Seuls les deux participants peuvent lire ou modifier cette étape.
3. Un utilisateur ne reçoit jamais les choix détaillés de l’autre participant.
4. `partnerResponded` indique seulement qu’une réponse active existe.
5. Une intention unilatérale ne crée aucun objet social.
6. Le score, l’explication, Premium, KnowCoins et les réponses d’affinité ne peuvent pas créer ou prioriser une connexion.
7. Un blocage KMD-054 ou un blocage social empêche toute exécution.
8. Les intentions expirent 72 heures après l’acceptation mutuelle.
9. Une intention peut être révoquée tant qu’aucun résultat n’a été exécuté.
10. Après exécution, l’amitié et la conversation sont gérées par leurs domaines existants.

## Modèle de données

### `SocialConnectionIntent`

Une ligne privée par proposition et utilisateur. Elle contient uniquement les choix de son propriétaire, son état, sa version et son expiration.

États :

- `ACTIVE` ;
- `REVOKED` ;
- `EXPIRED`.

### `SocialConnectionOutcome`

Une ligne maximum par proposition. Elle référence les objets effectivement créés ou réutilisés :

- `friendshipId` ;
- `conversationId`.

Elle ne contient aucun choix privé.

### `SocialConnectionEvent`

Journal métier append-only des intentions, révocations, expirations et exécutions.

### `SocialConnectionReceipt`

Registre d’idempotence par utilisateur et clé d’opération.

## Exécution transactionnelle

La création est réalisée dans une transaction PostgreSQL `SERIALIZABLE` avec reprise limitée sur conflit.

Pour chaque action commune :

- une amitié existante est réutilisée et acceptée si elle n’est pas bloquée ;
- une conversation directe exacte à deux membres est réutilisée ;
- sinon, l’objet est créé une seule fois et son identifiant est persisté dans l’outcome.

Les notifications sont envoyées après validation de la transaction.

## Confidentialité

Les réponses publiques contiennent :

- l’intention du demandeur ;
- un booléen `partnerResponded` ;
- le résultat exécuté ;
- les garanties de confidentialité.

Elles ne contiennent jamais :

- l’intention du partenaire ;
- les critères KMD-054 ;
- les messages privés ;
- les réponses d’affinité ;
- une localisation ;
- une donnée sensible.

## Anti-abus

Chaque utilisateur est limité à douze changements d’intention ou révocations sur vingt-quatre heures.

Les actions sont idempotentes et les blocages sont revérifiés dans la transaction avant toute création.

## Cycle de vie

Le worker KMD-054 expire également les intentions KMD-055 arrivées à échéance.

L’export de compte passe au format 16 lorsqu’une donnée KMD-055 existe. Il exporte uniquement les intentions et événements du propriétaire, ainsi que les outcomes liés à ses propositions.

Lors d’une suppression de compte :

1. les données KMD-055 du compte et les outcomes liés sont supprimés ;
2. KMD-054 anonymise ensuite les identifiants de la proposition ;
3. les relations sociales existantes suivent leurs règles de suppression et de cascade propres.

## Retour arrière

La fonctionnalité peut être retirée sans modifier les propositions KMD-054, les amitiés ou les conversations existantes :

- désactiver les routes KMD-055 ;
- arrêter l’écriture des intentions ;
- conserver ou purger les quatre tables KMD-055 ;
- ne jamais supprimer automatiquement les objets sociaux déjà créés par consentement mutuel.
