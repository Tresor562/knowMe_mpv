# KnowMe — Master Product & UI/UX Specification
## Référence complète page par page

> **Statut :** Spécification maître  
> **Produit :** KnowMe — Messagerie Nextech  
> **Objectif :** Construire une application de messagerie native, mature, extrêmement fluide et cohérente, avec une qualité d’interface et d’expérience comparable aux meilleures applications de messagerie modernes, tout en conservant une identité propre à KnowMe.

---

# 0. Vision générale

KnowMe ne doit jamais être conçu comme un simple clone visuel ni comme une web app emballée dans une interface mobile.

L’objectif est de reproduire les qualités qui rendent une messagerie comme Telegram extrêmement mature :

- densité d’information maîtrisée ;
- vitesse d’accès aux actions ;
- faible friction ;
- navigation prévisible ;
- gestes naturels ;
- cohérence visuelle ;
- excellentes performances perçues ;
- transitions continues ;
- composants compacts mais tactiles ;
- grande richesse fonctionnelle sans surcharge visuelle.

KnowMe doit ensuite ajouter sa propre personnalité :

- design **Soft Rounded Native UI** ;
- surfaces Glass/Blur fonctionnelles ;
- identité graphique KnowMe ;
- accents personnalisables ;
- fonctions IA natives ;
- traduction ;
- transcription ;
- changement de voix ;
- notes vidéo ;
- groupes, chaînes, bots et mini-apps ;
- expérience cohérente Android, iOS, tablette, desktop et web.

---

# 1. Principes non négociables

## 1.1 Native First

Chaque écran doit sembler conçu pour l’appareil sur lequel il s’exécute.

Android ne doit pas sembler être un port iOS.  
iOS ne doit pas sembler être un port Android.  
Desktop ne doit pas être un mobile élargi.  
Web ne doit pas ressembler à un dashboard SaaS.

## 1.2 Zéro composant générique inutile

Interdits :

- gigantesques cartes ;
- boutons démesurés ;
- sidebars SaaS ;
- gradients décoratifs sans rôle ;
- ombres lourdes ;
- bordures partout ;
- dizaines de badges ;
- sections artificiellement enfermées dans des cards.

## 1.3 Zéro interaction morte

Tout élément qui paraît cliquable doit avoir un comportement réel.

## 1.4 Zéro écran considéré terminé uniquement parce qu’il fonctionne

Un écran n’est terminé que si :

- fonctionnalité correcte ;
- UI correcte ;
- interactions correctes ;
- animations correctes ;
- états complets ;
- responsive correct ;
- performance correcte ;
- accessibilité correcte ;
- comparaison visuelle acceptable.

## 1.5 Densité maîtrisée

KnowMe doit afficher beaucoup d’informations sans devenir lourd.

Les surfaces doivent être compactes, les espacements cohérents et les éléments secondaires moins contrastés.

---

# 2. Design System global

## 2.1 Grille d’espacement

Unité de base : **4 px**

Valeurs principales :

- 4 px — micro-gap ;
- 8 px — petit espacement ;
- 12 px — espace compact ;
- 16 px — espace standard ;
- 20 px — moyen ;
- 24 px — grand ;
- 32 px — séparation importante ;
- 40/48 px — seulement pour sections majeures.

Aucune valeur arbitraire sans raison.

## 2.2 Rayons

- petits éléments : 10–14 px ;
- surfaces secondaires : 16–20 px ;
- cartes fonctionnelles : 20–26 px ;
- champs : 24–30 px ;
- gros panneaux : 26–32 px ;
- capsule : 999 px ;
- avatars : cercle parfait.

## 2.3 Zones tactiles

Même si une icône mesure 22 px, la zone tactile doit être au moins :

- 44 × 44 px sur iOS ;
- 48 × 48 px recommandé sur Android.

## 2.4 Iconographie

Un seul langage :

- outline ;
- stroke régulier ;
- arrondi discret ;
- monochrome ;
- filled uniquement pour état actif ou critique.

Tailles :

- secondaire : 18–20 px ;
- standard : 22–24 px ;
- importante : 26–28 px ;
- exceptionnelle : 30–32 px.

## 2.5 Typographie

Éviter de multiplier les graisses.

Utiliser essentiellement :

- Regular ;
- Medium ;
- Semibold.

Hiérarchie indicative :

- titre d’écran : 20–24 px ;
- nom chat : 16–17 px ;
- message : 15–16 px ;
- preview : 14–15 px ;
- meta : 11–13 px ;
- bouton : 14–16 px.

## 2.6 Glass System

### Glass Soft

Pour :

- petits indicateurs ;
- séparateurs de date ;
- mini-actions flottantes ;
- boutons de retour contextuels.

### Glass Medium

Pour :

- composer ;
- navigation flottante ;
- menus intermédiaires ;
- panneaux de réaction.

### Glass Strong

Pour :

- menus contextuels ;
- contrôles d’appel ;
- modales ;
- overlays importants.

Chaque niveau définit :

- opacité ;
- blur ;
- bord subtil ;
- contraste ;
- ombre ;
- fallback sans blur.

## 2.7 Thèmes

Minimum :

- Light ;
- Dark ;
- AMOLED.

Chaque thème possède ses propres tokens pour :

- background ;
- surface ;
- elevated surface ;
- glass ;
- texte principal ;
- texte secondaire ;
- séparateur ;
- message entrant ;
- message sortant ;
- panneau ;
- état sélectionné ;
- état pressé ;
- overlay ;
- accent.

Le mode sombre n’est jamais une inversion automatique.

## 2.8 Accent utilisateur

L’accent KnowMe pilote :

- CTA ;
- liens ;
- sélection ;
- messages sortants ;
- switches ;
- progression ;
- onglets actifs ;
- éléments interactifs.

L’accent ne doit pas repeindre toute l’application.

## 2.9 Motion System

### Micro interaction
100–160 ms

### Interaction standard
160–220 ms

### Navigation
220–320 ms

### Shared transition
250–400 ms

### Spring
Pour les éléments attachés au geste, menus, réactions et feedback physique.

## 2.10 Haptique

Utiliser uniquement pour :

- seuil de swipe ;
- début/fin enregistrement ;
- lock vocal ;
- sélection ;
- réaction ;
- erreur critique ;
- actions destructrices confirmées.

