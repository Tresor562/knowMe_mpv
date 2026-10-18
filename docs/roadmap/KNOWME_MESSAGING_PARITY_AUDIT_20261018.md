# KnowMe — audit Messagerie Telegram / WhatsApp (18 octobre 2026)
**Workstream : messaging #693 — plan de développement, PAS attestation de livraison.**
Références publiques officielles (consultées le 18/10/2026) :
- Telegram, formats & création : https://core.telegram.org/stickers ; https://telegram.org/blog/sticker-maker ; https://telegram.org/blog/video-stickers-better-reactions
- Telegram, options groupes : https://telegram.org/blog/permissions-groups-undo ; https://telegram.org/blog/silent-messages-slow-mode ; https://telegram.org/blog/topics-in-groups-collectible-usernames ; https://telegram.org/blog/voice-chats-on-steroids
- Telegram, bibliothèque stickers : https://telegram.org/blog/cache-and-stickers ; https://telegram.org/blog/trending-stickers
- WhatsApp, permissions administrateurs : https://faq.whatsapp.com/526742385997912/ ; invitations : https://faq.whatsapp.com/3242937609289432/
L'idée est **parité des capacités**, non copie des visuels, des marques ou du protocole propriétaire.

## Règles de livraison
Pour chaque fonction : (1) contrat serveur sécurisé, (2) Web, (3) Android, (4) validation API/intégration multi-comptes/appareils, (5) fusion, (6) déploiement vérifié. `PR fusionnée` ne prouve ni déploiement ni disponibilité APK. Les permissions doivent être décidées côté API, jamais seulement masquées en UI. Aucun bouton inerte ni faux statut « téléchargé ».

