# KMD-043 — Recherche de membres et notifications collectives

## Objectif

Supprimer les identifiants techniques des parcours courants et informer immédiatement les personnes concernées par une action collective.

## Répertoire de membres

Endpoint :

- `GET /profile-member-directory?q=<texte>&circleId=<optionnel>&limit=<optionnel>`.

Règles :

- authentification obligatoire ;
- deux caractères minimum ;
- recherche sur pseudo et nom affiché ;
- recherche insensible à la casse ;
- maximum vingt résultats ;
- utilisateur courant exclu ;
- comptes suspendus exclus ;
- relation d’amitié facultative ;
- participation collective facultative lorsque `circleId` est fourni.

La réponse ne contient jamais :

- email ;
- téléphone ;
- KnowCoins ;
- portefeuille ;
- revenus ;
- dernière activité ;
- centres d’intérêt privés ;
- données de sécurité.

Les champs sont sélectionnés explicitement côté serveur. Le client ne reçoit donc pas un objet complet ensuite masqué visuellement.

## Sélecteur Web

Le composant `ProfileMemberPicker` :

- recherche après une courte temporisation ;
- affiche pseudo, nom et avatar autorisé ;
- indique une amitié ou participation existante ;
- évite les doublons ;
- respecte la capacité du type de profil collectif ;
- n’affiche aucune donnée financière.

Le parcours `/profile-circle-create` permet de créer :

- Duo Couple ;
- Duo Meilleurs amis ;
- Duo Fratrie ;
- Duo Gaming ;
- Duo Créatif ;
- Équipe ;
- Famille ;
- Guilde.

Après création, les membres sélectionnés reçoivent une invitation persistée et temps réel.

## Notifications collectives

Les notifications réutilisent :

- la table `Notification` existante ;
- `NotificationsService` ;
- `RealtimeGateway` ;
- l’écran et le compteur de notifications existants.

Événements couverts :

- invitation ;
- acceptation ou refus ;
- départ ou retrait ;
- demande d’adhésion ;
- acceptation ou refus d’adhésion ;
- changement d’état collectif ;
- changement de rôle ;
- création, acceptation ou annulation de transfert ;
- décision de modération ;
- proposition, acceptation, refus ou retrait familial.

Chaque notification contient un lien interne vers :

- la page collective ;
- le centre de relations ;
- le centre de gouvernance.

## Idempotence

Une action possède une `idempotencyKey` unique.

Le système crée :

- un dispatch collectif ;
- une ligne de livraison par destinataire ;
- un état `PENDING`, `PROCESSING`, `DELIVERED` ou `FAILED` ;
- un jeton de traitement ;
- un nombre de tentatives ;
- l’identifiant de la notification créée.

La livraison de chaque destinataire est revendiquée dans une transaction sérialisable. La notification et l’état `DELIVERED` sont écrits dans la même transaction. Un rejeu voit la livraison terminée et ne crée pas de doublon.

Un traitement bloqué depuis plus de cinq minutes peut être repris. Une erreur replace la livraison en `FAILED` sans accuser l’utilisateur.

## Temps réel

Après validation transactionnelle, la notification complète est envoyée à `NotificationsService.publishCreated`, qui utilise le canal temps réel existant.

La base de données reste la source de vérité. Une perte de connexion WebSocket n’entraîne pas la perte de la notification : elle sera visible au prochain chargement.

## Vie privée

- l’acteur n’est pas notifié de sa propre action par défaut ;
- les destinataires sont dédupliqués ;
- les liens sont internes ;
- aucune donnée KnowCoins n’entre dans le répertoire ou les payloads ;
- les demandes privées ne sont envoyées qu’aux responsables autorisés ;
- les décisions de modération ne sont envoyées qu’à l’auteur concerné ;
- les liens familiaux sont envoyés uniquement aux deux personnes concernées.

## Limites restantes

- préférences de notification par catégorie ;
- notifications push Android/iOS ;
- emails facultatifs ;
- regroupement de notifications très nombreuses ;
- centre de reprise administrateur pour les livraisons `FAILED` ;
- recherche phonétique et translittération ;
- sélection de membres directement dans tous les formulaires de gouvernance ;
- suggestions intelligentes respectueuses de la vie privée.
