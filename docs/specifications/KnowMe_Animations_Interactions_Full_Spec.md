# KNOWME — SPÉCIFICATION ANIMATIONS, INTERACTIONS ET MÉDIAS ENRICHIS

Complément du prompt maître KnowMe.

---

# EXTENSION MAÎTRE — ANIMATIONS, SVG, EMOJIS, CADEAUX, AVATARS ET MICRO-INTERACTIONS

> Cette extension est indissociable des sections 1 à 12. Elle complète le système KnowMe pour que sa qualité ne soit pas uniquement statique : chaque composant doit avoir un comportement visuel, tactile, sonore (si activé), accessible et performant cohérent. Cette spécification définit une **cible de conception et d'implémentation**, pas une affirmation que les fonctionnalités décrites sont déjà déployées.

## 13. RÈGLE DE FIDÉLITÉ DYNAMIQUE

**Ne confonds jamais une capture d'écran fidèle avec une interface fidèle.** La fidélité doit couvrir le temps, le mouvement et les changements d'état.

Pour chaque élément interactif, analyser et documenter :

1. État initial : apparence, position, opacité, échelle, profondeur.
2. Déclencheur : tap, double-tap, appui long, geste, clavier, événement distant.
3. Début de l'animation : délai perceptible, point d'origine, anticipation éventuelle.
4. Trajectoire : translation, échelle, rotation, transformation, apparition, couleur.
5. Rythme : durée, courbe d'accélération, ressort, amortissement.
6. État intermédiaire : contenu pendant la transition, interruptions possibles.
7. État final : emplacement, focus, scroll, persistance.
8. Retour arrière : fermeture, annulation, geste inversé.
9. Variantes : thème clair/sombre, téléphone/PC, bas débit, réduction du mouvement.
10. Cas d'échec : erreur réseau, refus de permission, média introuvable, perte de connexion.

La référence prioritaire est la version **effectivement capturée** de Telegram Android pour le mobile, puis Telegram Web/Desktop pour le grand écran. La refonte Android introduite en février 2026 comporte notamment une navigation inférieure ; éviter de mélanger des captures provenant d'anciennes versions avec des écrans récents. Les différences de plateforme doivent être respectées, pas gommées artificiellement.

Pour les éléments de marque, créations artistiques, cadeaux, badges, packs d'emojis et illustrations, produire des ressources **originales KnowMe** : reproduire la maturité de l'expérience, non les œuvres graphiques propriétaires de Telegram.

## 14. SYSTÈME UNIFIÉ DES RESSOURCES ANIMÉES

Créer une bibliothèque centralisée de médias animés, avec manifestes de ressources et variantes par plateforme :

| Ressource | Usage prioritaire | Règles |
|---|---|---|
| SVG statique | Icônes, badges, formes, états | `viewBox` cohérent, accessible, s'adapte au thème |
| SVG animé / CSS / Web Animations API | Morphing léger, rotation, tracés, états des boutons | Respecter `prefers-reduced-motion`; pas de scripts dans les SVG importés |
| Lottie JSON | Effets vectoriels riches, onboarding, cadeaux, succès, mascottes | Renderer adapté web/mobile, lecture pilotable, fallback statique |
| TGS / Lottie Telegram-compatible | Import de stickers ou emojis animés sous droits et consentement appropriés | Décompression et lecteur compatibles; ne pas présumer qu'un TGS s'affiche directement dans `<img>` |
| WebM/VP9 avec alpha | Stickers/émoticônes vidéo et effets courts | Vérifier codec et prise en charge navigateur; fallback vidéo/image |
| GIF / WebP / AVIF animés | Contenus utilisateurs et previews | Miniature, lecture maîtrisée, formats négociés par capacité |
| MP4 / WebM / autres vidéos | Vidéos de profil, stories, couvertures, contenus sociaux | Poster, chargement progressif, préchargement limité, autoplay sans son si autorisé |
| Canvas / WebGL / Rive | Effets complexes facultatifs, 3D/particules/cadeaux | Exécution conditionnelle, budget GPU, solution 2D de repli |

Précision technique : les spécifications **Telegram** des stickers animés TGS prévoient notamment Lottie, toile 512×512, animation en boucle d'au plus 3 s et 60 FPS ; les stickers vidéo sont au format WebM/VP9, d'au plus 3 s, jusqu'à 30 FPS. Ce sont des spécifications de **compatibilité Telegram**, non une obligation d'imposer ces limites à tous les médias originaux de KnowMe.

