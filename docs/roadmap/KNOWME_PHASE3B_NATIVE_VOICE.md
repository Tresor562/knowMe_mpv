# KnowMe — Phase 3B : notes vocales Android

## Portée
Enregistrer de vrais messages audio dans une conversation existante, plutôt que
demander à l'utilisateur de trouver un fichier dans son téléphone.

## Circuit d'envoi
1. Le bouton Micro est affiché à côté des pièces jointes, dans la zone de
   composition de la conversation.
2. L'utilisateur donne l'autorisation Android RECORD_AUDIO au moment de l'usage.
3. Le module natif KnowMeVoice capture du mono Ogg/Opus dans le cache privé de
   l'application ; aucun média n'est envoyé pendant l'enregistrement.
4. Terminer -> prévisualisation et écoute facultative -> Envoyer ou Annuler.
5. Envoyer rejoint exactement le circuit existant du chat :
   `POST /media/uploads` avec conversation et visibilité `CONVERSATION`,
   transfert du fichier, vérification MIME par signature Ogg/Opus, scan
   obligatoire, puis `POST /conversations/:id/media-messages` kind `AUDIO`.
6. Annuler ou succès -> nettoyage du cache provisoire. Le serveur reste
   responsable de l'accès, de l'intégrité et du téléchargement par le destinataire.

## Compatibilité et règles de sécurité
- Android 10+ (API 29+) ; demande micro au premier usage et refus compréhensible.
- Durée de prise de son plafonnée à 56 secondes dans l'interface, 60 secondes
  maximum dans le module natif. Un format Ogg/Opus compatible doit exister.
- Pas de stockage sur carte SD ni galerie, pas de permission pour explorer les
  autres fichiers. La prévisualisation native ne peut ouvrir que le répertoire
  `cache/knowme-voice/*.ogg` appartenant à l'application.
- Le module est compilé dans l'APK par `with-knowme-voice.cjs`. Une mise à
  jour JavaScript de l'ancienne APK ne peut pas ajouter cette permission/module.
- Les messages reçus utilisent le contrat `AUDIO` et le visualiseur média
  existant ; le lecteur audio intégré dans la bulle reste un chantier ultérieur.

## Validation obligatoire avant déclaration « fonctionne »
- Tests du plugin Android (injection idempotente Kotlin/Java, RECORD_AUDIO,
  absence de permission large et cache privé).
- Compilation TypeScript, compilation Java/Gradle de l'APK et tests serveur.
- Téléphone physique Android 10/13/14/15 si disponible : micro autorisé/refusé,
  enregistrement court, 56s, annulation, sortie du chat, lecteur local.
- Test entre deux comptes avec scan média : upload audio Ogg/Opus, réception,
  téléchargement et écoute sur le deuxième compte, refus de conversation
  hors-membre, comportement hors ligne et reprise contrôlée.
- La signature/versionCode de distribution doit correspondre à l'application
  installée pour déclencher une mise à jour compatible.

## Suite phase 3
Ajouter le véritable lecteur audio intégré aux bulles, la transcription,
ondes/gestes de verrouillage, notes vidéo, et les menus contextuels de stickers
avec packs. Ces fonctionnalités ne sont pas validées par cette seule PR.
