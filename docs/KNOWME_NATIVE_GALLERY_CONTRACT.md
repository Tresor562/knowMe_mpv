# Galerie native KnowMe — contrat d'intégration Android

## Source unique
- UI : `apps/mobile/src/AndroidMediaLibraryPicker.tsx` (écran plein format KnowMe).
- Sélection/pagination : `apps/mobile/src/gallery-selection-model.ts`.
- Bridge Android : `apps/mobile/src/native-gallery.ts` et le module MediaStore du plugin `with-knowme-gallery.cjs`.
- Album, filtres Photos/Vidéos, miniatures, aperçu par appui long, sélection multiple ordonnée, suppression d'un média sélectionné, confirmation.
- La galerie lit uniquement les médias visibles par KnowMe avec les permissions Android ; aucune copie ni upload tant que la sélection n'a pas été validée par le parcours appelant.

## Entrées connectées
| Usage | Écran Android | Sélection autorisée |
| --- | --- | --- |
| Publication | `FeedExperience` | Une photo (contrat actuel du post) |
| Story | `StoriesRail` | Une photo ou une vidéo, filtre adapté au mode |
| Message privé / groupe | `ChatMediaPicker` → `RealtimeMessagesPanel` | Plusieurs photos/vidéos, envoi après confirmation, limite actuelle de 10 |
| Avatar | `MobileAvatarQuickActions` | Une photo |
| Couverture de profil | `ProfileExperience` | Une photo |

**Fichiers, APK, PDF et pistes audio** : le gestionnaire de fichiers Android reste distinct et ne remplace pas la grille de la galerie multimédia KnowMe.

## Fiabilité et permissions
- Accès aux photos seulement pour avatar, couverture et publication (sans réclamer automatiquement la permission vidéos).
- Accès aux images et vidéos pour messages et choix vidéo de story.
- Aucun transfert implicite des médias non sélectionnés.
- Le changement d'album, de filtre et de page ne doit pas effacer la sélection ; la fermeture/réouverture repart sans sélection.
- Ignorer les réponses asynchrones de pagination d'un album quitté.
- Afficher un état explicite si la permission est refusée ou le module natif n'est pas intégré dans l'APK.
- Les médias envoyés restent soumis aux règles MIME, taille, scanner et confidentialité du serveur. Une sélection galerie ne prouve pas la réussite d'un upload.

## Recette avant release
1. Android 13, 14 et 15 si disponibles : autorisation complète, partielle et refusée ; vérifier accès aux albums réellement accordés et Settings.
2. Sélectionner des images dans deux albums différents depuis une conversation ; vérifier le compteur, l'ordre, la suppression et l'envoi réel de chaque média.
3. Publication : photo visible dans l'éditeur, confirmation, upload et consultation par un autre compte autorisé.
4. Story : choix PHOTO, choix VIDEO, galerie respectivement filtrée, publication, lecture après publication.
5. Avatar et couverture : ne pas voir de demande de permission vidéo inutile ; upload réel et affichage après reconnexion.
6. Système clair, sombre, AMOLED, français et anglais, accessibilité tactile et appui long, fermeture par retour Android.
7. Vérifier l'APK sur téléphone physique et sa signature/version avant distribution ; le module Kotlin/Java est intégré au moment du build natif et **ne peut pas être ajouté à un ancien APK par une simple mise à jour Web ou OTA JS**.

## État et limitations connues
- La sélection multiple est activée pour les messages ; posts et stories restent limités à un média par publication dans les API et UI existantes. Une évolution serveur est nécessaire pour des albums par publication.
- L'aperçu vidéo natif dans la galerie est actuellement une miniature ; le lecteur vidéo complet est dans les parcours qui consomment le fichier. Ne pas présenter la prévisualisation vidéo comme entièrement livrée.
- La galerie a son propre visuel ; elle n'utilise pas les écrans de sélection photo tiers. Le gestionnaire de fichiers Android est toujours utilisé pour les documents.
- Validation manuelle, CI, build signé et distribution sont des étapes distinctes. Aucun déploiement Android n'est prouvé par le code source seul.