---

# 3. Architecture principale

## Mobile

Navigation principale possible :

- Chats ;
- Contacts ;
- Calls ;
- Discover/Channels selon produit ;
- Settings/Profile.

La navigation doit rester compacte et ne jamais manger inutilement la hauteur.

## Tablette

Disposition typique :

- panneau navigation ;
- liste chats ;
- conversation.

## Desktop

Disposition typique :

- navigation principale ;
- liste des conversations ;
- conversation ;
- panneau contextuel optionnel.

## Wide Desktop

Possibilité d’avoir :

- navigation ;
- conversations ;
- chat ;
- profil/détails.

---

# 4. Splash / démarrage

## Objectif

Donner une impression de vitesse et de qualité dès le premier frame.

## Contenu

- logo KnowMe ;
- fond adapté au thème système ;
- éventuelle micro-animation propriétaire.

## Règles

- très courte ;
- pas de vidéo lourde ;
- pas d’attente artificielle ;
- disparaît dès que le shell principal est prêt ;
- doit fonctionner offline.

## États

- démarrage normal ;
- migration de base locale ;
- restauration de session ;
- mise à jour critique ;
- erreur locale rare.

---

# 5. Onboarding

## Objectif

Expliquer KnowMe sans imposer 8 écrans marketing inutiles.

## Pages possibles

1. Bienvenue.
2. Confidentialité / sécurité.
3. Synchronisation multi-appareils.
4. Fonctions IA facultatives.
5. Personnalisation rapide.

## UI

- illustration légère ;
- texte court ;
- CTA principal ;
- bouton secondaire ;
- indicateur discret si plusieurs pages.

## Gestes

- swipe horizontal ;
- bouton continuer ;
- skip.

## Cas à prévoir

- utilisateur venant d’une invitation ;
- utilisateur venant d’un lien de groupe ;
- utilisateur venant d’un deep link ;
- reprise après fermeture.

---

# 6. Connexion / création de compte

## Méthodes possibles

- numéro de téléphone ;
- e-mail ;
- passkey ;
- compte existant ;
- QR depuis appareil connecté.

## Page numéro / e-mail

Composants :

- indicatif pays ;
- champ ;
- validation ;
- clavier adapté ;
- CTA continuer.

## États

- numéro invalide ;
- serveur inaccessible ;
- rate limit ;
- numéro déjà utilisé ;
- pays non supporté ;
- réseau absent.

## UX

Validation instantanée sans popup agressive.

---

# 7. Code de vérification

## Composants

- code 5/6 chiffres ;
- auto-focus ;
- paste automatique ;
- lecture SMS automatique si autorisée ;
- timer resend ;
- méthode alternative.

## États

- code incorrect ;
- expiré ;
- trop d’essais ;
- appel vocal disponible ;
- code reçu sur autre appareil.

## Animation

Chaque chiffre peut apparaître avec une micro-transition, sans exagération.

---

# 8. Mot de passe / 2FA / Passkey

## Cas

- compte sans 2FA ;
- compte avec mot de passe ;
- passkey ;
- biométrie locale ;
- recovery code.

## Page

- champ protégé ;
- afficher/masquer ;
- aide ;
- récupération.

## Sécurité UI

Ne jamais afficher de secrets en clair par défaut.

---

# 9. Configuration initiale du profil

## Champs

- photo ;
- nom ;
- username ;
- bio courte ;
- prononciation éventuelle ;
- préférences de découverte.

## Avatar

- appareil photo ;
- galerie ;
- avatar généré ;
- initiales.

## Contraintes

- preview instantanée ;
- compression correcte ;
- crop circulaire.

---

# 10. Permissions système

Demander uniquement au moment utile.

Permissions possibles :

- notifications ;
- contacts ;
- micro ;
- caméra ;
- photos ;
- localisation ;
- Bluetooth si appels/accessoires ;
- stockage selon plateforme.

Chaque demande doit expliquer la valeur utilisateur.

---

# 11. Page principale — Chats

C’est la page la plus fréquemment utilisée.

## Header

Éléments possibles :

- avatar utilisateur ;
- titre KnowMe ou dossier courant ;
- recherche ;
- nouveau message ;
- menu.

## Liste des chats

Chaque ligne affiche :

- avatar ;
- nom ;
- dernier message ;
- heure ;
- badge unread ;
- muted ;
- pinned ;
- état message ;
- typing ;
- draft ;
- mention ;
- réaction ;
- média.

## Densité

La hauteur doit être proche d’une messagerie native mature.

Pas de ligne de 100+ px sans raison.

## État unread

Différenciation par :

- poids du nom ;
- badge ;
- contraste preview.

## État muted

Badge ou icône discrète.

## État draft

Exemple :

`Draft · On se retrouve à...`

## État typing

Remplace temporairement le dernier message.

---

# 12. Swipe sur une conversation

Actions possibles :

- lu/non lu ;
- pin/unpin ;
- mute/unmute ;
- archive ;
- delete.

## Gestuelle

- interaction 1:1 avec le doigt ;
- résistance ;
- seuil ;
- haptic ;
- retour animé.

## Accessibilité

Les mêmes actions doivent exister via menu.

---

# 13. Sélection multiple des conversations

Activation :

- long press ;
- menu desktop ;
- raccourci clavier.

Header temporaire :

- fermer ;
- nombre sélectionné ;
- archive ;
- mute ;
- delete ;
- more.

---

# 14. Dossiers / filtres

Filtres natifs possibles :

- All ;
- Unread ;
- Personal ;
- Groups ;
- Channels ;
- Bots ;
- Work ;
- Custom.

## Interactions

- swipe horizontal ;
- tap ;
- réorganisation ;
- création ;
- mute spécifique ;
- exclusions.

---

# 15. Archive

## Comportement

- accessible depuis haut de liste ou dossier ;
- option pour garder les chats archivés ;
- unread peut réapparaître selon réglage.

## UI

Doit rester compacte.

---

# 16. Recherche globale

Recherche dans :

- personnes ;
- conversations ;
- messages ;
- groupes ;
- chaînes ;
- fichiers ;
- liens ;
- médias ;
- bots.

## États

