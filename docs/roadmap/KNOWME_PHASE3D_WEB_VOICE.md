# KnowMe Phase 3D — notes vocales Web

## Contrat livré dans cette tranche
- Bouton microphone visible sur l'écran de chat Web mobile et PC.
- Demande de permission au navigateur uniquement après action de l'utilisateur.
- Capture PCM dans le navigateur (AudioContext, ScriptProcessor en chemin de
  compatibilité), mono WAV 16 kHz / 16 bits ; 50 s maximum.
- Aucun upload pendant la capture : Terminer → lecture locale → Envoyer/Annuler.
- Envoi vers les mêmes endpoints que les médias classiques :
  `POST /media/uploads` avec jeton de transfert, visibility=CONVERSATION,
  puis `POST /conversations/:id/media-messages` kind=AUDIO.
- Contrôle côté serveur du MIME réel (RIFF/WAVE), limites et scanner.
- Suppression de la capture locale lors du changement de page ou annulation ;
  arrêt des pistes du microphone.
- Test unitaire du WAV produit et de ses métadonnées via `pnpm --filter
  @knowme/web test`.

## Limitations
- Web Audio ScriptProcessor est une solution de compatibilité dépréciée ;
  passer à AudioWorklet avec fallback après QA navigateur/CPU.
- Valider getUserMedia sur Chrome/Firefox/Safari/Android, permission refusée,
  navigateur interrompu, partage entre comptes, écoute du destinataire.
- Les anciens enregistrements Android sont Ogg/Opus ; le Web reste WAV pour
  partager le contrat déjà pris en charge sans modifier l'API.
- L'UX complète d'un vocal Telegram (gestes de verrouillage, ondes animées,
  transcription, écoute accélérée) appartient aux lots suivants.