Créer une interface composant commune, par exemple `AnimatedAsset`, permettant : `assetId`, `kind`, `autoplay`, `loop`, `trigger`, `speed`, `size`, `themeVariant`, `reducedMotionFallback`, `poster`, `ariaLabel`, `priority`, `pauseWhenHidden`, `onComplete`, `onError`.

Chaque fichier animé doit posséder : identifiant stable, auteur/licence, durée, taille, dimensions, type MIME, variantes de thème, miniature statique et version basse consommation. Pas de ressources muettes ou de chemins hardcodés répartis dans les pages.

## 15. SVG, ICÔNES ET BOUTONS ANIMÉS — TOUS LES DÉTAILS

**Les icônes fonctionnelles ne sont pas des emojis Unicode placés au hasard.** Construire une bibliothèque SVG originale, cohérente dans ses contours, épaisseurs de trait, caps, alignements optiques et états actifs.

Catégories obligatoires :

- Navigation : discussions, groupes, canaux, stories, recherche, publications, appels, paramètres, profil, précédent, suivant, retour, fermer, menu.
- Messagerie : envoyer, joindre, micro, caméra, verrouillage d'enregistrement, émojis, GIF, autocollants, note vidéo, réponse, transfert, éditer, copier, épingler, traduire, signaler, supprimer.
- Médias : lecture/pause, boucle, vitesse, volume, muet, plein écran, PIP, téléchargement, téléversement, réessayer, annuler, partager, enregistrer.
- Social : aimer, suivre, commenter, partager, enregistrer, afficher plus, notifications, confidentialité, réactions, XP, badges, cadeaux.
- Gestion : ajouter membre, rôle admin, permissions, sécurité, verrou, minuterie, connexion, déconnexion, synchronisation.

Animer précisément les transitions d'états :

- Hamburger → fermer, loupe → champ ouvert, flèche retour → retour effectif.
- Micro → enregistrement, micro → envoyer lorsque du texte est saisi, lecture ↔ pause.
- Cœur non sélectionné → favori, cloche → notifications silencieuses, signet → enregistré.
- Plus → panneau d'actions, chevron → menu replié/déplié, chargement → succès/échec.
- Bouton de suppression → confirmation puis disparition réelle si la suppression réussit.

Pour chaque icône, définir tailles, hitbox minimale adaptée au tactile (44–48 px), couleurs de repos/activation/désactivation, alignement, feedback, focus clavier et description accessible. Éviter les vibrations et rotations automatiques décoratives permanentes.

**À capturer :** menu latéral/inférieur, ouvertures d'actions, icônes actives, changements d'onglets, champ d'écriture vide puis rempli, appuis longs et changements d'état sur Telegram.

## 16. EMOJIS ANIMÉS, EMOJIS PERSONNALISÉS ET INTERACTIFS

KnowMe doit posséder un véritable système d'emojis enrichis et pas seulement afficher la police emoji du téléphone.

Prévoir les comportements distincts :

1. **Emoji Unicode ordinaire** : affichage natif, cohérent avec le système et accessible en texte.
2. **Emoji isolé animé** : un emoji seul peut être présenté plus grand avec une animation appropriée lorsqu'elle existe.
3. **Emoji animé en ligne** : animation courte intégrée dans une phrase, sans désaligner sa ligne ni déplacer le texte.
4. **Emoji personnalisé** : identifiant de ressource, shortcode, pack, recherche, favoris, historique, autorisations.
5. **Emoji interactif** : tap → effet plus grand ou plein écran, éventuellement partagé avec le destinataire si un protocole de synchronisation est implémenté.
6. **Statut emoji animé** : près du nom dans liste de discussions, profil, groupes et commentaires ; durée paramétrable.
7. **Emoji dans la bio, les titres et les légendes** : taille et baseline adaptées au contexte.
8. **Emoji dans les réactions** : apparition, rebond, substitution, compteur, annulation de sa propre réaction.
9. **Emoji du clavier** : clavier avec catégories, recherche, récemment utilisés, favoris, zoom de prévisualisation à l'appui long.
10. **Emoji dans la composition et l'édition** : conservation du contenu au collage, à la copie, au transfert et dans l'historique des modifications.

Reproduire les règles d'intention : tap court, appui long, aperçu, insertion, envoi, remplacement, retour clavier. Les animations ne doivent pas faire « sauter » les lignes ou changer la hauteur de bulle de manière instable.

Offrir le contrôle de lecture automatique, les options de réductions des effets et des miniatures statiques. **Pour la synchronisation à distance**, transporter un identifiant d'effet et son horodatage logique plutôt que des captures d'écran ; garantir un affichage correct quand l'autre appareil ne prend pas en charge cet effet.