- historique de recherche ;
- suggestions ;
- résultats locaux instantanés ;
- résultats réseau progressifs ;
- aucun résultat ;
- erreur réseau.

## Performance

Debounce court.  
Recherche locale d’abord.  
Serveur ensuite.

---

# 17. Nouveau message

## Page / sheet

Sections :

- recherche ;
- contacts récents ;
- nouveau groupe ;
- nouvelle chaîne ;
- nouveau chat privé/secret si prévu ;
- invite contact.

## Actions rapides

Compactes, pas en cartes énormes.

---

# 18. Contacts

## Liste

- favoris ;
- récents ;
- tous les contacts ;
- utilisateurs KnowMe ;
- invitations.

## Ligne contact

- avatar ;
- nom ;
- statut ;
- username éventuel.

## Actions

- message ;
- appel ;
- profil ;
- invitation.

## États

- permission contacts refusée ;
- aucun contact ;
- sync en cours.

---

# 19. Invitations

Possibilités :

- SMS ;
- lien ;
- QR ;
- partage système.

Prévisualisation claire avant partage.

---

# 20. Écran Chat — structure générale

Trois zones :

1. Header.
2. Timeline.
3. Composer.

L’ensemble doit sembler continu.

---

# 21. Header du chat

## Éléments

- back ;
- avatar ;
- nom ;
- statut ;
- audio call ;
- video call ;
- menu.

## Comportement

Tap avatar/nom :

→ profil.

Tap statut dans groupe :

→ membres ou détails selon contexte.

## États

- online ;
- typing ;
- recording ;
- last seen ;
- connecting ;
- muted ;
- verified.

---

# 22. Timeline des messages

Doit gérer :

- chargement initial ;
- anciens messages ;
- nouveaux messages temps réel ;
- scroll inversé ;
- date separators ;
- unread marker ;
- jump to bottom ;
- pinned ;
- search highlight.

## Performance

Virtualisation obligatoire.

## Scroll preservation

Le chargement des anciens messages ne doit pas déplacer visuellement le contenu.

---

# 23. Bulles texte

## Entrantes / sortantes

Différence claire mais douce.

## Taille

La largeur suit le contenu.

## Groupement

Messages consécutifs du même auteur :

- premier ;
- intermédiaire ;
- dernier.

Les coins changent subtilement pour créer une continuité.

## Meta

- heure ;
- ticks ;
- edited ;
- vue ;
- signature.

---

# 24. Réponse à un message

## Activation

- swipe ;
- long press ;
- action desktop.

## Composer

Bloc reply compact :

- auteur ;
- extrait ;
- thumbnail ;
- close.

## Navigation

Tap sur reply :

→ scroll vers message d’origine.

Si message non chargé :

→ fetch puis scroll.

---

# 25. Citations

Doivent gérer :

- texte ;
- image ;
- audio ;
- sticker ;
- fichier ;
- message supprimé.

Toujours compactes.

---

# 26. Réactions

## Interaction

Long press :

- réactions favorites ;
- bouton plus.

## Affichage

Sous ou intégré à la bulle.

## États

- aucune ;
- ma réaction ;
- plusieurs utilisateurs ;
- réaction animée ;
- réaction supprimée.

---

# 27. Menu contextuel d’un message

Actions dynamiques selon droits :

- reply ;
- copy ;
- edit ;
- forward ;
- pin ;
- select ;
- save ;
- translate ;
- transcribe ;
- report ;
- delete ;
- more.

## Visuel

Message sélectionné mis en avant.

Fond légèrement assombri/blur.

---

# 28. Sélection multiple de messages

Actions :

- forward ;
- copy ;
- save ;
- delete ;
- export ;
- pin si autorisé.

Les messages sélectionnés reçoivent un highlight discret.

---

# 29. Message système

Exemples :

- user joined ;
- left ;
- group renamed ;
- photo changed ;
- pinned message ;
- call ;
- admin action.

Style secondaire, compact et distinct des bulles.

---

# 30. Séparateurs de date

Exemples :

- Today ;
- Yesterday ;
- 6 October 2026.

Peut utiliser Glass Soft.

Doit rester sticky temporairement pendant le scroll si utile.

---

# 31. Unread marker

Une ligne discrète :

`12 new messages`

Doit rester facilement repérable.

---

# 32. Bouton revenir en bas

Apparaît si utilisateur n’est plus au bas de la timeline.

Peut afficher :

- flèche ;
- compteur nouveaux messages ;
- compteur mentions.

---

# 33. Composer — état vide

Éléments possibles :

- emoji ;
- champ ;
- attachment ;
- micro/camera.

Hauteur compacte.

Glass Medium possible.

---

# 34. Composer — texte présent

Le micro devient envoyer avec animation.

Le champ grandit progressivement.

Limite de hauteur, puis scroll interne.

---

# 35. Composer — mode reply

Ajoute bloc de contexte.

Doit pouvoir être fermé sans effacer le brouillon.

---

# 36. Composer — mode edit

Affiche :

`Editing message`

Le texte du message revient dans le champ.

Annuler restaure le brouillon précédent si nécessaire.

---

# 37. Composer — pièce jointe

Le panneau peut contenir :

- galerie ;
- caméra ;
- fichier ;
- contact ;
- location ;
- poll ;
- music ;
- scheduled message.

Disposition compacte, claire, cohérente.

---

# 38. Emoji panel

Sections :

- récents ;
- smileys ;
- personnes ;
- animaux ;
- nourriture ;
- activités ;
- objets ;
- symboles ;
- drapeaux.

Recherche.

Skin tones.

Navigation fluide.

---

# 39. Stickers

Sections :

- favoris ;
- récents ;
- packs ;
- suggestions ;
- recherche.

## États

- téléchargement pack ;
- pack supprimé ;
- preview ;
- animation ;
- pack premium éventuel.

---

# 40. GIF

Grille virtualisée.

Search.

Preview en boucle optimisée.

Data saver supporté.

---

# 41. Notes vocales — enregistrement

## Gestes

- hold to record ;
- slide left to cancel ;
- slide up to lock.

## UI

- timer ;
- waveform ;
- niveau micro ;
- indication slide to cancel ;
- lock.

## Haptique

