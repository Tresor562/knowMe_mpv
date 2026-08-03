# KMD-040 — Concept K : profils KnowMe vivants

## Vision

Un profil KnowMe n’est pas une fiche statique. Il raconte l’histoire autorisée d’une personne : identité, progression, goûts, relations, défis, jeux, cadeaux, badges, souvenirs et évolution.

Deux principes sont non négociables :

1. le profil doit être expressif et partageable ;
2. une section privée ne doit jamais être envoyée au client non autorisé.

## Composition

Le profil peut présenter :

- avatar ou photo ;
- couverture statique ou animée ;
- cadre, thème et effets ;
- pseudo, nom, bio et badges ;
- niveau, XP et progression visuelle ;
- statut Premium, certification et présence selon autorisation ;
- statistiques ;
- collections ;
- galerie de cadeaux ;
- mur ;
- frise de souvenirs ;
- compatibilité ;
- relations Duo, Équipe, Famille et Guilde ;
- carte de visite partageable.

Chaque section possède sa propre audience.

## Audiences

- Public ;
- Amis ;
- Followers ;
- Meilleurs amis ;
- Duo ;
- Équipe ;
- Famille ;
- Guilde ;
- Communautés ;
- Privé.

Le serveur résout l’audience effective à chaque consultation. Une modification du HTML, du cache local ou d’un appel API ne permet pas de récupérer une section refusée.

## Profil verrouillé

Lorsque le profil est verrouillé, une personne extérieure voit par défaut :

- photo ou avatar ;
- couverture ;
- pseudo ;
- nom affiché ;
- bio publique ;
- badges explicitement publics ;
- actions Ajouter, Suivre ou Secret autorisées.

Les autres sections sont omises. Le propriétaire peut autoriser une section précise même lorsque le profil est verrouillé.

Après acceptation d’une amitié, le serveur recalcule automatiquement la relation et les sections autorisées apparaissent sans modifier les données sources.

## Profil Duo

Types :

- Couple ;
- Meilleurs amis ;
- Frère ou sœur ;
- Duo gaming ;
- Duo créatif.

Règles :

- exactement deux membres ;
- invitation et consentement explicite ;
- aucun affichage public avant tous les consentements ;
- couverture, bio, animation et positions complémentaires possibles ;
- fin ou pause de la relation auditée ;
- aucun lien sentimental inféré automatiquement par KnowMe.

## Équipe, Famille et Guilde

### Équipe

- deux à sept membres ;
- bannière, nom, emblème et couleur ;
- statistiques, défis, jeux, Stories, XP et niveau collectifs ;
- consentement de chaque membre avant affichage.

### Famille

- arbre interactif ;
- relations déclarées volontairement ;
- aucune déduction biologique ou légale ;
- visibilité indépendante par membre ;
- possibilité de masquer la structure entière.

### Guilde

- chef, officiers et membres ;
- niveau, XP, tournois et récompenses ;
- demande d’adhésion possible ;
- permissions distinctes du profil individuel.

## Mode Influenceur

Le mode Influenceur prépare :

- followers et abonnements ;
- publications populaires ;
- vues agrégées ;
- statistiques de Stories ;
- collaborations ;
- abonnements de fans ;
- revenus créateurs lorsque l’économie et la conformité sont activées.

Les revenus exacts sont privés par défaut.

## Mur

Modes :

- public ;
- amis ;
- désactivé.

Contenus : texte, photo, dessin, GIF ou cadeau. Une publication externe commence en attente de validation. Les médias restent soumis au pipeline de modération.

## Galerie de cadeaux

La galerie référence les instances de cadeaux autorisées par leur propriétaire. Elle peut présenter rareté, animation, provenance et message selon la confidentialité du cadeau.

Les prix d’achat et les données économiques privées ne sont pas exposés automatiquement.

## Profil vivant

Le profil peut réagir à :

- météo ;
- saisons ;
- anniversaire ;
- événements KnowMe ;
- progression ;
- statut Premium.

Ces effets respectent :

- réduction des animations ;
- performance de l’appareil ;
- consommation de données ;
- autorisation utilisateur ;
- absence de collecte météo précise non nécessaire.

## Bio intelligente et IA

Avec consentement, l’assistant peut proposer :

- bio originale ;
- présentation professionnelle ;
- couverture ;
- thème ;
- défis adaptés ;
- objectifs de badges.

L’IA propose, l’utilisateur valide. Elle ne publie jamais automatiquement et ne déduit pas de caractéristiques sensibles.

## Frise et coffre des souvenirs

### Frise

Événements partageables : création du compte, premier ami, premier défi, premier badge, premier cadeau, victoire ou moment marquant.

Chaque événement possède sa propre audience.

### Coffre

Privé par défaut :

- anciens avatars ;
- anciennes couvertures ;
- anciens pseudos ;
- anciens thèmes ;
- badges saisonniers ;
- cadeaux précieux ;
- captures de moments.