**À filmer :** emoji seul qui s'anime, emoji dans un texte, ouverture du clavier emoji, appui long sur un emoji, statut à côté du nom, effets emoji sur une conversation privée, activation/désactivation des animations.

## 17. STICKERS STATIQUES, ANIMÉS, VIDÉO, GIF ET PACKS

Créer une médiathèque unifiée, avec sous-onglets ou segmentation respectant le comportement du client de référence :

- Stickers statiques, stickers vectoriels animés, stickers vidéo transparents, GIF.
- Recherche textuelle, par emoji, tags et catégories ; favoris et récents.
- Création, prévisualisation, renommage et gestion des packs originaux KnowMe.
- Ouverture d'un pack depuis un sticker reçu, aperçu du pack, ajout/retrait, partage et signalement.
- Préchargement léger des premiers éléments visibles ; lecture différée des autres.
- Aperçu agrandi par appui long, navigation sans lever le doigt si cette interaction est retenue.
- Animation d'insertion depuis le sélecteur vers la bulle, avec prise en compte de la position finale.
- Prévisualisation hors ligne, fallback statique si codec non compatible.
- Attribution du crédit et contrôle des droits pour les créations des utilisateurs.

Chaque pack contient un ID, un propriétaire, une liste d'assets, des aperçus, des mots-clés, des variantes linguistiques, des paramètres de partage et des règles de modération. Les GIF s'affichent sans audio par défaut ; éviter de déclencher simultanément des dizaines d'animations hors écran.

**À filmer :** panneau stickers/GIF, ouverture d'un pack, aperçu appui long, envoi, réaction aux stickers, intégration de sticker dans une story, création et modification d'un pack.

## 18. CADEAUX ANIMÉS, COLLECTIONS, PRÉSENTATION ET EFFETS SPÉCIAUX

KnowMe doit pouvoir proposer un système de cadeaux numériques animé, cohérent dans les discussions, profils et pages sociales. Les fonctionnalités marchandes éventuelles ne sont à activer que lorsqu'un backend transactionnel et un cadre de paiement adéquats existent.

### 18.1 Catalogue et choix du cadeau

- Accès « Offrir un cadeau » depuis profil, conversation et actions autorisées d'une chaîne.
- Boutique/catalogue de cadeaux avec catégories, aperçus animés, disponibilité, prix affiché **seulement si réel**, variantes et filtres.
- Preview du cadeau sur fond adapté au thème ; animation au tap, en survol au bureau ou au moment de l'ouverture.
- Possibilité d'ajouter un message, choisir un destinataire, vérifier les informations, confirmer ou annuler.
- Désactivation claire de l'action de paiement lorsque les conditions de paiement ne sont pas remplies.

### 18.2 Séquence d'envoi et de réception

Définir une chorégraphie cohérente : sélection → confirmation → envoi avec progression → arrivée dans la conversation → ouverture par le destinataire → présentation finale. Exemple de cible artistique originale KnowMe : boîte qui s'ouvre, rubans, lumière diffuse, particules, révélation du cadeau, état « reçu » ; contrôler la durée et ne jamais bloquer la navigation.

- État pendant transport, erreurs, réessai sans double achat/envoi.
- Effet visuel synchronisé facultatif sur les appareils capables de l'afficher.
- Son et vibration optionnels, contrôlés par les préférences système.
- Accessibilité : description textuelle et bouton pour passer l'animation.

### 18.3 Collections et profil

- Onglet **Cadeaux** sur profil, collection personnelle, historique, filtres et tri.
- Cadeaux épinglés/mis en avant ; vue détaillée et animation en grand format.
- Ajout à un profil, affichage public ou privé, retrait de la vitrine, partage en story.
- Cadre/avatar ou statut visuel lié à certains cadeaux si KnowMe définit cette fonctionnalité.
- Série, variante, couleur, rareté et numéro unique uniquement si stockés réellement ; aucun faux rang ni fausse rareté.
- Collections limitées, édition spéciale, progression, niveaux ou fabrication/fusion **en tant que fonctionnalités à concevoir**, pas comme des capacités déjà présentes.

### 18.4 Conservation, transfert et sécurité

Modèle de données : `gift_definition`, `gift_variant`, `gift_instance`, `gift_owner`, `gift_transaction`, `gift_animation`, `gift_visibility`, `gift_history` ; stockage et audit fiables. Opérations atomiques, clés d'idempotence, contrôle du propriétaire, vérification du prix au serveur, validation de la réception, anti-double-envoi. Les cadeaux payants exigent un système de paiement conforme et des conditions d'âge/locales adaptées ; ne pas copier l'économie interne Telegram ni supposer l'existence de Stars sur KnowMe.