- start ;
- lock ;
- cancel threshold.

---

# 42. Note vocale verrouillée

Contrôles :

- pause ;
- resume ;
- delete ;
- send.

## Preview

L’utilisateur doit pouvoir écouter avant envoi si configuration produit le permet.

---

# 43. Lecture note vocale

Composants :

- play/pause ;
- waveform ;
- scrub ;
- durée ;
- vitesse ;
- transcript éventuel.

Vitesse :

- 1x ;
- 1.5x ;
- 2x.

---

# 44. Transcription audio

KnowMe peut transcrire :

- note vocale ;
- fichier audio ;
- note vidéo.

## UI

Bouton discret :

`Transcribe`

Résultat sous le média ou dans un bloc extensible.

## États

- queued ;
- processing ;
- complete ;
- failed ;
- unsupported language.

---

# 45. Changement de voix

Avant envoi :

- original ;
- voix transformée ;
- effets ;
- preview ;
- reset.

Toujours permettre de comparer original et résultat.

---

# 46. Note vidéo

## Capture

- cercle caméra ;
- switch caméra ;
- hold ;
- lock ;
- timer ;
- preview.

## Lecture

- progression circulaire ;
- play/pause ;
- mute ;
- transcription éventuelle.

---

# 47. Galerie intégrée

## Grille

- thumbnails ;
- type ;
- durée vidéo ;
- index de sélection.

## Sélection multiple

Ordre visible.

## Bas de page

- caption ;
- HD ;
- compression ;
- send as file ;
- spoiler.

---

# 48. Éditeur média

Outils :

- crop ;
- rotate ;
- draw ;
- text ;
- emoji ;
- blur ;
- spoiler ;
- undo ;
- redo.

## Vidéo

- trim ;
- mute ;
- cover ;
- compression ;
- quality.

---

# 49. Viewer photo

Interactions :

- pinch zoom ;
- double tap ;
- swipe suivant/précédent ;
- swipe vertical close ;
- share ;
- forward ;
- save ;
- info ;
- delete si autorisé.

Transition depuis thumbnail.

---

# 50. Viewer vidéo

Contrôles :

- play/pause ;
- scrub ;
- mute ;
- volume desktop ;
- fullscreen ;
- PiP ;
- speed ;
- captions.

---

# 51. Fichiers

Message fichier :

- icon ;
- name ;
- type ;
- size ;
- progress ;
- cancel ;
- retry.

Après téléchargement :

- open ;
- share ;
- save ;
- locate.

---

# 52. Liens / previews

Preview :

- domaine ;
- titre ;
- description ;
- image ;
- type.

Actions :

- open ;
- copy ;
- share ;
- save.

---

# 53. Polls

Types :

- single choice ;
- multiple choice ;
- quiz ;
- anonymous ;
- public.

Affichage :

- options ;
- résultat ;
- pourcentage ;
- nombre votes.

Animation de progression après vote.

---

# 54. Localisation

Types :

- position statique ;
- live location.

Message compact avec miniature.

Tap :

viewer complet.

---

# 55. Contact partagé

Affiche :

- avatar ;
- nom ;
- numéro/username ;
- bouton add/message.

---

# 56. Messages programmés

Accès depuis composer.

## Page

Liste des messages programmés.

Actions :

- edit ;
- send now ;
- reschedule ;
- delete.

---

# 57. Messages silencieux

Option avant envoi.

Indication légère.

---

# 58. Messages éphémères

Réglages possibles :

- off ;
- 24 h ;
- 7 jours ;
- 30 jours ;
- custom.

Indicateur discret dans le chat.

---

# 59. Traduction

## Interaction

Long press → Translate  
ou barre contextuelle.

## Affichage

Original conservé.

Traduction dans la même bulle, séparée subtilement.

## Options

- toujours traduire cette langue ;
- jamais traduire cette langue ;
- langue cible.

---

# 60. IA dans les messages

Fonctions possibles :

- résumer ;
- reformuler ;
- traduire ;
- corriger ;
- expliquer ;
- répondre ;
- extraire tâches ;
- analyser fichier ;
- résumer thread.

L’IA doit rester contextuelle et discrète.

---

# 61. Profil utilisateur

## Header

- grand avatar ;
- nom ;
- username ;
- status ;
- actions.

## Actions

- message ;
- audio ;
- video ;
- mute ;
- search ;
- more.

## Informations

- bio ;
- phone selon confidentialité ;
- birthday éventuel ;
- timezone facultative ;
- common groups.

---

# 62. Tabs profil

- Media ;
- Files ;
- Links ;
- Voice ;
- GIF ;
- Groups in common.

Chargement lazy.

---

# 63. Modifier son profil

Champs :

- avatar ;
- prénom ;
- nom ;
- username ;
- bio ;
- links ;
- date de naissance facultative.

Preview avant sauvegarde si changement visuel majeur.

---

# 64. Photo de profil / historique

Viewer permettant :

- photo actuelle ;
- anciennes photos ;
- delete ;
- set main ;
- save.

---

# 65. QR Profile

QR KnowMe permettant :

- ouvrir profil ;
- ajouter contact ;
- partager.

Personnalisable avec branding KnowMe.

---

# 66. Groupe — profil

Header :

- avatar ;
- name ;
- members ;
- description.

Actions :

- mute ;
- search ;
- leave ;
- share ;
- more.

Tabs :

- media ;
- files ;
- links ;
- members ;
- topics.

---

# 67. Liste membres

Chaque ligne :

- avatar ;
- name ;
- status ;
- role.

Actions admin :

- promote ;
- restrict ;
- remove ;
- ban ;
- message.

Recherche.

---

# 68. Admins

Page dédiée.

Rôles :

- owner ;
- admin ;
- moderator ;
- custom role.

Permissions granulaires.

---

# 69. Permissions groupe

Exemples :

- send messages ;
- send media ;
- stickers ;
- polls ;
- links ;
- invite ;
- pin ;
- change info ;
- topics.

Preset + custom.

---

# 70. Modération

Outils :

- slow mode ;
- anti-spam ;
- filters ;
- banned words ;
- join approval ;
- report queue ;
- recent actions.

Historique d’administration.

---

# 71. Topics

Page topics :

