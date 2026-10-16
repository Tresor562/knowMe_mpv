# KnowMe Phase 3E — lecture vocale dans les bulles Android

## Objectif
Un vocal Ogg/Opus reçu depuis une conversation doit pouvoir être écouté dans
KnowMe, sans lancer systématiquement le gestionnaire de fichiers.

## Ce qui est câblé
- Pour les médias `AUDIO` avec `mimeType=audio/ogg`, le contrôle
  compact **Écouter / Arrêter** est inséré dans la bulle.
- Tap explicite → `POST /media/:assetId/download-grant` (identité et
  droits conversation vérifiés par le serveur), puis téléchargement dans
  `cache/knowme-voice/*.ogg` privé.
- Lecture et arrêt via `KnowMeVoice` (lecteur MediaPlayer natif sécurisé).
- Chargement, erreur, réessayer et sortie de la conversation.
- Nettoyage du fichier temporaire à la destruction du composant ; pas
  d'appel de grant en défilant la liste des messages.
- Si l'APK ne dispose pas du nouveau module, ou pour WAV/MP3 historiques :
  le parcours Fichier compatible précédent reste disponible.

## Non couvert
- Progression exacte, barres audio, vitesse, pause/reprise, évènements de fin,
  playlists et transcription. Des API d'état de lecture et des contrôles
  natifs supplémentaires seront nécessaires pour les finaliser.
- WAV généré depuis le Web : non intégré au lecteur inline Ogg.
- Validation sur téléphone physique avec messages réellement reçus reste
  obligatoire avant communication de disponibilité finale.