**À filmer :** ouverture du catalogue, prévisualisation, sélection, envoi, réception, déballage, onglet Cadeaux du profil, mise en avant et retrait, cadeau en story, cadeau comme statut (si visible dans la version de référence).

## 19. AVATARS, PHOTOS DE PROFIL, VIDÉOS DE PROFIL ET CADRES ANIMÉS

### 19.1 Avatar ordinaire

- Avatars parfaitement circulaires et nets, avec cadrage et taille appropriés à chaque emplacement.
- Initiales en fallback avec couleurs cohérentes ; taille et recadrage adaptés.
- Mise à jour immédiate après succès d'upload ; rollback en cas d'échec.
- Skeleton subtil, placeholder et aperçu local pendant le transfert.
- Variantes dans les listes, les messages, les appels, les stories, le profil et les notifications.

### 19.2 Avatar vidéo / animé

- Possibilité de sélectionner une vidéo locale si la fonctionnalité est implémentée.
- Édition : cadrer, réduire, couper, choisir l'image poster et contrôler le son.
- Lecture discrète dans la vue du profil lorsqu'elle est visible ; image poster dans les listes pour préserver performances et données.
- Pauser hors écran, en mode économie d'énergie et sous `prefers-reduced-motion`.
- Préserver les proportions, le masque circulaire, la netteté et le comportement du zoom.

### 19.3 Cadres, badges, statuts et décorations

- Anneaux de story : cercle coloré selon non-vu/vu/ami proche ou logique de confidentialité propre à KnowMe.
- Statut en ligne : point discret n'interférant pas avec le bouton « + ».
- Statut emoji animé : séparé de la photo, à une position hiérarchiquement cohérente.
- Cadres décoratifs optionnels autour de l'avatar, conditionnés par préférence et charge de rendu.
- Badge vérifié / badges XP / décorations : styles KnowMe originaux, jamais fausse certification.

### 19.4 Raccourci « + » sur l'avatar (EXIGENCE KNOWME)

Lorsqu'on voit son avatar, positionner un petit bouton **+ en bas à droite**, visuellement superposé mais sans masquer le visage.

Au tap, ouvrir une feuille d'actions compacte et lisible proposant selon les droits et le contexte :

1. Ajouter une story.
2. Voir la photo de profil.
3. Modifier la photo / choisir dans la galerie.
4. Enregistrer une vidéo de profil (si pris en charge).
5. Modifier la couverture.
6. Consulter les photos précédentes (si disponibles).
7. Personnaliser les cadres / l'avatar (si disponible).
8. Retirer la photo, avec confirmation.

Ouverture : courte transition depuis l'avatar ou feuille d'actions inférieure ; fermeture par swipe bas, tap extérieur, touche Échap ou retour ; focus restauré au déclencheur. Sur les profils d'autrui, adapter les options (« voir », « envoyer un message », « offrir un cadeau », etc.) et ne jamais afficher des actions réservées au propriétaire.

**À filmer :** profil, avatar en liste, zoom photo, édition, upload photo/vidéo, statut, anneau de story, fermeture et ouverture du menu d'avatar, passage écran profil → média plein écran.

## 20. STORIES, VIDÉOS, COUVERTURES ET EFFETS SUR MÉDIAS

Chaque story et chaque média doit avoir une vraie grammaire animée :

- Story : anneau de progression, préchargement, tap précédent/suivant, swipe vers autre auteur, pause lors de l'appui long, réponse et réaction, sortie par geste.
- Transition entre avatar/story et lecteur plein écran avec point d'origine cohérent ; restauration au retour.
- Story éditeur : changement de média, texte, police, positionnement, rotation/pinch-to-zoom, stickers, emojis animés, musique autorisée, aperçu, confidentialité et publication.
- Publications sociales : carrousel photo, vidéo verticale, lecteur intégré, double-tap réaction (si retenu), partage, menus, spoiler, affichage des commentaires.
- Couverture de profil : recadrage, déplacement/zoom, aperçu responsive, upload avec progression, mise en page correcte sous avatar/titres.
- Vidéos : chargement progressif, lecture, pause, mute/unmute, miniatures, scrub, plein écran, PIP lorsque disponible.
- Médias dans messages : miniatures, ouverture grand écran, navigation entre pièces jointes, transition retour, fichier original et actions de téléchargement.
- Visualisation en faible réseau : placeholders, chargement progressif, poster statique, reprise et traitement fiable des erreurs.