- icon ;
- title ;
- preview ;
- unread ;
- pinned.

Possibilité :

- create ;
- rename ;
- close ;
- reopen ;
- pin.

---

# 72. Pinned messages

Panneau compact dans le chat.

Tap :

→ message.

Si plusieurs :

- navigation ;
- liste complète.

---

# 73. Invitations groupe

Types :

- lien permanent ;
- lien temporaire ;
- expiration ;
- usage limit ;
- approval required.

Stats du lien :

- joins ;
- pending ;
- creator.

---

# 74. Demandes d’adhésion

Liste :

- avatar ;
- nom ;
- date ;
- bio éventuelle.

Actions :

- accept ;
- reject ;
- block/report.

---

# 75. Chaîne — vue principale

Doit rester proche d’un chat.

Post contient :

- auteur/signature éventuelle ;
- contenu ;
- médias ;
- vues ;
- réactions ;
- comments ;
- time.

---

# 76. Chaîne — profil

Informations :

- avatar ;
- nom ;
- username ;
- subscribers ;
- description ;
- links.

Actions :

- follow ;
- mute ;
- share ;
- search ;
- report.

---

# 77. Création de chaîne

Étapes :

- nom ;
- photo ;
- description ;
- public/private ;
- username ;
- permissions ;
- comments ;
- signatures.

---

# 78. Publication chaîne

Composer adapté :

- texte ;
- média ;
- fichier ;
- poll ;
- schedule ;
- silent ;
- signature ;
- comments ;
- reactions.

Preview avant publication possible.

---

# 79. Statistiques chaîne

Graphiques utiles seulement :

- views ;
- reach ;
- followers ;
- reactions ;
- shares ;
- top posts ;
- sources.

Design KnowMe, pas dashboard SaaS.

---

# 80. Commentaires de chaîne

Conversation liée à un post.

Header rappelle clairement le post d’origine.

---

# 81. Appels — historique

Liste :

- contact ;
- audio/video ;
- incoming/outgoing/missed ;
- date ;
- duration.

Action rapide pour rappeler.

---

# 82. Appel entrant

UI plein écran ou système natif selon plateforme.

Éléments :

- avatar ;
- nom ;
- type ;
- answer ;
- decline ;
- message ;
- remind.

---

# 83. Appel audio actif

Contrôles :

- mute ;
- speaker ;
- add ;
- video ;
- more ;
- end.

Glass Strong.

---

# 84. Appel vidéo actif

Zones :

- remote video ;
- self preview ;
- controls.

Gestes :

- drag self preview ;
- double tap camera ;
- fullscreen ;
- PiP.

---

# 85. Appel de groupe

Doit gérer :

- speaker view ;
- grid ;
- participants ;
- raise hand ;
- mute all admin ;
- screen share ;
- chat ;
- reactions.

---

# 86. Screen Sharing

Prévisualisation claire avant partage.

Indicateur persistant tant que le partage est actif.

Bouton Stop toujours accessible.

---

# 87. Recherche dans un chat

Header transformé en search.

Affiche :

- query ;
- count ;
- previous ;
- next.

Highlights dans timeline.

Filtres :

- date ;
- user ;
- media type.

---

# 88. Médias partagés

Grille.

Filtres :

- photos ;
- videos ;
- months.

Sélection multiple.

Actions :

- save ;
- forward ;
- delete.

---

# 89. Fichiers partagés

Liste triable :

- type ;
- date ;
- size ;
- sender.

Search.

---

# 90. Liens partagés

Preview compacte.

Tri par date.

Search domain/title.

---

# 91. Favoris / Saved Messages

KnowMe doit proposer un espace personnel.

Possibilités :

- texte ;
- fichiers ;
- liens ;
- reminders ;
- notes ;
- tags.

Peut devenir un mini espace de travail personnel.

---

# 92. Brouillons

Conservation locale instantanée.

Option sync multi-device.

État :

- texte ;
- reply ;
- attachment pending.

---

# 93. Notifications internes

Centre facultatif pour :

- mentions ;
- replies ;
- reactions ;
- system alerts ;
- channel updates.

Doit rester secondaire au système de chats.

---

# 94. Paramètres — page racine

Sections compactes :

- Account ;
- Privacy & Security ;
- Notifications ;
- Appearance ;
- Chats ;
- Data & Storage ;
- Devices ;
- Language ;
- Accessibility ;
- AI ;
- Help ;
- About.

---

# 95. Compte

Options :

- phone/email ;
- username ;
- profile ;
- linked identities ;
- export ;
- delete account.

---

# 96. Confidentialité

Contrôles :

- phone visibility ;
- last seen ;
- profile photo ;
- bio ;
- forwarded messages ;
- calls ;
- groups ;
- read receipts ;
- birthday ;
- discovery.

Chaque option peut proposer :

- Everybody ;
- Contacts ;
- Nobody ;
- exceptions.

---

# 97. Sécurité

Options :

- 2FA ;
- passkeys ;
- recovery codes ;
- app lock ;
- biometrics ;
- login alerts ;
- trusted devices ;
- auto-lock ;
- sensitive content protection.

---

# 98. Appareils liés / sessions

Chaque session affiche :

- appareil ;
- OS ;
- emplacement approximatif ;
- IP partiellement masquée si utile ;
- dernière activité ;
- date connexion.

Actions :

- terminate ;
- terminate all others ;
- rename device ;
- mark trusted.

---

# 99. App Lock

Méthodes :

- PIN ;
- biometrics ;
- system lock.

Options :

- auto-lock ;
- hide content in recents ;
- disable screenshots pour zones sensibles si plateforme le permet.

---

# 100. Notifications

Granularité :

- private chats ;
- groups ;
- channels ;
- calls ;
- reactions ;
- mentions ;
- stories si présentes.

Options :

- sound ;
- vibration ;
- preview ;
- badge ;
- priority ;
- quiet hours.

---

# 101. Apparence

Options :

- theme ;
- dark mode schedule ;
- AMOLED ;
- accent ;
- wallpaper ;
- bubble shape ;
- text size ;
- compact mode ;
- animation intensity ;
- icon style éventuel.

Preview live.

---

# 102. Wallpaper

Sources :

- KnowMe defaults ;
- colors ;
- gradients subtils ;
- photos ;
- generated backgrounds.

