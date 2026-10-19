# KnowMe — icônes Web/Android : contrat, inventaire et suivi

**18 octobre 2026 · Issue #699 · Workstream: design**

## Demande
Reprendre **toutes les icônes** (y compris les plus discrètes), rechercher les SVG mal dessinés et produire un langage visuel proche de la précision tactile de Telegram, **sans utiliser le logo ou les dessins protégés de Telegram**. En particulier : Web, APK, Light/Dark/AMOLED, FR/EN, gestes et reduced motion.

## État de cette PR (ne pas confondre avec la livraison)
- [x] Nouvelle bibliothèque Web de pictogrammes originaux, géométrie 24 × 24, silhouette nette, stroke 1.9 et variante active.
- [x] Navigation principale Web, menus rapides du profil et feuille de partage convertis vers cette bibliothèque.
- [x] Feedback au toucher Web couvrant les SVG de vrais contrôles, y compris les SVG inline historiques ; désactivation automatique des animations si l'appareil ou la préférence KnowMe le demande.
- [x] Android : icône **Paramètres** auparavant remplacée par un carré générique et téléphone retouchés, micro-interaction `PressScale` normalisée, reduced motion OS via abonnement partagé.
- [x] Script local d'inventaire `node scripts/audit-knowme-svg.mjs` pour explorer toutes les balises SVG du Web, d'Android et des packages.
- [ ] Revue des **silhouettes** de chaque SVG inline historique ; un style CSS commun n'est pas une correction individuelle des tracés.
- [ ] Conversion complète des icônes natives Android dessinées en `View` vers des tracés SVG : nécessite `react-native-svg` Expo SDK 53, une mise à jour fiable du lockfile et un nouveau build natif.
- [ ] Captures Light/Dark/AMOLED, comparaison chaque écran Web/Android avec la référence, vérification du toucher 44/48 px sur appareil.
- [ ] Validation TS/CI finale, fusion, déploiement Web et compilation/signature APK.

## Audit des fichiers
Au début de ce lot, l'arbre GitHub répertoriait **231 fichiers TSX/JSX** sous `apps/web` et `apps/mobile`, et **deux fichiers SVG autonomes** :
- `apps/web/public/brand/knowme-logo.svg` — identité à préserver.
- `apps/web/public/chat-pattern.svg` — motif, pas un bouton.

Les SVG en ligne se trouvent notamment dans la messagerie, les profils, les chaînes, les stories, les réels, la boutique, les badges et les actions des publications. L'audit doit passer sur la totalité du code et ne pas confondre les illustrations, les badges, les contrôles et les éléments d'état.

## Contrat visuel
- 24 × 24 de base ; 18–20 secondaires, 22–24 commandes, 26–28 actions majeures.
- Style outline, stroke 1.8–2.1, caps et joins arrondis ; plein pour sélection ou état critique.
- Même alignement optique, centre de gravité et contraste en thèmes clair/sombre/AMOLED.
- Feedback press 95–160 ms, retour neutre après libération, pas de pulsation continue.
- Réduction des animations du système, préférence KnowMe, focus clavier, aria-label et image décorative masquée.
- Revoir avant fusion les boutons dont la zone effective est plus petite que 44/48 px ; **ne pas** grossir tous les dessins pour corriger la cible tactile.

## Non-régression et intégration
Fichiers principaux : `apps/web/components/knowme-glyph.tsx`, `bottom-navigation.tsx`, `avatar-quick-actions.tsx`, `post-share-sheet.tsx`, `apps/web/app/iconography.css`, `apps/mobile/src/ui/KnowMeUI.tsx`.
Tests ciblés : `pnpm --filter @knowme/web test`, `pnpm --filter @knowme/web build`, `pnpm --filter @knowme/mobile build`, plus audit manuel sur appareils.
Ne pas éditer les contrats métier d'autres PR ni déclarer cette demande achevée tant que les SVG de tous les écrans et les icônes natives n'ont pas été contrôlés. Pas de publication depuis cette branche.

