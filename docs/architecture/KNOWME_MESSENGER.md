# KMD-038 — KnowMe Messenger

## Décision produit

KnowMe Messenger devient la messagerie sociale principale de KnowMe. Elle combine :

- la rapidité et la simplicité d’une messagerie instantanée moderne ;
- la puissance des groupes, fichiers, bots et outils avancés ;
- les réactions, effets et interactions sociales ;
- l’identité KnowMe : avatars vivants, cadeaux, défis, jeux et personnalisation.

La messagerie anonyme n’est pas intégrée aux conversations classiques. Elle appartient au produit séparé `KnowMe Secret`.

## Navigation principale

L’expérience Messenger comporte cinq onglets :

1. Discussions ;
2. Amis ;
3. Jeux ;
4. Cadeaux ;
5. Communautés.

L’onglet Discussions affiche :

- recherche ;
- conversations privées ;
- groupes ;
- dernier message ;
- statut en ligne ;
- messages non lus ;
- messages épinglés ou importants ;
- raccourcis vers appels, fichiers et médias.

## Conversations classiques

Les conversations classiques utilisent une identité visible.

Elles permettent :

- discussion individuelle ;
- discussion de groupe ;
- réponses à un message ;
- réactions rapides ;
- transferts ;
- messages programmés ;
- messages temporaires ;
- modification dans une fenêtre limitée ;
- suppression pour soi ou pour tous ;
- accusés de lecture configurables ;
- recherche dans l’historique ;
- messages épinglés ;
- favoris et signets privés.

## Apparence d’une conversation

Chaque utilisateur peut personnaliser localement l’apparence d’une discussion sans modifier celle de l’autre participant.

### Fonds gratuits

- couleurs ;
- dégradés KnowMe ;
- thèmes simples ;
- motifs statiques.

### Fonds personnels

L’utilisateur peut choisir :

- une photo de galerie ;
- une image téléchargée ;
- une création IA générée dans KnowMe ;
- un asset enregistré dans son espace média.

Le média doit être transféré vers KnowMe, analysé et modéré. Le client ne peut pas utiliser directement une URL arbitraire comme fond permanent.

### Réglages

- flou ;
- luminosité ;
- opacité ;
- filtre coloré ;
- animation ;
- réduction du mouvement ;
- présence de l’avatar à côté des messages.

### Fonds animés Premium

Catalogue initial :

- Galaxie ;
- Pluie ;
- Sakura ;
- Océan ;
- Flammes ;
- Cyber ;
- Gaming.

Premium donne accès à des assets plus avancés, mais ne modifie pas la priorité de livraison des messages.

## Bulles de messages

Quatre styles initiaux :

- `CLASSIC` : simple et lisible ;
- `MODERN` : bulles arrondies et réactions rapides ;
- `CLEAN` : présentation compacte, réponses et transferts avancés ;
- `KNOWME` : avatar, effets, cadeaux, défis et interactions intégrées.

La lisibilité et l’accessibilité restent prioritaires. Les utilisateurs peuvent désactiver les animations et augmenter le contraste.

## Avatars dans les discussions

L’avatar est une extension visuelle du profil.

Possibilités :

- affichage à côté des messages ;
- animation lors d’une réaction ;
- expression contextuelle ;
- animation de félicitation ;
- animation de réception d’un cadeau ;
- animation de victoire après un jeu ou défi ;
- pose configurée dans le profil.

Les réactions de l’avatar sont visuelles uniquement. Elles ne changent ni le score, ni la portée, ni la priorité des messages.

## Effets de messages

Effets initiaux :

- Amour : explosion de cœurs ;
- Fête : confettis ;
- Important : feu visuel ;
- Cadeau : révélation animée ;
- Victoire : trophée.

Le destinataire peut :

- désactiver tous les effets ;
- activer la réduction des animations ;
- limiter les effets aux amis ;
- bloquer les effets dans les groupes.

## Cadeaux intégrés

Un bouton Cadeau ouvre Gift Exchange depuis la conversation.

L’utilisateur peut envoyer :

- fleurs ;
- diamants ;
- cadeaux événementiels ;
- collectibles ;
- cadeaux duo ;
- objets cosmétiques compatibles.

Le cadeau apparaît comme un message structuré, pas comme du texte non vérifié. L’identifiant de l’instance et la propriété sont résolus côté serveur.

## Jeux et défis

Depuis une conversation :

- Tic Tac Toe ;
- Quiz ;
- Bowling ;
- Mémoire ;
- défis entre amis ;
- jeux communautaires ;
- invitations vers un événement.

Le résultat est publié comme un événement signé par le serveur. Le client ne peut pas inventer un score final.

## Messages vocaux

Fonctions prévues :

- vitesses 0,5×, 1×, 1,5× et 2× ;
- transcription ;
- traduction ;
- sauvegarde dans les médias de conversation ;
- réactions ;
- suppression des silences ;
- aperçu de forme d’onde ;
- reprise de lecture.

La transcription et la traduction doivent indiquer qu’elles peuvent contenir des erreurs.

## Fichiers et médias

Types pris en charge :

- images ;
- vidéos ;
- audio ;
- messages vocaux ;
- documents ;
- archives ;
- liens ;
- localisation ;
- contacts ;
- cadeaux ;
- jeux ;
- défis.

Tous les fichiers binaires passent par :

- limites de taille ;
- détection de malware ;
- validation du type réel ;
- modération lorsque nécessaire ;
- stockage autoritaire ;
- URL signée et expirante.

Limites initiales :

- compte standard : 512 Mo ;
- Premium : 2 Go.

Ces limites pourront être ajustées par politique serveur sans modification du client.

## Appels

Blocs futurs :

- appels audio individuels ;
- appels vidéo individuels ;
- appels de groupe ;
- partage d’écran ;
- arrière-plan virtuel ;
- avatar en remplacement de la caméra ;
- réduction du bruit ;
- sous-titres et traduction en direct.

La signalisation, les médias et la présence d’appel doivent être séparés du stockage de messages.

## Statuts KnowMe

Les statuts personnels durent 24 heures.

Types :

- photo ;
- vidéo ;
- texte ;
- musique ;
- avatar animé.

Interactions :

- réponses privées ;
- réactions ;
- cadeaux ;
- défis ;
- liste des vues selon les préférences ;
- confidentialité par audience.

Les Stories de groupes et de chaînes utilisent un système distinct avec des durées liées au niveau et à Premium.

## Sécurité et confidentialité

- chiffrement en transit obligatoire ;
- chiffrement au repos obligatoire ;
- chiffrement de bout en bout prévu pour les discussions privées ;
- chaque fonctionnalité serveur doit déclarer sa compatibilité avec le chiffrement de bout en bout ;
- blocage, signalement et limitation de contact ;
- consentement pour la localisation ;
- contrôle des téléchargements automatiques ;
- options de visibilité en ligne et accusés de lecture.

## API fondation livrée

- `GET /messenger-experience/policy`.

Le transport existant reste sous `/conversations`. Les prochains blocs feront évoluer les modèles persistants, les médias, les thèmes, les statuts, les appels et les événements structurés.
