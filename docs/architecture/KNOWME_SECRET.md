# KMD-038 — KnowMe Secret

## Décision produit

KnowMe Secret est une application intégrée séparée de KnowMe Messenger.

- Messenger utilise une identité visible ;
- Secret reçoit des questions, compliments, confessions et avis anonymes ;
- aucun message Secret n’est créé comme conversation classique ;
- aucune réponse Secret ne révèle automatiquement l’expéditeur.

## Activation

L’utilisateur active volontairement sa page Secret.

Exemple :

- `knowme.app/secret/tresor`.

Une page désactivée refuse tous les nouveaux messages mais peut conserver l’historique selon les choix de l’utilisateur.

## Page publique

La page peut afficher :

- avatar ;
- nom public ;
- présentation ;
- fond ;
- couleurs ;
- musique ;
- animations ;
- compteur de messages reçu calculé par le serveur ;
- catégories acceptées.

Exemple :

> Trésor — Pose-moi une question anonymement.

## Catégories

- question ;
- compliment ;
- confession ;
- avis.

Le destinataire peut désactiver séparément chaque catégorie.

## Personnalisation

Gratuit :

- avatar ;
- couleurs ;
- présentation ;
- fond simple ;
- compteur public facultatif.

Premium :

- musique ;
- animations avancées ;
- thèmes ;
- statistiques agrégées ;
- filtres de sécurité avancés ;
- indices respectueux de la vie privée.

Tous les médias sont stockés et modérés par KnowMe.

## Protection de l’anonymat

Le destinataire ne reçoit jamais :

- nom de l’expéditeur ;
- identifiant de compte ;
- adresse email ;
- numéro de téléphone ;
- adresse IP ;
- appareil exact ;
- localisation précise.

Premium ne peut pas acheter la révélation de ces données.

KnowMe peut conserver certaines données techniques de sécurité avec accès restreint, durée limitée et journalisation, uniquement pour :

- prévention d’abus ;
- blocage ;
- enquête de sécurité ;
- obligations légales applicables.

Ces données ne sont pas exposées au destinataire.

## Indices Premium

Deux modes sûrs :

### Indice choisi par l’expéditeur

L’expéditeur sélectionne volontairement une formule comme :

- une personne de ta communauté tech ;
- quelqu’un que tu connais depuis longtemps ;
- une personne qui apprécie ton travail.

L’indice ne doit pas contenir de nom ou contact interdit.

### Indice agrégé

Le système peut fournir un contexte très large uniquement lorsque :

- l’ensemble d’anonymat contient suffisamment de personnes ;
- un budget de confidentialité est disponible ;
- le risque de réidentification est faible.

Exemple :

- contexte agrégé parmi au moins vingt personnes.

Aucun indice exact de localisation, appareil, heure détaillée ou relation unique n’est autorisé.

## Sécurité anti-harcèlement

Avant livraison :

- limite quotidienne ;
- vérification anti-robot ;
- ancienneté minimale facultative ;
- modération du contenu ;
- score de risque de harcèlement ;
- contrôle des termes bloqués ;
- détection des répétitions ;
- détection de menaces et divulgation de données personnelles.

Le destinataire peut :

- supprimer ;
- signaler ;
- bloquer l’expéditeur anonyme grâce à un token opaque ;
- désactiver sa page ;
- imposer un compte KnowMe ;
- imposer une ancienneté minimale ;
- imposer une vérification anti-robot ;
- retarder la livraison ;
- limiter les catégories.

Le blocage par token empêche les futurs messages du même expéditeur sans révéler son identité.

## Réponses et partage

Le destinataire peut :

- répondre publiquement sans ouvrir une discussion privée avec l’expéditeur ;
- publier le message dans un statut après suppression des données sensibles ;
- ajouter une réaction d’avatar ;
- masquer le texte original ;
- désactiver les réponses publiques.

Le partage doit prévenir l’utilisateur qu’une confession peut contenir des informations privées.

## Statistiques Premium

Statistiques autorisées :

- volume par période ;
- catégories ;
- taux de messages bloqués ;
- taux de compliments, questions ou avis ;
- heures agrégées ;
- tendances de mots après anonymisation ;
- interactions avec les réponses publiques.

Statistiques interdites :

- liste d’expéditeurs ;
- carte exacte ;
- appareil individuel ;
- corrélation permettant d’identifier une personne.

## API fondation livrée

- `GET /knowme-secret/policy`.

Le domaine valide également :

- identifiants publics ;
- apparence ;
- préférences de réception ;
- messages candidats ;
- indices respectueux de l’anonymat.

La persistance des pages, inbox, signalements et tokens de blocage arrive dans le bloc transactionnel suivant.