Les anciens pseudos et valeurs privées ne sont jamais inclus dans la vue publique par défaut.

## Compatibilité

Catégories : amour, amitié, gaming, études, musique, anime et voyages.

Le calcul peut utiliser des signaux autorisés et agrégés. La réponse n’expose jamais :

- extraits de messages privés ;
- centres d’intérêt masqués ;
- actions privées exactes ;
- localisation ;
- identité d’un tiers.

Un seuil minimal de signaux est requis avant affichage.

## Carte de visite

Chaque profil possède :

- code court ;
- lien partageable ;
- QR payload ;
- thème ;
- avatar ;
- badges et niveau autorisés.

La carte ne contourne pas les réglages du profil.

# Profile Guard

## Portées

- profil ;
- messages privés ;
- messages anonymes ;
- médias Voir une seule fois ;
- cadeaux rares ;
- conversations secrètes ;
- paiements ;
- administration ;
- documents sensibles.

Paiements, administration, médias à consultation unique et documents sensibles conservent une protection de base sans abonnement Premium.

Premium permet la sélection détaillée des autres zones et les styles décoratifs du bouclier. Premium ne rend pas techniquement possible ce que le système d’exploitation interdit.

## Android

KnowMe utilisera la surface sécurisée native via `FLAG_SECURE` ou l’adaptateur Expo équivalent sur les écrans protégés.

Effets attendus lorsque le système le respecte :

- capture bloquée ou image vide ;
- enregistrement et partage d’écran protégés ;
- aperçu des applications récentes masqué ;
- affichage sur écran non sécurisé bloqué.

KnowMe ne promet pas une garantie absolue sur tous les fabricants, anciennes versions, appareils modifiés ou attaques externes.

La détection moderne de capture peut être utilisée sur les versions Android compatibles. Les permissions d’accès large aux photos ne doivent pas être demandées uniquement pour surveiller les utilisateurs sur les anciennes versions.

## iOS

iOS ne fournit pas un mécanisme général permettant de promettre le blocage absolu de toute capture sur toutes les versions.

KnowMe utilise les capacités autorisées :

- protection native fournie par l’adaptateur compatible ;
- détection d’une capture après sa réalisation lorsqu’elle est signalée ;
- détection d’enregistrement, recopie ou AirPlay actif ;
- masquage ou remplacement du contenu sensible pendant une capture active ;
- protection de l’aperçu du sélecteur d’applications.

L’interface explique clairement les limites.

## Web et bureau

Le navigateur ne peut pas empêcher de manière fiable :

- capture système ;
- logiciel externe ;
- appareil photo externe.

Les protections possibles sont : avertissement, filigrane, limitation serveur, masquage au changement de visibilité et audit. Elles sont décrites comme dissuasion, jamais comme blocage garanti.

## Notifications de tentative

Un propriétaire n’est averti que si :

- il a activé la notification ;
- l’événement vient d’un signal natif compatible ;
- le signal est attesté ou vérifié côté serveur ;
- le type d’événement est suffisamment fiable.

Un simple booléen envoyé par le client ne déclenche jamais une accusation ou une notification.

Les événements ne stockent pas le contenu de la capture.

## Endpoints KMD-040

- `GET /profile-experience/policy` ;
- `GET /profile-experience/me` ;
- `PATCH /profile-experience/me` ;
- `PUT /profile-experience/me/visibility` ;
- `PUT /profile-experience/me/guard` ;
- `POST /profile-experience/circles` ;
- `POST /profile-experience/circles/:id/accept` ;
- `GET /profile-experience/public/:username` ;
- `POST /profile-experience/public/:username/wall` ;
- `GET|POST /profile-experience/me/memories` ;
- `POST /profile-experience/capture-events` ;
- `GET /profile-experience/compatibility/:username`.

## Livré dans KMD-040

- modèles Prisma ;
- moteur de confidentialité ;
- profil verrouillé serveur ;
- relations consenties ;
- mur ;
- frise et coffre ;
- vitrine cadeaux ;
- carte partageable ;
- snapshot de compatibilité respectueux de la vie privée ;
- politique multi-plateforme Profile Guard ;
- événements de capture non fiables neutralisés ;
- studio Web ;
- nouveau profil Web ;
- contrat mobile par écran ;
- tests de domaine.

## Blocs suivants

- moteur de statistiques alimenté par événements réels ;
- édition graphique complète des couvertures et cadres ;
- transitions Duo ;
- pages Équipe, Famille et Guilde ;
- arbre familial ;
- agrégateur Influenceur ;
- export image et QR réels ;
- adaptateur `expo-screen-capture` installé avec la version SDK compatible ;
- attestation native des événements ;
- modération des murs et médias ;
- instrumentation des souvenirs ;
- interface Mobile finale ;
- tests E2E de toutes les audiences.