**Rollback :** revert de cette PR, puis suppression de l'import CSS global, ce qui restaure immédiatement la navigation et les glyphes antérieurs.

## Inventaire source vérifié en CI

Le run GitHub Actions `CI #39148793538` au commit `42209abe0166518602995d26d1b4744b0cff620b` était **réussi** : le premier audit y a traité **398 fichiers**, trouvé **96 occurrences JSX <svg>/<Svg>**, **2 SVG autonomes** et **15 alertes**. Ces alertes ne sont pas toutes des bugs d'accessibilité : certains SVG ont déjà un ancêtre `aria-hidden` et nécessitent un examen contextualisé. Le nouveau scanner, plus large, n'a pas encore été qualifié sur la dernière version au moment de ce rapport.

Autre constat : le composant natif `KnowMeIcon` déclare **31 noms**, et chacun dispose d'une branche de rendu ; **ces branches restent essentiellement dessinées avec des Views Android, pas avec de véritables chemins SVG natifs**. Les SVG purs autonomes du dépôt sont le logo KnowMe et le motif de conversation.

Les 15 emplacements signalés dans le premier audit sont :
- Marketplace : `apps/web/app/marketplace/apks/page.tsx:96`, `history/page.tsx:195,201`, `marketplace/page.tsx:260,272`.
- Stickers : `apps/web/app/messages/[id]/StickerPicker.tsx:369,375`.
- Réels : `apps/web/app/reels/reel-playback.tsx:166,171,195,196`.
- Réseau : `apps/web/components/network-connectivity-notice.tsx:71,75` (les glyphes ont ensuite été raccordés à l'état réel du réseau).
- Collage médias : `apps/web/components/post-media-collage.tsx:102`.
- Motif SVG : `apps/web/public/chat-pattern.svg:1` (marqué décoratif).

**Ces lignes correspondent au commit audité, et peuvent se déplacer**. Les autres domaines doivent intégrer les composants réutilisables au moment de la fusion de leurs PR, sans remplacement aveugle des icônes de lecture, de badges ou de signaux d'appel.

## Nouvelle architecture comportementale (suite de la reprise)

- `KnowMeAnimatedIcon` reçoit un état **autoritatif**, un jeton d'événement facultatif, un progrès numérique facultatif.
- `icon-motion-model.ts` teste sans React la correspondance des états : pause -> lecture, lecture -> pause, téléchargement fini -> coche, état progress -> progrès réel.
- `knowme-icon-motion.css` porte les signatures propres aux fonctions (cœur, navigation, envoi, paramètres, cloche, lecture, micro, partage, réseau, transfert), sans boucles au repos.
- `NetworkConnectivityNotice` transmet les événements `online/offline/restored` à l'icône et conserve sa réserve existante : `navigator.onLine` n'est pas une preuve de santé du backend.
- Prochain contrôle obligatoire : comparer la capture et le comportement des mêmes états dans le navigateur et sur un APK réelle ; une réussite TypeScript ne constitue pas ce contrôle.


## Lot de continuation — Android et performances des pictogrammes

Les modifications `KnowMeNativeAnimatedIcon`, `KnowMeNativeIconButton` et `native-icon-motion-model` matérialisent des états Android pilotés par les fonctionnalités plutôt que par un clic supposé réussi :

- Tailles des dessins 20–24 dp et **cibles tactiles de 48 dp** pour la nouvelle commande dédiée, sans grossir l'icône.
- Libellé d'accessibilité fourni par la fonction appelante, appui court et long distincts, états disabled/selected/busy.
- Cœur natif **rempli rouge** seulement si `selected` est réellement transmis ; un retrait de réaction doit venir des données enregistrées, jamais de l'animation elle-même.
- Démarrage d'une animation répétée sur montage si un traitement est *déjà actif*. Arrêt de la boucle après `state`, arrière-plan Android ou réduction du mouvement.
- Réduction du nombre de listeners système via le hook natif partagé. Attention : cela **ne transforme pas** les glyphes construits par `View` en chemins SVG natifs. La dépendance Expo/RN compatible et le lockfile natif restent du ressort d'Infra #698.

Côté Web : `knowme-document-visibility.ts` centralise un unique listener `visibilitychange` et coupe la lecture des animations hors écran/onglet. Les effets tactiles globaux ont été restreints à `svg[data-knowme-icon]` et `svg[data-icon-touch]` afin de ne pas écraser les transformations des graphiques, lecteurs ou progrès. La fenêtre de partage n'agrandit plus ses traits SVG à 47 px : ses icônes restent à 22 px dans un cercle de 42 px, et les cinq actions occupent un rang compact. Les boutons de fermeture traités ont une cible d'au moins 44 px.

**Coordination vérifiée :** la PR Design #743 couvre déjà `apps/mobile/src/NotificationCenterExperience.tsx` ; les pictogrammes emoji restants y ont été signalés sans écrire dans ce fichier depuis la PR #760. Les autres surfaces (Social #694, Messaging #693, Reels #695, Marketplace #697) restent à réviser lors des intégrations respectives.

**Ne pas prétendre que 100 % des SVG Android/Web sont audités ou conformes.** L'étape suivante impose l'analyse des alertes de l'inventaire enrichi, des captures comparatives et la réconciliation des PR historiques qui bloquent le garde de coordination. Les commits sur la branche ne constituent pas un APK livré.


## Lot suivant : iconographie de 75 glyphes et vérification statique plus précise

Le catalogue Web `knowme-glyph.tsx` comporte maintenant **75 noms uniques**, chacun avec des tracés SVG originaux dans le `viewBox 0 0 24 24`. Les 30 ajouts couvrent notamment copier, répondre, épingler, archiver, fichier/dossier, groupe et invitation, bouclier et certification, cadeau, horloge/calendrier, volume/coupure du son, casque, musique, arrêt et raccrochage, options, informations, alerte, aide, déconnexion, favoris, filtres, tri, localisation, traduction et réussite.

Les signatures d'animation supplémentaires distinguent confirmation, copie/fichiers, cadeau/favori et réponses/navigation ; **une animation ne confirme jamais un état serveur qui n'a pas été fourni par l'écran propriétaire**. Le partage a désormais un pictogramme de copie au repos et une coche uniquement si `navigator.clipboard.writeText` a effectivement réussi. Les boutons « créer » de menu ouvert affichent un vrai glyph `close`, et non un plus simplement pivoté ; leur lisibilité est donc conservée en mode animations réduites.

L'audit exécuté sur l'ancien HEAD validé `affe185b5a351b6b8e19cc2395c70596dbabb0e4` (run CI `39153314502`) a examiné **644 fichiers**, compté **97 SVG JSX**, **2 SVG autonomes**, **411 références à des pictogrammes natifs composés** et **0 Android VectorDrawable XML**. L'analyse brute donnait 16 avertissements, dont **4 faux positifs causés par les expressions régulières du scanner lui-même**. Ce cas a été exclu de l'inventaire et les alertes restantes sont explicitement de niveau `review` lorsque leur contexte d'accessibilité est inconnu ; `--strict` échoue seulement sur les SVG autonomes malformés ou nécessitant une revue de sécurité. Le test Web appelle dorénavant ce contrôle strict.

Les 12 alertes contextuelles restantes correspondent à des éléments SVG dans Marketplace (5), StickerPicker (2), lecteur Réels (4) et collage média (1), sous des ancêtres avec `aria-hidden` ou des boutons déjà nommés dans les extraits vérifiés. Leur migration doit se faire dans les PR fonctionnelles concernées, sans casser les commandes existantes. Les demandes de migration coordonnées ont été publiées sur les issues #693, #695 et #697.

**Limites persistantes** : ces 75 glyphes ne constituent pas 75 parcours Web/Android fonctionnellement vérifiés, et la famille `KnowMeIcon` Android reste majoritairement composée de Views plutôt que d'un moteur de chemins SVG natifs. Pas de certification visuelle sur un téléphone ni de déploiement depuis la PR #760 avant le contrôle de chevauchement GitHub et l'intégration ordonnée.


## Lot supplémentaire — contrôle tactile accessible Web/Android

- Nouveau composant `apps/web/components/knowme-icon-button.tsx` et feuille `knowme-icon-button.css` : dessin compact (20–24 px) dans une **zone interactive d'au moins 44 × 44 px**, nom vocal explicite, vrai bouton HTML, `aria-pressed` uniquement pour les actions à bascule, `aria-busy` pendant les opérations, et état désactivé. Le callback facultatif `onLongPress` est déclenché après maintien, annulé si l'utilisateur glisse de plus de 10 px ; un appui long ne doit pas émettre aussi l'action courte. Le menu contextuel fournit un chemin alternatif clavier/souris. Les labels de progression vocalisent uniquement un pourcentage numérique réel et borné.
- Les boutons « fermer » de la feuille de partage et du bandeau réseau utilisent le composant partagé sans toucher à leur logique de fermeture.
- Le bouton « + » de l'avatar a désormais une surface de **44 px** avec cercle de **34 px conservé**, un focus clavier visible et le mode mouvement réduit.
- `KnowMeAnimatedIcon` supprime les micro-animations déclenchées si l'onglet n'est pas visible ou si les réglages navigateur/KnowMe désactivent les animations ; les glyphes de partage reflètent maintenant également les états `sending` et `loading` des requêtes réelles.
- Android : les icônes-actions affichent une valeur accessible de progression `min:0, max:100, now` uniquement pendant `progress`, avec valeur bornée, et peuvent annoncer un indice d'appui long localisé fourni par l'appelant via `PressScale`. Le travail reste du ressort du domaine design ; le moteur de rendu SVG Android n'est toujours pas installé.
- Tests ajoutés aux suites ciblées Web et Android ; **le SHA exact du présent lot doit passer CI et le garde de coordination avant toute fusion**. Le contrôle de chevauchement échouait encore à l'ouverture de ce lot ; la réussite des tests de code seule ne le remplace pas.

**État** : aucun déploiement Web ni nouvelle APK signée ne peut être affirmé sur la base de cette branche de développement.


## Contrôles transverses migrés dans ce lot

**Web (catalogue désormais de 79 tracés originaux SVG)** :
- Lecteur vidéo des publications : `play/pause`, recul/avance de 10 s, `volume/volume-off` et entrée/sortie du plein écran n'utilisent plus les caractères Unicode et emojis. Les icônes reflètent `playing`, `muted`, `fullscreen` effectivement reçus du lecteur ; un seek valide déclenche seulement l'animation de sa direction. Six cibles tactiles de 44 px minimum, y compris sur écran étroit, avec tests DOM Playwright ciblés.
- Fenêtres de notification globales : pictogramme `shield` du dialogue, `warning` pour erreur, `check-circle` pour réussite, `info` pour information et bouton `close` accessible, à la place de l'astérisque décoratif et de la croix texte.
- Signalements et édition : fermeture via `KnowMeIconButton`, animation d'envoi uniquement durant le POST réel, état `refresh` lors d'un PATCH en cours, `check` hors chargement.
- Recherche/sélection de membres : puces réductibles avec SVG `close`, options alignées en lignes de hauteur 56 px plutôt qu'en grosses cartes ; `user-plus`, `check`, `lock`, `search/loading` indiquent les actions réelles sans déduire des permissions.
- Moteur d'animations : un seul `IntersectionObserver` par document surveille les pictogrammes *actifs*, désactive le mouvement hors du viewport et libère l'observateur à la dernière désinscription. Les états affichés restent corrects et la visibilité d'onglet reste prise en compte.
- Audit source : `scripts/audit-knowme-svg.mjs` relève également `legacyUnicodeControlCandidates` pour guider la suppression progressive des commandes symboliques. C'est un inventaire de candidats, non la preuve que chaque occurrence est une icône.
- E2E : tests Playwright étendus aux dimensions et glyphes des contrôles vidéo et à la navigation clavier de la fenêtre de partage. Ne pas associer artificiellement une assertion à la fenêtre d'animation de 380 ms : les actions vérifient le résultat réel.

**Android** :
- `KnowMeFeedbackProvider` utilise `KnowMeNativeAnimatedIcon` pour les messages `incoming/success/error` alimentés par un identifiant d'événement (y compris répétitions), et `KnowMeNativeIconButton` pour la fermeture sur une surface de 48 dp. L'animation d'un premier événement confirmé est possible à la création, sans animer une sélection statique.
- Cette amélioration ne prétend pas transformer `View` en SVG ; installer le renderer `react-native-svg` compatible Expo 53 / React Native 0.79, régénérer le lockfile et reconstruire l'APK natif demeure une dépendance bloquante d'Infra #698.

**Périmètre restant** : les composants métier de Messagerie #693, Social #694, Réels/Stories #695, Profils #696, Marketplace #697 conservent encore des éléments à migrer, dont les SVG historiques et les icônes Android `View`. Le garde de coordination de PR #760 reste bloqué par des branches historiques non résolues. Cette PR **n'est pas livrée sur le Web ou l'APK**.


## Vérification approfondie de la couverture design (18 octobre — lot complémentaire)

**Changements réellement présents en branche PR #760 :**

1. Des raccourcis Web du créateur utilisent maintenant des glyphes distincts (`lock`, `edit`, `refresh`, `user-plus`, `check`) pour les cas identification / édition propriétaire / vérification abonnement / suivre / déjà suivi. La bascule suit seulement les réponses persistées de l'API, et les zones d'action sont compactes (≥44 px).
2. La page des téléchargements Web identifie les réseaux (Wi‑Fi, mobile, itinérance) et catégories (photos, vidéo, audio, fichiers) par des vecteurs 16–20 px. L'indicateur de chargement et la suppression de copies locales utilisent les **vrais états** plutôt qu'une réussite présumée.
3. L'entrée KnowMe Secret sur les profils ne présente plus un gros bloc et un emoji d'espion : carte-ligne compacte, `shield` 23 px, action `send` 18 px et lien d'au moins 44 px.
4. Le sélecteur de langue Android ne montre plus une croix Unicode en zone 38 dp, mais une action `KnowMeNativeIconButton` de 48 dp. Le contrôle compact de langue mesure au moins 48 dp, l'élément choisi utilise un état de coche confirmé, et l'entête des préférences affiche un statut de synchronisation uniquement pendant l'appel.
5. Le CSS `knowme-icon-motion.css` possède désormais un mouvement de secours **à événement réel** pour chaque pictogramme (79 glyphes actuellement) et un effet continu léger pour les opérations `loading/syncing` qui n'ont pas d'animation spécialisée. Un bouton inactif n'anime jamais une tâche fictive ; les préférences d'accessibilité restent prioritaires.
6. Les chiffres « 10 » des commandes avancer/reculer sont dessinés avec `path` et `ellipse`, sans dépendre des différences de métriques entre polices Android/Web.
7. L'audit source regroupe les contrôles Unicode potentiellement non migrés par fichier et ligne, et l'option `--strict` interdit leur réapparition dans les six écrans Design déjà convertis. Les symboles dans les textes ordinaires ne doivent pas être comptés comme erreurs d'icône.

**Faits vérifiés** : la CI complète du commit `651aef784169cedd012d13c357d947232268b40a` a réussi avant cette extension. Les derniers commits doivent valider leurs propres workflows. La compilation Android de branche, même réussie, n'équivaut ni à un test sur appareil ni à une APK signée et distribuée aux utilisateurs.

**Blocages structurels restant honnêtement ouverts** : `react-native-svg` non installé sur Expo SDK 53, verrou pnpm à générer par Infra #698 ; domaines Messagerie #693, Social #694, Réels #695, Profils #696 et Marketplace #697 en PR parallèles ; garde de chevauchement GitHub non validé ; pas de preuve d'une inspection exhaustive des 24 surfaces, ni d'un nouveau déploiement Web/APK de cette branche. Ne pas effacer ces exigences de la checklist.


## Contrôle de fidélité du logo officiel — image encapsulée vs vrai SVG (19 octobre)

Le laboratoire `/design/iconography` propose désormais **une superposition pilotée par curseur 0–100 %** entre le logo officiel et son prototype redessiné en chemins SVG. À 0 %, seule l'image d'origine est visible ; à 100 %, seul le prototype vectoriel est visible. Les deux utilisent exactement le même cadrage et la même échelle, avec action au doigt, souris ou clavier (Home/End). Le mode responsive 360 px conserve une commande de hauteur ≥44 px. Des tests navigateur vérifient le déplacement du curseur et le masquage réel du calque.

Le logo officiel `apps/web/public/brand/knowme-logo.svg` contient **un PNG en base64 dans une balise `<image>`**. Ce n'est **pas** un logo entièrement vectoriel malgré son extension. Un vrai SVG dessiné avec dégradés, cercles et tracés est préparé dans `apps/web/public/brand/knowme-logo-vector-prototype.svg`, sans image intégrée. Il reste un **prototype**, car son remplacement sans contrôle visuel risquerait d'altérer l'identité de KnowMe ; la source en production reste donc inchangée.

L'audit `scripts/audit-knowme-svg.mjs --strict` détecte désormais les images raster encapsulées dans les SVG ; le logo historique est une exception **signalée** en revue (et non un silence), tandis que les nouvelles encapsulations constituent des erreurs bloquantes. Le prototype est soumis à une vérification automatique de présence de véritables tracés, sans `<image>` ni URI `data:image/`.

Enfin, `node scripts/audit-knowme-icon-parity.mjs --require-parity` est une **porte de sortie explicitement bloquante** tant que le moteur natif SVG Android, ses vrais chemins et la couverture de tous les noms Web ne sont pas au rendez-vous. L'audit ordinaire reste informatif et n'empêche pas une compilation de branche servant aux vérifications ; le succès de compilation ne vaut jamais une certification vectorielle native.

**Restant** : aval visuel du logo avant substitution, renderer `react-native-svg` réellement installé et compilé, migration du catalogue natif, correction des conflits entre branches, validation sur appareil réel et déploiement.


## Contrat source Web → Android — géométrie SVG sans approximation (19 octobre)

Nouveau générateur reproductible `scripts/export-knowme-vector-contract.mjs` : son parseur **TypeScript JSX** lit directement le composant canonique `apps/web/components/knowme-glyph.tsx` et extrait les primitives `path`, `circle`, `rect`, `ellipse`, etc. sans dupliquer 79 tracés manuellement. Pour chaque glyph, il produit les variantes **`inactive` et `active`**, le rôle d'animation issu de `knowme-glyph-motion-roles.ts`, la grille 24 × 24, et un contrat de teintes `currentColor` / `var(--bg)` à adapter à la palette Android.

`node scripts/export-knowme-vector-contract.mjs --json` affiche une représentation structurée exportable. `node --test scripts/export-knowme-vector-contract.test.mjs` vérifie les **79 entrées**, unicité, présence de géométrie, états cœur/marque-page/certification, correspondance exhaustive des rôles de motion, absence de bitmap et chiffres « 10 » indépendants des polices. Ces tests sont câblés au script `@knowme/web test` et doivent réussir sur le commit exact. Toute géométrie JSX dynamique non reconnue doit **faire échouer** la génération au lieu d'inventer un dessin.

**Important** : il s'agit maintenant d'une source vectorielle native **préparée**, pas du moteur Android exécuté. L'APK emploie toujours des icônes composées par `View` tant que la dépendance `react-native-svg` compatible Expo 53 / RN 0.79 n'a pas été installée avec le lockfile et le catalogue raccordé à un renderer natif. La documentation de compatibilité React Native indique qu'une version de la branche `15.11.x` est adaptée à RN 0.79 ; vérifier la recommandation exacte de `expo install` avant de modifier `apps/mobile/package.json`, actuellement sujet à des collisions de PR.

**Ne pas déclarer la refonte 100 % livrée** avant installation native, QA de chaque page/appareil, résolution du garde de coordination et publication Web/APK vérifiée.