Définir la règle de lecture automatique selon la préférence de l'utilisateur et le contexte (visibilité, réseau, économie d'énergie). Une vidéo de couverture ne doit pas démarrer avec le son sans action explicite.

## 21. MESSAGES, RÉACTIONS, ÉCRITURE ET EFFETS DE CONVERSATION

Construire et documenter l'animation de chaque événement :

| Interaction | Comportement attendu à concevoir |
|---|---|
| Envoi de texte | Champ → bulle, insertion, retour du composeur, indicateur d'envoi |
| Réception | Apparition subtile sans saut de scroll, badge non lu adapté |
| Modification | Texte mis à jour sans reflow brusque, état modifié |
| Suppression | Retrait ou tombstone cohérent après confirmation serveur |
| Réaction | Tap → apparition/rebond, compteur mis à jour, retrait animé |
| Grand effet | Particules ou animation plein écran ciblée, désactivable |
| Réponse | Swipe ou menu → citation dans le composeur, envoi avec lien vers l'original |
| Transfert | Panneau destinataire → confirmation → statut d'envoi |
| Épinglage | Bannière compacte, transition de la position au bandeau |
| Message vocal | Micro maintenu, verrouillage, onde audio, chronomètre, envoyer/annuler |
| Note vidéo | Cercle caméra, aperçu, décompte, enregistrement, bulle vidéo circulaire |
| Fichier lourd | Chargement, pourcentage, pause/reprise si backend compatible, retry fiable |
| Réponse clavier | Champ qui s'adapte au clavier sans écraser l'historique |
| Lecture | État envoyé/reçu/lu, synchronisation multi-appareils lorsque backend connecté |
| Spoiler | Masquage initial, révélation localisée sans casser l'accessibilité |
| Saisie distante | Typing indicator temporaire synchronisé et supprimé en cas de déconnexion |

Envisager les effets Telegram de « message avec effet » : appui long sur la flèche d'envoi → choix d'effet → envoi d'une référence à l'effet → lecture à la première ouverture du chat, avec fallback textuel et option pour rejouer. Les animations doivent être réservées aux situations justifiées : ne pas transformer toutes les discussions en feu d'artifice.

## 22. TRANSITIONS DE NAVIGATION, MENUS ET GESTES

Définir un langage de motion global et réutilisable :

- Entrée/sortie écran : transitions de navigation adaptées au mobile et au bureau.
- Feuille d'actions (bottom sheet) : glisser vers le haut, seuil de snap, zone de prise, fermeture par swipe bas.
- Menus contextuels : origine proche du contrôle, flou/assombrissement si approprié, fermeture externe, navigation clavier.
- Popup d'avatar : point d'ancrage clair, jamais hors écran ni sur une zone critique.
- Navigation par onglets : indicateur qui suit l'onglet, maintien du scroll et des données.
- Recherche : champ focalisé, clavier, suggestions, états de résultats, retour sans perte du contexte.
- Gestion des longues listes : virtualisation sans sauts, restauration de position, scroll inversé pour les messages.
- Appui long : délai intentionnel, retour visuel, éventuellement vibration légère si prise en charge et consentie.
- Glisser : swipe pour répondre, archiver, revenir, découvrir ou fermer selon l'écran ; ne jamais détourner les gestes système.
- Changement de langue : rafraîchissement textuel cohérent, transition discrète, pas de message affiché dans la mauvaise langue.
- Multi-fenêtre / paysage / desktop : réorganisation responsive sans éléments superposés.

Définir des valeurs de motion **mesurées à partir des vidéos de référence**. Si la mesure n'est pas possible, commencer par des objectifs de design de 100–200 ms pour micro-feedback et 200–350 ms pour transitions, puis calibrer. Ces durées sont des hypothèses de travail KnowMe, pas des valeurs officielles Telegram.

Prévoir interruption propre des animations : une navigation successive ou l'arrivée de nouveaux messages ne doit jamais laisser l'interface bloquée dans un état transitoire.

## 23. THÈMES ANIMÉS, FONDS D'ÉCRAN ET GLASS/BLUR

L'apparence doit être systémique et préserver le concept **Native First / Soft Rounded Native UI / Glass-Blur** du cahier maître :

