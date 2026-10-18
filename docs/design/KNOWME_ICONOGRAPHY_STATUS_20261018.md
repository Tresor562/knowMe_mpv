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
