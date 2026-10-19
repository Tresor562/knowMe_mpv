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

## Photo de groupe — implémentation API + Web en validation dans cette PR
Cette PR ajoute **le code** de la fonctionnalité de photo de groupe, distincte
des avatars utilisateurs. Son fonctionnement de bout en bout n'est confirmé
qu'après migration VPS, API disponible et QA Android/Web.

- Nouveau modèle Prisma multi-fichier `ConversationAvatar` avec migration dédiée
  (photo courante par conversation). Il ne modifie pas le `Conversation` de
  `schema.prisma` déjà concerné par PR #754. Référence de média propriétaire
  enregistrée de façon durable, sans URL publique arbitraire.
- `GroupAvatarController` et `GroupAvatarService` reliés à `MediaModule`
  (sans modifier `messaging.module.ts` déjà détenu par PR historique #496).
  Routes `GET .../avatar/capabilities`, `GET .../avatar` (JWT + membre),
  `PATCH .../avatar` (admin/propriétaire et asset de l'acteur) et `DELETE`.
- Upload sécurisé via `POST /media/uploads` (purpose AVATAR, PRIVATE) et
  `POST /media/uploads/:id/complete` : format JPEG/PNG/WebP, 1 Ko à 5 Mo,
  scannerVerdict CLEAN et status AVAILABLE. Vérifications revérifiées serveur
  avant persistance, transaction sérialisable contre révocation simultanée.
- Lecture des photos privées via API authentifiée, jamais via une URL
  `/media/public/avatar` de profil utilisateur ; Web crée une URL blob locale
  et la révoque au démontage. Le membre peut voir, seul OWNER/ADMIN peut
  changer/retirer la photo. Aperçu accessible, Échap, confirmation KnowMe.
- L'écran Web groupe est désormais **deux colonnes sur desktop**, une colonne
  mobile : identité/photo et actions d'un côté, contenu organisé de l'autre.
- Tests API (appartenance, permissions, scan/owner/size) et Playwright (admin
  téléverse image analysée, membre voit la photo sans bouton modifier).

### Limites explicites à lever après fusion
- **La migration doit être appliquée sur le VPS** et la version API correspondante
  déployée ; Vercel READY à lui seul ne suffit pas. Ne pas prétendre que les
  utilisateurs peuvent modifier une photo avant cette preuve.
- L'écran natif Android et les avatars de la **liste de conversations et des
  en-têtes** n'affichent pas encore ce nouvel asset. Ils exigent le raccordement
  `GroupAvatarEditor` équivalent en React Native et un endpoint de résumé
  d'avatar dans le contrat de liste, avec cache invalidé en temps réel.
- Le modèle Prisma indépendant évite les conflits de schéma actifs et ne
  déclare pas de relation Prisma dans `Conversation` ou `MediaAsset` (fichiers
  détenus par des PR concurrentes). La migration **alignée sur ce modèle**
  installe des triggers PostgreSQL : validation de l'existence des deux
  références avec verrous `KEY SHARE` à chaque insertion/mise à jour,
  suppression atomique de l'avatar quand la conversation ou son média est
  supprimé. Les permissions et l'état de sécurité sont vérifiés de plus par
  l'API à chaque requête. **Limite :** ces triggers SQL, non modélisés par
  Prisma, exigent un test de migration PostgreSQL au déploiement.
- Une API existante sur ancien backend pourra retourner 404 : l'interface
  affiche alors un avatar par défaut et **n'affiche pas un faux bouton de
  changement** si le serveur ne déclare pas `canEdit`.