- Palette clair / sombre / automatique, avec tokens pour texte, surfaces, accents, bulles, bordures et ombres.
- Fonds de discussion statiques ou dynamiques (gradients animés, motifs, variations de couleurs) originaux KnowMe.
- Transition de thème sans flash blanc, texte illisible ni éléments restés dans l'ancien thème.
- Blur léger/moyen/fort sur zones pertinentes et uniquement quand contraste et performances le permettent.
- Mode « Réduire la transparence » avec surfaces opaques et lisibilité préservée.
- Variantes d'effets pour OLED, économie de batterie et appareils modestes.
- Animation d'activation d'un thème : courte et cohérente ; pas de fond mouvant qui gêne la lecture.
- Cohérence entre avatar, badge, anneau de story, cadeaux, réaction et notification.
- Panneau de personnalisation : aperçu immédiat de chaque option et bouton pour rétablir les valeurs par défaut.

Les animations d'arrière-plan doivent être suspendues hors visibilité ou lorsque le système signale une préférence de réduction des mouvements.

## 24. APPELS, DIRECTS, AUDIO, MUSIQUE ET INDICATEURS VIVANTS

Inclure également :

- Sonnerie et écran d'appel entrant, avatar animé ou portrait statique, animation accepter/refuser.
- Appel en cours : minuterie, mute, haut-parleur, caméra, partage écran si disponible, qualité connexion, vue miniature/PIP.
- Appels de groupe et salons audio : grille des participants, halos de prise de parole, mains levées, réactions, changement de locuteur.
- Lecteur audio : ondes, curseur, vitesse, pause/lecture, barre de progression, mini-lecteur global.
- Musique sur profil : ligne/lecteur compact, pochette, statut pause et lecture si cette fonctionnalité est choisie.
- Diffusions en direct : badge live, compteurs mis à jour, commentaires et réactions avec limitation du débit d'affichage.
- Bots : indicateurs de saisie, boutons colorés s'ils font partie du design, états de commande, réponses différées et mini-apps.
- Réseau : indicateurs de reconnexion, offline, synchronisation, échec et restauration sans faux pourcentages.

Ne pas affirmer « appel chiffré de bout en bout » ou « diffusion en direct disponible » tant qu'une implémentation effective, testée et documentée ne le permet pas.

## 25. ANIMATIONS PROPRES À KNOWME : XP, PUBLICATIONS, BADGES ET SUCCÈS

Les fonctionnalités supplémentaires ne doivent pas être traitées comme des modules graphiquement étrangers au reste de l'application.

- **XP / niveau :** progression animée de la barre, attribution réelle, notification de montée de niveau, trophée, possibilité de réduire les effets.
- **Badges :** apparition à la validation, mise en avant discrète sur profil, expiration/retrait cohérent.
- **Fil de publications :** apparition progressive des nouveaux contenus, réaction, ajout aux favoris, commentaires, médias plein écran.
- **Abonnements :** Suivre → Abonné avec retour visuel et gestion de l'annulation/erreur.
- **Anniversaire / célébration :** confettis ponctuels, pas d'animation forcée répétée.
- **Cadeau KnowMe :** récompense/collection liée à un événement réel, pas de faux message de transaction.
- **Story sur profil :** anneau et avatar navigable, passage profil → story et retour.
- **Création :** boutons d'ajout contextuels cohérents, apparition du composeur et gestion des brouillons.

Chaque animation propre à KnowMe doit rester visuellement compatible avec la bibliothèque de transitions Telegram-like et avec la marque KnowMe.

## 26. ACCESSIBILITÉ, ÉCONOMIE DE BATTERIE, PERFORMANCE ET SÉCURITÉ

### 26.1 Accessibilité

- Prendre en charge `prefers-reduced-motion` et une préférence KnowMe « Réduire les animations ».
- Fallback statique pour tout emoji, sticker, cadeau, avatar ou fond animé.
- Bouton pour rejouer ou ignorer les effets visuels importants.
- Ne jamais communiquer une information uniquement par animation/couleur.
- Contraste, labels d'icônes, focus visible, clavier, lecteur d'écran, sous-titres/transcriptions quand applicable.
- Aucune animation clignotante rapide ou effet lumineux agressif ; prudence vis-à-vis de la photosensibilité.

### 26.2 Performance

- Viser 60 FPS sur appareils compatibles, sans promettre ce débit sur tous les appareils ; surveiller images saccadées et temps de rendu.
- Suspendre les animations hors écran ; limiter les boucles simultanées.
- Utiliser transform/opacity lorsque pertinent, éviter les recalculs coûteux de layout.
- Virtualiser longues listes de messages, stickers et cadeaux.
- Précharger seulement ce qui est utile ; lazy-load des packs et des animations.
- Budget mémoire/GPU et tailles optimisées ; image poster avant chargement complet.
- Adapter à Data Saver, batterie faible et connectivité lente.
- Cache versionné avec invalidation ; tester Android milieu de gamme, vieux appareils et desktop.