Options :

- blur ;
- dim ;
- motion ;
- per-chat wallpaper.

---

# 103. Data & Storage

Sections :

- network usage ;
- storage usage ;
- auto-download ;
- media quality ;
- streaming ;
- cache ;
- save to gallery ;
- upload compression.

---

# 104. Storage Manager

Vue par :

- photos ;
- videos ;
- files ;
- audio ;
- stickers ;
- chats.

Actions :

- clear cache ;
- clear selected ;
- keep X days ;
- exceptions.

Toujours expliquer que le cloud/local distant n’est pas supprimé si c’est seulement le cache.

---

# 105. Network Usage

Stats :

- mobile ;
- Wi-Fi ;
- roaming.

Catégories :

- messages ;
- photos ;
- videos ;
- files ;
- calls.

Reset stats.

---

# 106. Langue

Recherche.

Languages téléchargables si traduction offline prévue.

Preview immédiate.

Gestion RTL.

---

# 107. Accessibilité

Options :

- text size ;
- bold text ;
- high contrast ;
- reduce motion ;
- reduce transparency ;
- screen reader improvements ;
- larger touch targets ;
- captions ;
- mono audio.

---

# 108. IA — paramètres

Contrôles :

- suggestions ;
- smart replies ;
- translation ;
- transcription ;
- summarization ;
- voice transformation ;
- privacy mode ;
- local/cloud processing indication.

Chaque fonction doit clairement expliquer les données utilisées.

---

# 109. Bots

KnowMe peut supporter des bots.

Page bot :

- avatar ;
- name ;
- verified status ;
- description ;
- commands ;
- privacy ;
- permissions.

Actions :

- start ;
- stop ;
- block ;
- report ;
- open mini-app.

---

# 110. Mini-apps

Doivent s’ouvrir dans un conteneur KnowMe.

Contrôles :

- close ;
- back ;
- share ;
- permissions ;
- fullscreen.

Permissions explicites :

- profile ;
- location ;
- microphone ;
- camera ;
- clipboard.

---

# 111. Discover / Explore

Si KnowMe possède un espace découverte :

Sections :

- channels ;
- bots ;
- public groups ;
- trending topics ;
- recommendations.

La découverte ne doit pas envahir l’expérience de messagerie privée.

---

# 112. Stories / Moments — optionnel

Si ajoutées :

Page dédiée ou bande compacte.

Fonctions :

- photo ;
- video ;
- privacy ;
- replies ;
- reactions ;
- archive ;
- viewers.

L’identité visuelle doit rester KnowMe.

---

# 113. QR Scanner

Fonctions :

- profile ;
- group invite ;
- channel ;
- login ;
- device linking.

Preview et confirmation avant toute action sensible.

---

# 114. Deep Links

KnowMe doit gérer :

- user ;
- group ;
- channel ;
- message ;
- invite ;
- bot ;
- mini-app ;
- call ;
- login QR.

Chaque deep link doit avoir fallback si contenu inaccessible.

---

# 115. Offline Mode

L’application reste utilisable :

- ouvrir chats récents ;
- lire cache ;
- écrire message ;
- voir médias disponibles ;
- rechercher localement.

Messages en attente synchronisés dès reconnexion.

---

# 116. Reconnexion

État discret dans le header :

- Connecting… ;
- Waiting for network… ;
- Updating…

Jamais un plein écran sauf situation réellement bloquante.

---

# 117. Synchronisation multi-device

Doit gérer :

- nouveaux messages ;
- edits ;
- deletes ;
- read states ;
- drafts ;
- pinned ;
- reactions ;
- settings sync ;
- media states.

Résolution de conflit définie.

---

# 118. Optimistic UI

Actions affichées immédiatement :

- send message ;
- reaction ;
- edit ;
- read ;
- pin ;
- mute local.

Si serveur refuse :

rollback propre + feedback.

---

# 119. Upload Manager

Uploads doivent survivre aux navigations.

Afficher progression :

- dans message ;
- éventuellement dans une zone globale si beaucoup d’uploads.

Actions :

- pause ;
- cancel ;
- retry.

---

# 120. Download Manager

Même logique.

Priorité aux contenus visibles.

---

# 121. Erreurs réseau

Ne jamais afficher dix popups.

Préférer :

- toast ;
- inline ;
- retry ;
- state icon.

Dialogs uniquement si action importante impossible.

---

# 122. États vides

Pages prévues :

- no chats ;
- no contacts ;
- no search results ;
- no media ;
- no files ;
- no calls ;
- no devices ;
- no blocked users ;
- no notifications.

Illustrations légères et propres à KnowMe.

---

# 123. Loading States

Règles :

- contenu cache d’abord ;
- skeleton ensuite ;
- spinner uniquement pour action locale courte ;
- plein écran uniquement si impossible d’afficher quoi que ce soit.

---

# 124. Error States

Toujours préciser :

- ce qui a échoué ;
- ce que l’utilisateur peut faire ;
- retry si possible.

---

# 125. Permissions refusées

Chaque permission a son état alternatif.

Exemple caméra refusée :

- expliquer ;
- bouton ouvrir paramètres ;
- permettre upload depuis galerie si possible.

---

# 126. Blocage utilisateur

Page confirmation compacte.

Après blocage :

- chat reste lisible selon politique ;
- composer désactivé ou adapté ;
- option unblock claire.

---

# 127. Utilisateurs bloqués

Liste gérable depuis privacy.

---

# 128. Report

Flux :

- reason ;
- optional details ;
- messages concernés ;
- block option.

Confirmation discrète.

---

# 129. Suppression de compte

Doit être volontairement plus explicite.

Étapes :

- conséquences ;
- confirmation ;
- password/2FA ;
- délai éventuel.

---

# 130. Export de données

Types :

- messages ;
- media ;
- contacts ;
- settings.

Progression.

Notification quand prêt.

---

# 131. Sauvegarde / restauration

Si KnowMe supporte sauvegarde :

- encrypted backup ;
- cloud/local ;
- key/recovery ;
- restore preview.

Jamais de sauvegarde non chiffrée de données sensibles.

---

# 132. Multi-compte

Switch rapide.

Chaque compte garde :