## P1 — lecture audio et indicateurs
- Barre de lecture discrète au-dessus de la conversation : source (conversation, émetteur), play/pause **SVG correct**, vraie progression seek, durée, X = arrêt libération. Audio reste actif pendant navigation dans les messages/conversations (sans arrêt induit par démontage d'une bulle). Un seul flux à la fois. Jouer le suivant en option, jamais par défaut pour vocaux privés.
- États : non téléchargé, téléchargement avec progression mesurée, disponible en cache, chargement, en lecture, en pause, terminé, en erreur, réessayer. Les libellés doivent refléter uniquement les données réelles.
- Lecture pause/reprise **sans remise au début**; seek (dont audio long), changement de vitesse, volume/périphérique quand disponibles, arrêt à sortie du compte, annulation/identité du flux, cleanup par éviction cache, taille contrôlée, grants privés.
- Constats : `ChatMediaAttachment.tsx` relance la lecture native à chaque appui et exécute `stopPlayback()` en guise de pause ; `useEffect` détruit fichier et lecture à la disparition de la bulle. Pas de lecteur partagé ni d'état cache exposé. `ChatMediaView.tsx` Web a un lecteur seulement local.

## P1 — présence conversationnelle
- `typing` (un ou plusieurs noms en groupe), `recording_voice`, `recording_video`, `uploading_media`, `choosing_sticker`; état visible dans l'entête du chat et dans la liste, expiration TTL, accessibilité et pluriels FR/EN, suppression à déconnexion. Pas de statut « prêt typing » ni de fausse détection de micro.
- Constats : Gateway reçoit `typing:start/stop` et émet `typing:update`; client Android et Web ont `typingUsers`, mais aucun mode voice, event TTL/état multi-activité. L'enregistreur Android et la capture Web ne publient pas d'état vocal.
- Éviter broadcast de présence en dehors des groupes dont l'émetteur est membre; contrôle d'accès systématique.

## P1 — fiche de groupe et sécurité admin
- Entête tappable : photo, nom, description, total membres à jour, en ligne, administrateurs, propriétaire, statut propre, médias communs, liens, fichiers, vocaux, recherche, notifications, partage, quitter, signaler, bloquer, effacer historique local.
- Gestion photo et description, rôles OWNER / ADMIN / MEMBER, promote/demote selon permissions, expulsion, demandes d'entrée, liens révocables (QR/lien expirant, limites), transfert de propriété explicite sécurisé, liste d'actions récentes, bannissement temporaire, sanctions, contrôle du risque d'auto-exclusion.
- Matrice modération (chaque règle à valider *serveur*): `send_text`, `send_media`, `send_stickers`, `send_gifs`, `send_voice`, `send_video`, `send_files`, `send_polls`, `add_members`, `edit_info`, `pin_messages`, `create_topics`, `manage_topics`, `send_links`, `mention_all`, `react`, `forward`, `save_media`, `delete_others`, `ban_members`, `manage_admins`, `start_voice_chat`; restrictions par membre, défauts par groupe, permissions de rôle. Modération bots, anti-spam et slow mode, contrôles admin.
- Threads/topics avec pins, votes sondages, messages silencieux/planifiés, tags des membres/admins, historique visible ou non aux nouveaux membres, discussions vocales et vidéo, participation à distance.
- Constats : `apps/api/src/messaging/group-management.controller.ts` et `service.ts` fournissent déjà GET/patch de nom+description, ajout d'amis, promotion (propriétaire seulement), retrait, règles sur les membres; `apps/web/app/messages/[id]/info/page.tsx` et `manage/page.tsx` existent, **mais pas de gestion fine des permissions, ni de photo, ni de matrice**, et la fiche Android n'est pas reliée à l'en-tête. Éviter de présenter le faux lien de chat comme invitation.

## P1/P2 — stickers : toutes les grandes capacités Telegram
- Formats : statiques PNG/WebP transparents, animés TGS/Lottie, vidéo WebM VP9 sans audio, emoji personnalisés, GIF ; validation de la taille/format, codecs compatibles, conversion sûre avec consentement (un fichier `.tgs` renommé n'est pas un WebP).
- Création depuis galerie/appareil ; suppression de fond, découpe, contour, dessin, légendes, superposition d'emoji/GIF; création/edit de pack avec nom et titre de sticker, associer 1+ emojis, ajouter/supprimer, dupliquer, déplacer, importer/exporter, partager via lien contrôlé, publier/dépublier, droits d'auteur, visibilité privé/public.
- Bibliothèque : recherche texte/mots clés/emoji, suggérés en saisissant un emoji, récents, favoris, installés, packs partagés, aperçu avant envoi (appui long), agrandir, sauvegarder sticker reçu, ajouter pack reçu, trier/réordonner, archiver/restaurer, détails auteur/pack, modération et signalement, statistiques quand disponibles.
- Dimensions affichées séparées : **vignette clavier <= 64–78 px**, bulle dans chat **<= 112–136 px**, vue détail dédiée zoomable; jamais 190–280 px dans une bulle normale. Adaptation petits écrans et accessibilité.
- Constats : `KnowStickerPackStore.ts` permet des packs WebP privés, `ChatExpressionKeyboard.tsx` expose récent, favoris, recherche et packs propriétaires; PR #735 prépare renommer. `ChatMediaAttachment.tsx` définit `sticker:{width:190,height:190}`, vue options `height:280`. Le statut `STICKER_IMAGE` est déjà transporté via API scanner. Aucun moteur TGS/VP9 ni synchronisation des stickers Telegram connectés : **à développer réellement, sans fausse importation**.

## Matrice de suivi (états observés au 18/10)
| Volet | Backend | Web | Android | Tests E2E |
|---|---|---|---|---|
| Audio vocal message | média sécurisé existant | lecteur local + PR #723 en attente | lecteur local + #706/#728 fusionnés | incomplet |
| Lecteur persistant | manquant session media | absent | absent | absent |
| Typing texte | gateway existe | partiel | partiel | partiel |
| Enregistrement vocal présence | absent | absent | absent | absent |
| Groupe info et membres | CRUD/rôles basiques | info/manage existants | fiche manquante | partiel |
| Groupe permissions fines | absent | absent | absent | absent |
| Stickers statiques personnels | envoi scanner média | limité | présent, taille trop grande | partiel |
| Stickers vidéo/animés personnalisés | conversion/contrat requis | absent | absent | absent |
| Packs découverte/partage/sauvegarde | contrat requis | partiel | partiel | absent |

**Interdépendances** : PR #723 (capture vocaux Web), #735 (renommage stickers) non fusionnées lors de l'audit. Ne modifier ni leur diff ni le domaine Infrastructure/Design sans coordination.
