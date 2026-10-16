# KnowMe — Phase 2A : création publication, stories et menus Android

## Objectif
Respecter le parcours réel de création de publications et de stories de KnowMe,
sans remplacer les écrans par de simples formulaires ni exposer des outils non
reliés au backend.

## Fonctionnel implémenté
- Le bouton `Créer → Publication` de l'APK ouvre la page plein écran.
- La ligne de création rapide de l'Accueil ouvre ce même éditeur.
- Identité de l'utilisateur, visibilité publique actuelle de `POST /posts`,
  saisie limitée à 2000 caractères, retour en conservant le brouillon local,
  publication et appel d'upload de photo avec la galerie KnowMe existante.
- Le bouton Mentionner insère `@` dans la rédaction et focalise le champ ;
  les mentions existantes restent résolues par la vue des contenus.
- La galerie native est extérieure à l'éditeur : elle peut être ouverte puis
  l'éditeur reprend avec la photo choisie.
- Bouton `⋯` sur chaque publication du fil : ouvrir, partager, supprimer
  pour l'auteur, annuler. Utilise les fenêtres KnowMe et les permissions du
  serveur (`DELETE /posts/:id`).
- Stories : le petit popup de création devient une page plein écran scrollable,
  avec Texte, Photo, Vidéo, galerie, aperçu du média retenu, audience et partage.

## Non implémenté dans cette phase
- `POST /posts` actuel ne propose que texte et une photo média : l'audience
  est publiquement fixée, pas d'invention de contrôles Public/Amis/Privé.
- Musique, événements, sondages, multi médias, localisations, identification
  avancée, vidéo en publication exigent contrats serveur et UX dédiés.
- Caméra, musique et éditeur de story enrichi à terminer dans la phase 2B.
- Pas d'affirmation de livraison sur l'APK installée avant build signé compatible,
  vérifications et publication de release.

## Scénarios d'acceptation
1. Accueil → Création rapide → éditeur, retour → texte conservé → retour éditeur.
2. Dock → Créer → Publication → éditeur, photo choisie par Galerie KnowMe,
   retour à l'éditeur → aperçu photo → publication réelle → post dans le fil.
3. Publication d'un autre utilisateur → `⋯` n'affiche pas Supprimer.
4. Ma publication → `⋯` → Supprimer → confirmation KnowMe → suppression serveur.
5. Story → Créer → Photo, Vidéo, Texte → galerie adaptée → aperçu → partage →
   consultation depuis un autre compte autorisé.
6. Clavier, menus, état hors réseau et erreurs d'upload, thèmes clair et sombre,
   téléphones 320–430 dp et retour Android.
