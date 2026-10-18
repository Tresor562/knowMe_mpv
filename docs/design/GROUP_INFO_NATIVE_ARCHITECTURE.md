# KnowMe — architecture des informations de groupe (Web et APK)
Workstream: design
Coordination-Issue: #699

## Diagnostic utilisateur — 18 octobre 2026
La fiche Web montrait une mosaïque des participants en guise de photo du groupe
et des boutons/onglets accumulés sans ordre de lecture. Elle n'offrait pas de
modification de la photo. L'objectif est une hiérarchie proche de la lisibilité
Telegram/WhatsApp, mais propre à l'identité visuelle KnowMe.

## Nouvelle organisation Web réelle
1. **En-tête de navigation 56 px :** retour à la discussion, titre et actualisation.
2. **Identité visuelle :** icône de groupe par défaut centrée, nom, nombre exact
   de participants issus de la liste autorisée, rôle du lecteur (propriétaire,
   admin, membre). Aucune photo inventée, aucune miniature trompeuse de membres
   affichée comme photo du groupe.
3. **Actions prioritaires compactes :** Messages, Recherche, Partager le lien
   interne réservé aux membres, Gérer/Options, Plus pour Quitter avec confirmation.
4. **Onglets horizontaux accessibles :** Aperçu (par défaut), Membres, Détails,
   Médias, Fichiers, Liens, Recherche. Navigation clavier flèches/Home/End.
5. **Aperçu hiérarchisé :** À propos / Contenus partagés / Membres (aperçu 3,
   Voir tous) / Paramètres de groupe. Actions reliées aux panneaux ou endpoints
   réellement existants ; aucun interrupteur sans persistance côté API.
6. **Petits appareils et grand écran :** largeur limitée et maîtrisée, onglets
   défilants, cibles ≥44px, 3 raccourcis lisibles même sur largeur 360px,
   aucune surface décorative géante, FR/EN, thèmes clair/sombre, mouvement réduit.
7. **Vie privée :** la liste des membres n'est affichée que pour une conversation
   trouvée dans `/conversations` de l'utilisateur connecté ; « partager » ne
   donne aucun accès au groupe aux non-membres.

## Blocage fonctionnel — vraie photo du groupe
**NON LIVRÉE PAR CETTE PR :** voir commentaire technique sur Messaging #693
déposé le 18 octobre.

La base `Conversation` n'a aucun `avatarAssetId` et l'API de gestion des
groupes ne sait pas fixer, retirer, servir ou diffuser une image propre au groupe.
Le changement de photo exige une vraie évolution concertée de Messaging + Infra :

- Upload d'un JPEG/PNG/WebP via le pipeline média AVATAR existant, validation de
  taille et verdict scan CLEAN/AVAILABLE ; refus de tout asset appartenant à un
  autre utilisateur ou provenant d'un autre groupe.
- Persistance durable de la référence dans Conversation, migration Prisma
  coordonnée avec PR #754 et anciennes PR du même schéma.
- Route PATCH/DELETE gardée OWNER/ADMIN, lecture par membres vérifiée, miniature
  dans la liste des chats, entêtes, informations Web et APK.
- Événement temps réel group:updated, cache et purge lors de retrait/bannissement.
- UI de changement : appui avatar (feuille actions : voir, choisir galerie,
  remplacer, retirer), sélection Android, recadrage/aperçu local, chargement/
  erreur/retour, cibles tactiles; remplacement visible sur les autres appareils.
- Tests 403 sur non-admin ou non-membre, asset privé tiers, fichier infecté,
  concurrence entre admins, mise à jour des listes et session révoquée.
- Ne pas présenter `/media/public/avatar/:id` de l'utilisateur comme un avatar
  de groupe, ni créer un bouton qui échoue systématiquement sans backend.

**Différence de statut :** cette PR structure la fiche Web et sa navigation,
mais ne délivre ni photo de groupe, ni refonte de l'écran natif Android.