- unread ;
- drafts ;
- scroll ;
- selected folder ;
- theme éventuellement.

Ajout/suppression compte sans confusion.

---

# 133. Notifications système

Doivent respecter plateforme.

Actions rapides :

- reply ;
- mark read ;
- mute.

Contenu cachable sur écran verrouillé.

---

# 134. Widgets système

Optionnel :

- conversations favorites ;
- unread count ;
- recent chats.

Respect de confidentialité.

---

# 135. Raccourcis desktop

Exemples :

- Ctrl/Cmd+K → search ;
- Ctrl/Cmd+N → new chat ;
- Esc → close overlay ;
- ↑/↓ → navigate search ;
- Ctrl/Cmd+Enter → send configurable.

---

# 136. Drag & Drop desktop

Support :

- files ;
- images ;
- videos ;
- text.

Drop target visuel.

---

# 137. Right Click desktop

Équivalent du long press.

---

# 138. Multi-window / split-screen

KnowMe doit survivre au redimensionnement dynamique.

Aucune largeur fixe qui casse l’interface.

---

# 139. Foldables

Prévoir :

- hinge ;
- posture ;
- multi-pane.

---

# 140. Orientation paysage

Mobile landscape :

- composer reste accessible ;
- média s’adapte ;
- vidéo utilise l’espace ;
- chat ne devient pas illisible.

---

# 141. Safe Areas

Respecter :

- notch ;
- dynamic island ;
- gesture bars ;
- cutouts ;
- desktop window controls.

---

# 142. Keyboard Management

Le clavier ne doit pas :

- cacher le composer ;
- provoquer de saut brutal ;
- perdre le scroll ;
- fermer un menu de manière incohérente.

---

# 143. Focus Management

Desktop/web :

- ordre logique ;
- focus visible ;
- modales trap focus ;
- retour du focus à l’élément d’origine.

---

# 144. Screen Reader

Chaque composant expose :

- label ;
- role ;
- state ;
- action.

Les messages doivent être lus dans un ordre compréhensible.

---

# 145. Reduce Motion

Réduire :

- shared transitions ;
- parallax ;
- springs ;
- animations décoratives.

Garder feedback essentiel.

---

# 146. Reduce Transparency

Remplacer blur par surface opaque correctement contrastée.

---

# 147. High Contrast

Mode optionnel.

Doit augmenter contraste sans casser branding.

---

# 148. Performance — chats

Objectifs :

- scrolling stable ;
- pas de jank ;
- rendering minimal ;
- lazy media ;
- virtualisation ;
- cache.

---

# 149. Images

Toujours :

- thumbnail ;
- decode à taille adaptée ;
- cache ;
- progressive loading.

Jamais une image 8K pour un avatar 48 px.

---

# 150. Vidéos

- preload metadata ;
- poster frame ;
- streaming ;
- adaptive bitrate si possible ;
- pause hors écran.

---

# 151. Audio

- waveform precomputed si possible ;
- streaming ;
- cache ;
- reprise position.

---

# 152. Mémoire

Les gros médias hors écran doivent être relâchés.

---

# 153. Batterie

Limiter :

- background polling ;
- animations inutiles ;
- vidéo auto-play ;
- blur coûteux ;
- localisation continue.

---

# 154. Data Saver

Mode :

- no autoplay ;
- lower thumbnails ;
- manual HD ;
- limited prefetch.

---

# 155. QA visuelle

Pour chaque écran :

1. capturer référence ;
2. capturer KnowMe ;
3. superposer ;
4. vérifier spacing ;
5. vérifier dimensions ;
6. vérifier icon size ;
7. vérifier baseline ;
8. vérifier radius ;
9. vérifier color ;
10. vérifier motion.

---

# 156. QA interaction

Tester :

- tap rapide ;
- double tap ;
- long press ;
- swipe lent ;
- swipe rapide ;
- multitouch ;
- keyboard ;
- screen reader ;
- offline ;
- reconnect ;
- rotation ;
- resize.

---

# 157. QA performance

Mesurer :

- frame time ;
- input latency ;
- launch time ;
- chat open ;
- image open ;
- search latency ;
- message send perceived latency.

---

# 158. Definition of Done

Chaque écran doit avoir :

- normal state ;
- loading ;
- empty ;
- error ;
- offline ;
- pressed ;
- selected ;
- disabled ;
- success ;
- permission denied si pertinent.

---

# 159. Ordre recommandé d’implémentation

## Phase 1 — cœur messagerie

1. Splash/auth.
2. Chats.
3. Chat.
4. Composer.
5. Text messages.
6. Reply/reactions.
7. Media.
8. Voice/video notes.
9. Profile.
10. Search.

## Phase 2 — social

11. Contacts.
12. Groups.
13. Channels.
14. Calls.
15. Shared media.
16. Notifications.

## Phase 3 — infrastructure

17. Settings.
18. Privacy.
19. Security.
20. Devices.
21. Storage.
22. Offline.
23. Multi-device.

## Phase 4 — différenciation KnowMe

24. Translation.
25. Transcription.
26. Voice transformation.
27. AI actions.
28. Bots.
29. Mini-apps.
30. Discover.

---

# 160. Règle de fidélité à une référence Telegram

Quand une capture est donnée :

- analyser la structure ;
- relever proportions ;
- estimer marges ;
- mesurer densité ;
- observer tailles ;
- comprendre les gestes ;
- comprendre les transitions ;
- comprendre les états ;
- reconstruire le comportement ;
- remplacer branding par KnowMe.

Ne pas faire une simple interprétation.

Cependant, ne pas copier :

- marque ;
- logo ;
- illustrations propriétaires ;
- contenus propriétaires ;
- actifs graphiques propriétaires.

---

# 161. Ce qui doit rendre KnowMe reconnaissable

KnowMe doit avoir ses propres :

- animations ;
- accents ;
- avatars par défaut ;
- wallpapers ;
- reactions spéciales ;
- sons ;
- haptics ;
- motifs ;
- illustration d’erreur ;
- empty states ;
- identité IA ;
- iconographie spécifique ;
- logo.

---

# 162. Ce qu’on ne doit jamais oublier

À chaque nouvelle fonctionnalité, répondre à ces questions :

## Interface

