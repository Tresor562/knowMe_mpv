# KnowMe — Ordre d'exécution maître (16 octobre 2026)

Ce fichier traduit les exigences utilisateur, les deux cahiers maîtres et la référence
d'interaction Telegram en un ordre d'intégration concret. **Une PR, un build réussi,
un déploiement et un test sur téléphone sont quatre états distincts.**
Ne jamais remplacer un écran demandé par une maquette arbitraire, ni fusionner
une ancienne branche empilée sans lire les dépendances et le diff actuel.

## Lot 0 — Inventaire, version des sources et blocages
- Baseline au début du lot : `main=f18972bc90115369923a4ec38ae1b5d5963b0b5f`.
- 42 PR ouvertes constatées au début de cette session, de nombreuses PR sont
  des brouillons empilés sur des anciennes branches d'intégration.
- PR #588 (Message depuis profil Web/Android) fusionnée comme `8698b263`.
- PR #589 (Galerie KnowMe multi-albums Android) fusionnée comme `f18972bc`.
- PR #559 (navigation), #558 (Accueil), #561 (éditeur Web), #562–565 (galerie
  et médias) sont des sources à examiner, **pas des releases** : leur intégration
  doit respecter les dépendances, les versions Web/API/Android et l'état live.
- Réconcilier chaque livrable avec `docs/specifications/`,
  `docs/TELEGRAM_UI_REFERENCE.md`, la capture et les composants existants.

## Lot 1 — Navigation, shell et architecture UI
Priorité immédiate. Six destinations : Accueil, Suggestions, Créer,
Notifications, Messages, Profil. Dock flottant compact, animations utiles,
position haut/bas persistée, masquage par défilement, clavier, conversation,
création, page de détail et écrans immersifs. Comparaison Android/Web mobile/PC.
Ne pas ajouter les Reels/Marketplace dans le dock en supprimant ses six actions.
Aucun contrôle « mort ». Tests 320–430dp, clavier, a11y, Motion réduite, FR/EN.
PR en cours : `feat/knowme-phase1-dock-20261016`.

## Lot 2 — Accueil, éditeur de publication et stories
Fil social à la place du tableau de cartes, stories horizontales, auteur,
compositeur rapide → vraie page d'édition, confidentialité, musique, médias,
tag, lieu, audience, boutons, menu ⋯ propriétaire/visiteur, réactions, commentaires.
Story : page dédiée, choix Texte/Musique/Caméra, galerie KnowMe, éditeur et viewer.
Respecter les références écran par écran. Ne pas activer de média si l'API ne
prend pas en charge son type, sa limite, sa visibilité ou son upload complet.

## Lot 3 — Profils, amis, messagerie complète
Profil depuis avatar, nom, mention, message, publication ou partage.
Action « Message » ouvre le chat existant, sans doublon côté API.
Gérer ajout/acceptation/refus des amis, profil propre et externe, avatar +,
édition du compte. Chat continu : en-tête, timeline, pièces jointes, vraie note
vocale, commandes d'enregistrement/lecture, notes vidéo, stickers (≠ image
ordinaire), packs, emoji/GIF, réactions, appui long et actions autorisées.
Fenêtres propres à KnowMe, état clavier/retour intact.

## Lot 4 — Media, social avancé, Marketplace et Reels
Galerie native KnowMe commune partout et Fichiers pour APK/documents,
sélection multiple, vidéo/aperçu, téléchargements et reprise. Reels vertical.
Marketplace : stickers, cadeaux, apps/fichiers avec logo, screenshots, taille,
version, nb de téléchargements, sécurité, notation, avis/commentaires.
Liens profonds pour tous les objets, droits serveur au moment de l'ouverture.

## Lot 5 — Système visuel complet et fonctions transversales
Bibliothèque SVG KnowMe cohérente et animée au toucher (pas icônes Unicode),
thèmes à jetons sémantiques/geometry/wallpapers/bulles/modes jour-nuit
avec thèmes par chat, Glass Soft/Medium/Strong, fallback sans flou,
popups/sheets/confirmations propres à l'app, accessibilité, performance,
multi-compte/changement/déconnexion visible, groupes/chaînes, Nexus AI,
notifications, avatars/cadeaux et synchronisation d'états.

## Lot 6 — API, Web, Android, livraison et observation
Auditer toutes les migrations PostgreSQL et features serveur, permissions,
pipeline média et capacité de téléchargement. Comparer comportement Web mobile,
desktop et APK à la même version produit ; pas de faux « synchronisé ».
CI/build, tests E2E avec deux comptes, tests sur téléphone réel, contrôles
d'erreur/offline/permissions, captures écran et vidéo, puis merge/déploiement.
APK : respecter package, versionCode, signature privée persistante et certificat
de l'APK déjà installée ; proposer installation via le mécanisme Android
autorisé. Une mise à jour Web/OTA ne peut pas livrer un nouveau module natif.

## Règle de suivi pour chaque écran
| Champ | Contrôle |
| --- | --- |
| Source de vérité | Spécification maître + captures + règle KnowMe |
| Navigation | Destination, retour, scroll, clavier, masquage dock |
| Visuel | Dimensions, rayons, densité, icônes, clair/sombre |
| Gestes/fenêtres | Appui, long press, swipe, focus, popup ou sheet |
| Fonctionnalité | API réelle, permissions, erreur, offline |
| Validation | Test automatisé, QA visuelle, appareil réel |
| Statut | demandé / codé / CI validée / fusionné / déployé / testé |

Ne déclarer **terminée** aucune ligne dont le dernier statut obligatoire
est encore non vérifié. Prochaine tranche après Lot 1 : Lot 2, pas une
nouvelle maquette générique.
