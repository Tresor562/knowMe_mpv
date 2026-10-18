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

