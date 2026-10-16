# KnowMe — Phase 3C : véritables interactions stickers Android

## Implémenté
- Le composer de conversation propose un bouton **Stickers** distinct des emojis
  et de la Galerie KnowMe.
- La liste des packs vient du véritable endpoint authentifié `GET /stickers/catalog` ;
  aucun catalogue inventé par le client.
- Tap sur un sticker dans la grille -> `POST /conversations/:conversationId/stickers`
  avec `packKey` et `stickerKey`, puis insertion dans le fil.
- Appui long dans le sélecteur -> aperçu/nom -> confirmation d'envoi.
- Les stickers du catalogue déjà reçus ouvrent un menu d'actions lorsqu'on les
  touche, notamment le partage du lien de leur message.
- Les stickers-image `STICKER_IMAGE` n'ouvrent plus directement la visionneuse
  d'une photo. Tap -> menu contextualisé Sticker KnowMe (agrandir, partager
  lien, informations) ; appui long -> agrandir directement.
- Les images ordinaires, GIF et autres pièces jointes conservent leurs actions
  spécifiques et leur confidentialité.

## À compléter
- Packs personnalisés, favoris persistants, marché de stickers, recherche et
  création de packs, téléchargement/installation de packs, ownership et
  restrictions de modification : routes et UI spécifiques encore requises.
- Les stickers de catalogue sont actuellement des glyphs visuels,
  pas des fichiers d'animation TGS/Lottie importés.
- Pas de faux bouton « enregistrer le pack » tant que le serveur ne stocke
  pas une bibliothèque de packs par utilisateur.

## Validation
1. Deux comptes : ouvrir les packs, envoyer un sticker et le recevoir dans
   la conversation; ouvrir le menu du sticker reçu.
2. Appuyer sur un sticker-image : options avant agrandissement ; appui long :
   visionneuse ; partage du lien d'un vrai asset.
3. Vérifier qu'une image ordinaire conserve son viewer, et qu'un sticker ne
   peut pas être envoyé dans une conversation dont l'utilisateur n'est pas membre.
4. Thèmes, petites largeurs, lecteurs d'écran, clavier et perte de réseau.