### 26.3 Sécurité et fiabilité

- Nettoyer les SVG reçus d'utilisateurs (scripts, événements, références externes, liens dangereux) avant affichage ; ne pas injecter du SVG non fiable comme HTML.
- Valider MIME réel, dimensions, durée, codecs, tailles et permissions côté serveur.
- Recoder ou isoler les vidéos/animations lorsque nécessaire ; protéger contre fichiers malformés et contenus malveillants.
- Respecter licences et créations des auteurs. Les assets Telegram non autorisés ne deviennent pas réutilisables parce qu'ils sont visibles dans l'application.
- Associer chaque message/cadeau/transaction à un identifiant stable et chaque téléchargement à un statut vérifié.
- Les upload médias doivent être réellement reliés au backend de KnowMe ; ne pas transformer un bug « validation » en simple animation cosmétique.

## 27. CE QU'IL FAUT CAPTURER ET FILMER SUR TELEGRAM

**Une capture statique ne prouve jamais le comportement d'une animation.** Constituer un dossier de références combinant images, vidéos et notes de gestes.

### 27.1 Règle de capture

- Utiliser Telegram Android **actuel** comme référence principale mobile ; préciser version et date si possible.
- Enregistrer l'écran avec le meilleur débit/fréquence disponible, idéalement 60 images/s, si l'appareil le permet.
- Faire un plan court de l'état initial → geste → effet → état final → retour.
- Conserver les deux thèmes lorsque la différence est visible ; répéter les points majeurs sur Desktop/Web.
- Retirer noms, photos, messages et identifiants privés avant partage.
- Ajouter un petit fichier `README.md` indiquant le geste déclencheur et le contexte de chaque vidéo.

### 27.2 Inventaire des références dynamiques

| Dossier de référence | Séquences à enregistrer | Priorité |
|---|---|---|
| `01-navigation` | Onglets, barres, menu, ouverture/retour, appui long | P0 |
| `02-conversations` | Envoi, réponse par swipe, réactions, suppression, épingle, clavier | P0 |
| `03-emoji` | Emoji seul, emoji interactif, pack, statut, panneau et appui long | P0 |
| `04-stickers-gifs` | Choix, agrandissement, envoi, pack, animation et GIF | P0 |
| `05-profil-avatar` | Avatar, photo/vidéo, zoom, statut, modification, transitions | P0 |
| `06-stories` | Ouverture, progression, navigation, réaction, éditeur et publication | P0 |
| `07-cadeaux` | Catalogue, preview, envoi, ouverture, profil, vitrine et statut | P1 |
| `08-themes` | Clair/sombre, couleurs, fonds, blur, changement à chaud | P0 |
| `09-fichiers-medias` | Panneau joindre, galerie, lecteur, upload, retry | P0 |
| `10-appels-vocaux` | Appel entrant, prise d'appel, contrôle, vocal, note vidéo | P1 |
| `11-groupes-canaux` | Profil, membres, rôles, réactions, menu et actions | P1 |
| `12-miniapps-bots` | Clavier bot, boutons, ouverture/fermeture mini-app | P1 |
| `13-gift-collections` | Filtres, détail, animations, collections et partage en story | P1 |
| `14-web-desktop` | Colonnes, hover, contextuel, raccourcis, fenêtres, responsive | P0 |
| `15-effets-systeme` | Loading, erreur, succès, hors-ligne, notification, recharge | P0 |

**Conseil de collecte :** commencer par 25–40 captures des écrans structurels et environ 20–35 vidéos courtes des mouvements essentiels ; élargir la bibliothèque au fur et à mesure. Ces quantités sont des objectifs pratiques, pas des limites techniques.

### 27.3 Convention de nommage

- `android_dark_chat_reaction_doubletap_01.mp4`
- `android_light_profile_avatar_open_01.mp4`
- `android_dark_gift_unbox_01.mp4`
- `android_dark_emoji_interactive_01.mp4`
- `desktop_light_sticker_panel_open_01.mp4`
- `android_dark_story_swipe_close_01.mp4`

Accompagner chaque référence de : écran de départ, geste, résultat, éventuel son/haptique, comportement au retour, conditions de test, emplacement KnowMe concerné.

## 28. CONTRÔLE QUALITÉ : CHACUNE DES ANIMATIONS DOIT ÊTRE TESTÉE

Pour chaque composant, créer des tests de comportement et des comparaisons visuelles :

