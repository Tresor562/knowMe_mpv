# KMD-039 — KnowMe Secret : activation, partage, profils et réception

## Réponse produit

KnowMe Secret reprend le cœur utile des applications de questions anonymes :

1. l’utilisateur active sa page ;
2. il obtient un lien personnel ;
3. il partage ce lien ou une question précise ;
4. une personne ouvre la page publique ;
5. elle écrit sans que son identité soit affichée au destinataire ;
6. le message arrive dans une boîte Secret séparée ;
7. le destinataire peut répondre et produire une carte partageable.

KnowMe ajoute des capacités absentes ou moins centrales dans ce modèle :

- envoi depuis un profil KnowMe lorsque le propriétaire l’autorise ;
- campagne indépendante par question ;
- expiration et limite de réponses ;
- catégories Question, Compliment, Confession et Avis ;
- lien général et liens de questions ;
- liens profonds et préparation QR ;
- pause temporaire ;
- blocage d’un expéditeur sans révéler son identité ;
- intégration aux notifications KnowMe ;
- personnalisation par avatar et identité numérique ;
- indices Premium respectueux de l’anonymat, sans vente de l’identité.

## Activation

La page est créée automatiquement en état désactivé lors de la première ouverture du centre Secret.

Tant que `enabled = false` :

- aucun lien n’accepte de message ;
- le bouton anonyme ne s’affiche pas sur le profil ;
- les anciens liens affichent une indisponibilité ;
- l’historique du propriétaire reste consultable selon la politique de conservation.

Après activation :

- le lien général devient utilisable ;
- l’utilisateur peut créer et partager une question ;
- la boîte reçoit les messages validés ;
- les notifications signalent chaque nouvelle réception.

## Deux modes d’entrée

### Lien général

Exemple :

`knowme.app/secret/tresor`

Il utilise la présentation et la question par défaut de la page.

### Question partageable

Exemple :

`knowme.app/secret/tresor?question=<token>`

Chaque question possède :

- son texte ;
- sa catégorie ;
- sa source ;
- un statut ;
- une date d’expiration facultative ;
- un nombre maximal de réponses facultatif ;
- un compteur de réponses ;
- un compteur de partages.

Une question peut être fermée sans désactiver toute la page.

## Envoi depuis le profil

Le propriétaire contrôle `profileEntryEnabled`.

Lorsque la page et cette option sont actives, le profil affiche :

> Envoyer un message anonyme

Le bouton ouvre :

`/secret/:slug?entry=PUBLIC_PROFILE_CTA`

Lorsque l’option est désactivée :

- le bouton disparaît du profil ;
- les liens déjà partagés peuvent continuer à fonctionner ;
- la page complète peut toujours être désactivée séparément.

Cette séparation évite de forcer l’utilisateur à choisir entre visibilité publique et partage privé.

## Emplacements dans KnowMe

### Navigation principale

Un onglet `Secret` ouvre `/secret`.

### Profil personnel

Le centre permet :

- activation ;
- désactivation ;
- partage du lien général ;
- contrôle du bouton public ;
- autorisation des visiteurs sans compte ;
- création de questions ;
- consultation de la boîte ;
- blocage et réponse.

### Profil public

Le bouton d’envoi apparaît uniquement si la page est active et si le propriétaire autorise cet emplacement.

### Extensions prévues

- compositeur de Statut ;
- Stories personnelles ;
- outils Messenger ;
- QR code ;
- feuille de partage native ;
- widgets et cartes de profil.

## Mode d’emploi affiché

La première page explique :

1. active ta page ;
2. crée une question ou utilise le lien général ;
3. partage sur KnowMe ou une autre application ;
4. reçois les réponses dans la boîte Secret ;
5. réponds, archive, bloque ou signale.

La page publique explique aussi pourquoi elle existe et où la réponse sera envoyée.

## Vie privée

Le destinataire ne reçoit pas :

- le nom ;
- le profil KnowMe ;
- l’adresse IP ;
- la localisation exacte ;
- l’appareil précis.

Le serveur produit un token irréversible et propre au destinataire à partir de signaux techniques limités. Ce token sert uniquement à :

- limiter les abus ;
- détecter les répétitions ;
- bloquer un expéditeur pour cette page.

Il ne doit pas être affiché au propriétaire.

## Sécurité

Avant livraison :

- page active ;
- campagne active ;
- date valide ;
- limite non atteinte ;
- catégorie autorisée ;
- longueur contrôlée ;
- mots masqués ;
- blocage vérifié ;
- limite quotidienne ;
- score de risque ;
- vérification anti-robot lorsqu’un fournisseur est configuré.

La vérification anti-robot reste désactivée par défaut tant qu’un fournisseur ou un mécanisme serveur vérifiable n’est pas configuré. Une simple valeur envoyée par le client ne doit jamais être considérée comme une preuve.

## Scénarios couverts

### Activation et partage

- première ouverture ;
- activation ;
- désactivation ;
- partage du lien général ;
- création d’une question ;
- partage natif non disponible avec copie de secours ;
- question expirée ;
- question fermée ;
- limite de réponses atteinte.

### Profil

- profil avec Secret actif ;
- profil avec bouton masqué ;
- lien partagé actif alors que le bouton profil est masqué ;
- page désactivée après partage.

### Expéditeurs

- visiteur sans compte ;
- utilisateur connecté restant anonyme ;
- expéditeur bloqué ;
- envois répétés ;
- message contenant un terme masqué ;
- contenu à risque élevé ;
- réseau instable et double clic.

### Destinataire

- réception et notification ;
- lecture ;
- archivage ;
- blocage ;
- réponse publique ;
- future réponse brouillon privée ;
- signalement ;
- suppression et conservation limitée.

### Exploitation

- page suspendue ;
- compte suspendu ;
- modération en attente ;
- rotation de lien ;
- export et suppression des données ;
- accessibilité et réduction des animations.

## Limites honnêtes de KMD-039

Livré :

- persistance Prisma ;
- API d’activation ;
- API de campagne ;
- envoi public ;
- boîte ;
- notifications ;
- blocage opaque ;
- réponses partageables ;
- pages Web ;
- navigation ;
- bouton de profil ;
- règles et tests de scénarios.

Encore à compléter :

- fournisseur anti-robot de production ;
- pipeline complet de modération IA ;
- signalement connecté à la console de sécurité ;
- rotation/révocation de token de campagne dans l’interface ;
- cartes de réponse exportées en image ;
- intégration Statuts et Stories ;
- clients mobiles natifs ;
- instrumentation anti-double-envoi avec clé d’idempotence ;
- assurance d’âge et politiques adaptées aux mineurs.