- Où apparaît-elle ?
- Quelle est sa priorité visuelle ?
- Quel est son état vide ?
- Quel est son état erreur ?
- Quel est son état loading ?

## Interaction

- Comment on l’ouvre ?
- Comment on revient ?
- Quel geste existe ?
- Quelle action rapide existe ?
- Quelle alternative existe sans geste ?

## Motion

- Comment elle entre ?
- Comment elle sort ?
- Est-ce lié au doigt ?
- Respecte-t-elle Reduce Motion ?

## Responsive

- Mobile ?
- Tablette ?
- Desktop ?
- Web ?
- Foldable ?

## Accessibilité

- Screen reader ?
- Keyboard ?
- Large text ?
- Contrast ?
- Touch target ?

## Performance

- Lazy ?
- Virtualized ?
- Cached ?
- Prefetched ?
- Offline ?

## Sécurité

- Est-ce sensible ?
- Peut-on screenshot ?
- Faut-il biométrie ?
- Quelles données quittent l’appareil ?

---

# 163. Pages supplémentaires souvent oubliées

KnowMe doit également prévoir les écrans secondaires suivants :

- changement de numéro ;
- changement d’e-mail ;
- vérification username ;
- gestion des alias ;
- import contacts ;
- contacts dupliqués ;
- notifications muted exceptions ;
- liste utilisateurs bloqués ;
- liste groupes communs ;
- gestion invitations ;
- permissions caméra/micro refusées ;
- proxy/réseau avancé si nécessaire ;
- diagnostics réseau ;
- report bug ;
- help center ;
- status service ;
- acknowledgements open source ;
- licences ;
- version app ;
- beta program ;
- sync status ;
- media upload queue ;
- download queue ;
- saved downloads ;
- local files ;
- message requests ;
- spam folder ;
- archived channels ;
- hidden chats éventuels ;
- scheduled posts ;
- drafts manager ;
- blocked media ;
- muted words ;
- accessibility presets ;
- emergency logout ;
- revoke all sessions ;
- migration vers nouveau téléphone ;
- récupération sans ancien appareil ;
- account recovery ;
- recovery key ;
- backup restore ;
- failed payment si services payants ;
- subscription management si premium ;
- purchase restore ;
- storage exceeded ;
- upload too large ;
- unsupported file ;
- corrupted media ;
- deleted message placeholder ;
- content unavailable ;
- private channel inaccessible ;
- invite expired ;
- user deleted ;
- account suspended ;
- group deleted ;
- channel deleted ;
- maintenance mode ;
- minimum app version required.

---

# 164. Matrice des états par page

Chaque page doit être testée dans au moins :

| État | Obligatoire |
|---|---|
| Normal | Oui |
| Loading | Oui |
| Empty | Oui si pertinent |
| Error | Oui |
| Offline | Oui |
| Permission denied | Si pertinent |
| Disabled | Si pertinent |
| Selected | Si interactif |
| Pressed | Si interactif |
| Large text | Oui |
| Dark theme | Oui |
| AMOLED | Oui |
| RTL | Oui si localisation |
| Reduced motion | Oui |
| Reduced transparency | Oui |
| Small screen | Oui |
| Tablet | Oui |
| Desktop | Oui |

---

# 165. Checklist finale par page

Avant validation d’une page :

- [ ] structure fidèle ;
- [ ] spacing cohérent ;
- [ ] typographie correcte ;
- [ ] icônes cohérentes ;
- [ ] rayons cohérents ;
- [ ] touch targets corrects ;
- [ ] pressed state ;
- [ ] hover desktop ;
- [ ] focus visible ;
- [ ] loading ;
- [ ] empty ;
- [ ] error ;
- [ ] offline ;
- [ ] animations ;
- [ ] haptics ;
- [ ] responsive ;
- [ ] keyboard ;
- [ ] accessibility ;
- [ ] performance ;
- [ ] memory usage ;
- [ ] dark ;
- [ ] AMOLED ;
- [ ] large text ;
- [ ] visual diff réalisé ;
- [ ] aucun écart majeur visible.

---

# 166. Principe final

KnowMe ne doit jamais être développé avec la logique :

> « Ça marche, donc c’est terminé. »

La logique correcte est :

> **fonction + interaction + motion + visuel + performance + accessibilité + cohérence = terminé.**

Chaque page doit donner l’impression d’avoir été raffinée pendant plusieurs années.

L’objectif n’est pas seulement de reproduire l’apparence d’une grande messagerie.

L’objectif est de reproduire ce qui rend l’expérience rapide, intuitive, compacte, tactile, prévisible et agréable, puis de pousser cette qualité avec l’identité propre de KnowMe.

---

# 167. Résumé opérationnel

Pour chaque écran ou fonctionnalité :

1. Étudier la référence.
2. Mesurer proportions et densité.
3. Identifier les composants.
4. Mapper vers les design tokens KnowMe.
5. Construire la version mobile.
6. Ajouter états.
7. Ajouter gestures.
8. Ajouter animations.
9. Ajouter accessibilité.
10. Ajouter offline/error/loading.
11. Optimiser performance.
12. Adapter tablette.
13. Adapter desktop/web.
14. Faire visual diff.
15. Corriger.
16. Valider uniquement quand aucune différence majeure ou incohérence ne subsiste.

---

# Conclusion

KnowMe doit être conçu comme un **véritable système de messagerie complet**, pas comme une collection d’écrans.

Chaque composant doit vivre dans un système commun.

Chaque écran doit connaître :

- ce qui se passe avant lui ;
- ce qui se passe après lui ;
- ce qui arrive hors ligne ;
- ce qui arrive quand le réseau est lent ;
- ce qui arrive si l’utilisateur refuse une permission ;
- ce qui arrive sur petit écran ;
- ce qui arrive sur tablette ;
- ce qui arrive avec clavier ;
- ce qui arrive avec lecteur d’écran ;
- ce qui arrive avec 100 000 messages ;
- ce qui arrive avec un média très lourd ;
- ce qui arrive avec plusieurs comptes ;
- ce qui arrive avec plusieurs appareils ;
- ce qui arrive lorsqu’une action échoue.

C’est cette profondeur qui doit faire de KnowMe une application de messagerie réellement mature.