- L'animation se déclenche uniquement dans le bon contexte.
- L'animation correspond bien à l'action réalisée.
- Les dimensions/positions avant et après correspondent à la référence validée.
- Aucun saut de layout, clignotement, chevauchement ou bouton inaccessible.
- Le son ne se lance pas sans consentement ni intention de l'utilisateur.
- Le retour arrière et l'interruption fonctionnent toujours.
- Le média chargé est le bon, et non un placeholder déguisé.
- Le thème clair/sombre et la traduction française/anglaise restent cohérents.
- Le même parcours fonctionne tactilement et au clavier.
- À bas débit et en échec réseau, l'état final reflète la réalité.
- Mode réduit : toutes les informations restent disponibles sans animation.
- Aucun asset ou écran ne vole la priorité à la messagerie pendant une boucle décorative.

Mesurer et documenter, lorsque possible : durée, taux d'images, nombre de frames perdues, taille des assets, temps de chargement, utilisation mémoire, réaction au scroll, stabilité des actions backend.

Les captures comparatives doivent conserver la même taille de viewport, le même thème, le même contenu de test et le même état de l'interface. Une démonstration vidéo ne remplace pas une vérification fonctionnelle du serveur.

## 29. LIVRABLES OBLIGATOIRES À PRODUIRE PAR L'IA QUI IMPLEMENTE KNOWME

Demander :

1. **Inventaire des écrans et des états** de KnowMe, incluant erreurs et chargements.
2. **Motion design system** central (tokens d'animation, durées, ressorts, seuils de gestes, reduced motion).
3. **Bibliothèque d'icônes SVG originales KnowMe**, inventaire et états.
4. **Moteur d'emojis/stickers** avec support des formats retenus et fallback.
5. **Catalogue d'effets de messages** : animation, trigger, durée, accessibilité, synchronisation éventuelle.
6. **Système d'avatars** : photo/vidéo, anneau story, statuts, bouton + contextuel, upload fiable.
7. **Spécification cadeaux** : modèle de données, animations, permissions, présentation ; paiement uniquement si réellement implémenté.
8. **Animations de navigation** communes aux pages, pas un ensemble d'effets sans cohérence.
9. **Matrice de comparaison** Référence Telegram ↔ KnowMe : capture, vidéo, différences, corrections.
10. **Tests mobiles et web** : interactions, performance, offline, accessibilité, i18n et absence de régression.
11. **Rapport de livraison vérifiable** séparant « prévu », « implémenté », « connecté », « testé » et « déployé ».

Aucune fonctionnalité n'est « terminée » tant que ses commandes, son animation, son API et ses états d'erreur ne sont pas vérifiés.

## 30. SOURCES TECHNIQUES ET VISUELLES À CONSULTER

- Documentation Telegram pour les stickers et les types de médias : https://core.telegram.org/api/stickers
- Directives Telegram TGS / WEBM : https://core.telegram.org/stickers
- Refonte Android Telegram du 9 février 2026 : https://telegram.org/blog/crafting-android-design-and-more?setln=en
- Réactions et emojis interactifs : https://telegram.org/blog/chat-themes-interactive-emoji-read-receipts
- Effets de messages : https://telegram.org/blog/message-effects-and-more?setln=en
- Vidéos de profil : https://telegram.org/blog/profile-videos-people-nearby-and-more?setln=en
- Cadeaux animés et profil : https://telegram.org/blog/gifts-verification-platform?setln=en
- Objets de collection, effets de profil et statuts : https://telegram.org/blog/wear-gifts-blockchain-and-more?setln=en
- Cadeaux et animations de fabrication : https://telegram.org/blog/crafting-android-design-and-more?setln=en
- Animations des fonds de discussion : https://telegram.org/blog/animated-backgrounds/fr

**Ne déduis pas le timing exact ou une mécanique manquante de la simple description d'un article.** Les vidéos de référence de la version cible et les tests réels sont nécessaires pour calibrer les mouvements.

---

## CLAUSE FINALE — KNOWME DOIT ÊTRE VIVANT, MAIS JAMAIS ENCOMBRÉ

L'objectif est une expérience de niveau Telegram : un langage visuel cohérent, des mouvements utiles, des médias riches, de beaux cadeaux, des avatars soignés, des réactions expressives et des performances sérieuses.

**Ne pas surcharger chaque écran d'animations permanentes.** Les meilleures micro-interactions confirment une intention, aident à comprendre un changement d'état et restent presque invisibles quand l'utilisateur ne les sollicite pas.

Chaque nouveau geste, animation ou effet doit être intégré au bon écran de KnowMe, conformément aux cahiers maîtres, sans casser les interactions existantes, sans masquer les contrôles et sans introduire de faux comportements.