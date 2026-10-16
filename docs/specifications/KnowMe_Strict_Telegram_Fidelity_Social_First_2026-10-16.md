# KnowMe — Contrat de fidélité stricte Telegram × identité KnowMe

Date : 2026-10-16  
Statut : **objectif de production et critères de validation, pas une déclaration de livraison**.

## Décision produit non négociable

**KnowMe n'est pas une messagerie à laquelle on a ajouté quelques pages sociales.**
C'est une plateforme sociale, communautaire et créative avec messagerie native intégrée.

L'écran initial d'une session connectée est **Accueil / Fil social**, et non « Discussions ».
Les messages restent un pilier de premier rang, jamais la racine unique de l'application.
Le Web, l'APK et le backend doivent conserver les mêmes objets utilisateur et permissions.

## Références, sans compromis sur la qualité

- Telegram Web K (interface interactive et code de référence) : https://web.telegram.org/k/ ;
  source publique GPL-3.0 : https://github.com/morethanwords/tweb .
- Telegram Android : https://github.com/DrKLO/Telegram et refonte officielle du 9 février 2026 :
  https://telegram.org/blog/crafting-android-design-and-more .
- Références KnowMe **prioritaires pour les fonctions propres** :
  `docs/specifications/KnowMe_Master_UI_UX_Specification.md`,
  `docs/specifications/KnowMe_Animations_Interactions_Full_Spec.md`,
  `docs/TELEGRAM_UI_REFERENCE.md`,
  `docs/roadmap/KNOWME_MASTER_EXECUTION_ORDER_2026-10-16.md`.

**Fidélité stricte** signifie reproduire, pour les composants comparables :
position, largeur/hauteur, densité, alignements, rayons, iconographie, états, transitions,
retours, gestes, clavier, chargements, fenêtres, traitement des médias et rapidité
perçue — avec comparaison capture/vidéo et contrôle sur vraie taille d'écran.
Ne pas confondre cet objectif avec le fait de seulement choisir des couleurs « Telegram ».

**Adaptation KnowMe** : noms, marque, illustrations, badges, stickers officiels et ressources
distinctives sont originaux KnowMe ; pas d'usurpation de marque ni de reprise sauvage
du code GPL/des ressources sous licence. Les fonctionnalités supplémentaires exigées par KnowMe
ne doivent pas être supprimées pour ressembler superficiellement à Telegram.

## Architecture de navigation cible

### Six destinations principales — dans cet ordre exact

1. **Accueil** : publications, stories, découverte de contenus suivis, création rapide.
2. **Suggestions** : personnes, demandes d'amitié, communautés, créateurs.
3. **Créer** : vrai panneau d'actions contextuelles (publication, story, vidéo, chaîne, groupe, etc.).
4. **Notifications** : activités, réponses, mentions, cadeaux, invitations.
5. **Messages** : conversations privées, groupes, chaînes, Nexus AI dans les emplacements prévus.
6. **Profil** : identité, bio, couvertures, badges, publications, statistiques, paramètres.

La navigation de second niveau reste accessible sans remplacer ces six entrées :
Reels/vidéos, Marketplace (cadeaux, stickers, APK et autres objets autorisés),
jeux et défis, chaînes, communautés, recherches, favoris, téléchargements, fichiers,
portefeuille, personnalisation et Nexus AI.

### Formats d'écran

| Taille | Composition | Comportement |
| --- | --- | --- |
| Téléphone Android | écran courant plein écran + dock **six** destinations | masquage si clavier/conversation/écran immersif ; position haut liée au header, bas flottante selon préférence ; vrai retour |
| Web mobile | mêmes six destinations adaptées au viewport | pages sociales non réduites à la liste de chats, menus touch-first |
| Tablette | panneau principal et panneau contextuel quand utile | listes/lecteur/messages maîtrisés sans overlay permanent |
| Desktop large | navigation globale compacte + surface social/média au centre ; split-pane pour messages | aucune seconde barre de navigation concurrente, fenêtres et panneaux cohérents |

Le split-pane messagerie Telegram n'est utilisé que pour `/messages` ;
il ne devient ni une disposition obligatoire pour la marketplace ni la page d'accueil.
Le modèle de layout Telegram est réinterprété **écran par écran** là où le produit diffère.

## Parité écran par écran

| Surface | Exigences de qualité Telegram | Obligations propres à KnowMe |
| --- | --- | --- |
| Authentification | états, focus, feedback, validation, transitions, clavier | adresse email, 2FA, récupération, parcours sans exposer de détails techniques |
| Accueil | rythme/densité des listes, surfaces compactes, transitions fluides | stories en tête, fil de posts, éditeur dédié, commentaires, partage, mentions, médias |
| Stories | lecteur plein écran, gestes, overlays et transitions fines | médias et musique, édition, galerie native, confidentialité, stats de visionnage |
| Suggestions | recherche et listes compactes, prévisualisation sans cartes géantes | amis, invitations, recommandations, abonnements, communautés |
| Messages | liste 2 panneaux sur desktop, bulles, types média, contexte, clavier, statut | Nexus AI, notes vocales et vidéo, stickers KnowMe, profils universels |
| Profils | continuité avatar-vers-profil, identité et onglets compacts, action contextuelle | couverture, amis, médias, publications, badges, cadeaux, identité sociale |
| Chaînes/groupes | liste, rôles, médias, notifications, actions d'administration | création, découverte, publication, communauté, modération KnowMe |
| Reels/médias | viewer immersif, gestes et commandes non intrusives | fil vidéo, sons, commentaires, partage, publication multi-format |
| Marketplace | recherche, cartes compactes, préviews, confirmations | cadeaux, stickers, objets, APK, sécurité, téléchargements, avis, créateurs |
| Jeux/défis | transitions native-first, overlays contextuels, performances | XP, défis, jeux, récompenses et progression contrôlés par le serveur |
| Notifications | listes hiérarchisées et action directe | mentions, réponses, nouvelles amitiés, cadeaux, alertes KnowMe |
| Paramètres/apparence | menus, thèmes, transparence, modal, accessibilité | personnalisation Glass/Blur, badges, comportements dock, médias et sécurité |

## Protocole de validation obligatoire avant un « parfait »

1. Établir une référence datée **Telegram Web K + Telegram Android actuel**, largeur et hauteur documentées ; aligner les captures équivalentes KnowMe.
2. Construire une table de correspondance par écran/état :
   connecté, vide, chargement, erreur, hors-ligne, clavier, plein écran, fichier joint,
   modal, menu, sélection, appui long, clic droit, geste retour.
3. Mesurer les composants comparables (grille, alignement, typographie, coins,
   densité, scroll, timing). Consigner chaque écart, ne pas annoncer « fidèle » sans mesures.
4. Tester en FR/EN, clair/sombre/AMOLED, préférences blur et mouvement réduits.
5. Exécuter CI/compilation + E2E (dont deux comptes), validation accessibilité,
   Android réel (320–430 dp), Web mobile/tablette/desktop, réseau lent et retour.
6. Distinguer `demandé`, `codé`, `CI OK`, `fusionné`, `déployé`, `validé sur appareil`.
   Une PR ouverte n'est ni un déploiement ni un APK à jour.

## Interdictions

- Rediriger les nouveaux comptes vers la messagerie en guise d'accueil principal.
- Écraser le fil social au profit d'un clone de l'écran Chats.
- Remplacer des fonctionnalités KnowMe par de fausses cartes/boutons décoratifs.
- Copier nom, logo, assets, packs ou graphismes propriétaires de Telegram.
- Dire « copie parfaite », « disponible dans l'APK » ou « synchronisé » sans preuves de test.
