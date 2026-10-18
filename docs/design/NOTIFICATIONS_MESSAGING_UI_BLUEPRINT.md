# KnowMe — parcours visuels Notifications, Discussions et Expressions
Dernière mise à jour : 2026-10-18
Ancre : Design #699. Source de vérité de disposition à appliquer progressivement, **sans réattribuer les domaines métiers**.

## Principes d'intégration
- KnowMe est un réseau social complet : accueil social, créateurs, groupes, stories, réels, marketplace, messagerie, IA.
- Les grandes cartes et gros boutons pleins ne doivent pas occuper la majorité des écrans. Une zone tactile de 44–48 px est compatible avec un contrôle **visuellement compact**.
- Grille 4 px, typographies hiérarchisées, indicateurs d'état sobres, style Soft Rounded / Native First, palette sémantique, pas d'émojis comme icônes de navigation principales.
- Android, Web mobile, tablette et desktop ont des compositions adaptées, pas un seul écran étiré.

## Centre et alertes dans l'application
1. **Source de vérité** : `GET /notifications/center`, room Socket.IO personnelle, préférences serveur, événement `notification:created`. Les routes servent seulement de navigation et sont toujours réautorisées par le serveur.
2. Compteur compact dans la navigation / bandeau contextuel; aucune nouvelle publication ne doit provoquer une carte géante recouvrant le contenu.
3. Heads-up non critique = icône dessinée (messages, mentions, publication, sécurité), titre **une ligne prioritaire**, aperçu limité, fermer (44 px), ouvrir, puis marquer lu. Éviter doublons et rejouer les anciennes alertes à chaque démarrage.
4. Respect `masterEnabled`, `realtimeEnabled`, `CENTER_ONLY`, filtres de catégories, types coupés et fuseau/heures calmes; sécurité critique prioritaire selon la politique serveur.
5. Notifications attendues **à implémenter ou vérifier côté métier** : message privé/groupe; réaction/commentaire à publication; mention en commentaire, publication, story, groupe et message; nouvelle publication d'un créateur suivi; demande d'ami, suivi, badge et invitation; cadeaux; système/sécurité. Désactivation par catégorie et contrôle anti-spam.
6. Lorsque l'utilisateur est déjà sur l'activité cible, ne pas multiplier les alertes; mise à jour du centre et des compteurs. En cas de serveur indisponible, ne jamais simuler un succès.
7. Le blocage système Android est un autre chantier : ce composant est une notification **dans** l'application, sans demande de permission système.

## Discussions — architecture de placement
### Liste mobile
- En-tête compact : menu à gauche, titre / état de synchronisation, actions iconiques « nouveau message » et « actualiser » à droite.
- Recherche sous l'en-tête, puis filtres horizontaux Toutes / Non lues / Épinglées.
- Ligne 68–76 dp : avatar à gauche (48–52), titre + badge identité + épingle, horodatage discret à droite; sous-ligne aperçu tronqué et indication non lu.
- « Options » dans un contrôle discret touchable de 44 dp, jamais un gros bouton en pleine largeur.
- État vide accessible et raccourci Nexus AI compact; chargement, erreur, hors-ligne, avatar manquant et permissions gérés.
- Sur téléphone : liste → conversation complète, retour fiable. Desktop ≥1000 px : master/detail avec la discussion active à droite.

### Conversation
- En-tête : retour, avatar + nom + statut qui ouvrent les infos, appels et menu contextuel compacts sur la droite.
- Historique : dates centrées, bulles entrantes/sortantes lisibles, badges d'auteur dans les groupes, horodatage et lecture sans cacher le texte, médias avec ratio et prévisualisation.
- Composer épinglé en bas : expression à gauche, attache photo/fichier, champ extensible, **envoi ou micro** à droite; deux actions contradictoires ne doivent jamais se superposer.
- Dès qu'un clavier logiciel apparaît, la zone de composition se décale avec le clavier. Aucun bouton ne doit être masqué par un dock flottant.
- Réponse, édition, transfert, réactions, messages épinglés et sélections = états explicites et menus accessibles, sans imiter une interface de bureau sur mobile.

### Clavier emoji, stickers, GIF
- Panneau à ancrage bas (ce n'est pas un popup flottant) sous le composer; compact ~42dvh, agrandi ~77dvh.
- Barre de packs/raccourcis horizontalement défilante, onglets Emoji / Stickers / GIF / Fichiers, recherche, grille stable.
- Tous les onglets ont état actif, état vide, erreurs de chargement, bouton retour au clavier normal.
- Appui emoji -> insertion dans le brouillon, sticker -> prévisualisation et envoi via contrat serveur, GIF -> aperçu puis envoi, fichier -> galerie/fichier natif.
- Pack personnel, nom/identité, création et import depuis Telegram relèvent de Messaging #693; ce document ne crée pas fictivement ces données.
- Accessibilité : noms accessibles à chaque pictogramme, cible 44 dp, focus et geste vertical pour agrandir sans interrompre l'envoi.

## Informations et groupes
- En-tête du groupe : photo, nom, nombre de membres, rôle/bio, détails utiles **sans grand panneau marketing**.
- Onglets Info / Médias / Membres / Liens si leurs données existent; ne jamais dessiner un onglet non fonctionnel.
- Liste participants en lignes compactes; rôle et statut secondaires; actions admin via menu local; « Quitter » destructif visuellement différencié.
- Membres/permissions côté serveur; aucune option UI ne doit exposer une action interdite.
- Écran de gestion : actions « modifier »/« ajouter » discrètes, formulaire contextualisé seulement lorsqu'il est ouvert.

## Boutons et système visuel
- Contrôle secondaire = fond transparent ou surface ténue et faible bordure; primaire rempli seulement pour une action principale par contexte.
- Cibles 44/48, glyphes 20–24, libellés 12–14; rayons 12–16 pour petits contrôles, ~26 pour sheets.
- Pas de barre « pleine de boutons » dans les entêtes, cartes à chaque ligne, texte technique inutile, émojis comme glyphes de système, ni animations qui retardent les interactions.
- Light, Dark, AMOLED, Reduce Transparency, Reduce Motion et zoom texte testés avant fusion.

## Partage des responsabilités
- **Design #699** : tokens, dispositions, tailles, navigation visuelle, badges et heads-up client, composants génériques (cette branche Web).
- **Messaging #693** : listes et conversations natives/Web, composition, vocaux, GIF/stickers et états des groupes.
- **Social #694** : déclencheurs suivis-créateurs / publications et mentions dans posts/commentaires.
- **Infra #698** : persistance et transport des nouvelles catégories de notifications, paramétrages, pagination/dédoublonnage.
- **Profiles #696** : préférences, badge utilisateur, suivi et profils d'auteur.
- Ne pas modifier une PR de l'autre domaine ni inventer un événement serveur non existant.

## Critères de validation / preuves
- Des tests du modèle vérifient URLs internes, catégories, préférences et plages horaires.
- Test E2E : la première lecture n'affiche pas de « vieilles » alertes; nouvel événement -> bandeau+compteur; heures silencieuses -> compteur sans bandeau.
- CI quality + guard anti-conflit sur chaque dernier HEAD, puis intégration approuvée; Web et APK vérifiés séparément.
- Captures comparatives : téléphone étroit, grand Android, tablette et desktop; focus clavier, lecteur d'écran, réduction transparence et mouvement.
- Ne pas déclarer une catégorie fonctionnelle tant qu'un événement `notification:created` persistant et un lien cible valide n'ont pas été vérifiés.
