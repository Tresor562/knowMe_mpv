# KnowMe — PARITÉ TOTALE Messagerie privée + Groupes + Communautés
**Version de référence : 18 octobre 2026.** Repo `Tresor562/knowMe_mpv`, branche Design `chat/design/group-info-shared-content`.

> Ce document est un **inventaire des capacités à obtenir**, pas la preuve que Telegram et WhatsApp ont été copiés, ni que KnowMe les possède déjà. Les deux produits changent régulièrement, parfois selon pays/appareil/version. Les fonctions incompatibles doivent avoir des modes explicites (par exemple « chat secret » Telegram et E2EE par défaut WhatsApp). Ne pas promettre « 100 % » avant une validation item par item sur Web et APK.

## Règles de vérité
1. **SCOPE** : P = privé, G = groupe, C = communauté/canal, P/G = commun.
2. **STATUT INITIAL** : *À auditer* pour toute ligne de ce catalogue. « Existe dans le code » n'est pas la même chose que « fonctionne sur Android/Web » ; ne jamais générer de badge « livré » automatiquement à partir de ce document.
3. **Critères de terminé pour CHAQUE ID** : logique serveur et schéma appropriés, auth/permissions, événements temps réel si nécessaires, UX Web et Android montées, gestion erreur/hors-ligne/chargement/accessibilité, tests unitaires + intégration + E2E, QA sur appareils réels, preuve de déploiement + version, rollback et non-régression. Pour E2EE, audit indépendant + preuve sécurité.
4. Le *design* peut rendre visible une capacité existante ; les autres domaines possèdent le contrat métier. Toute dépendance croisée doit être une PR isolée, validée par le garde de coordination.
5. Remplacer les marques et contenus protégés par l'identité originale KnowMe ; égaler l'utilité et qualité, sans copier logos/codes ni inventer disponibilité universelle.

## Matrice exhaustive par domaines

### 01. Identité et accès aux discussions
**Portée par défaut :** P/G. **Domaine responsable :** profiles.

| ID | Capacité à livrer | Preuve attendue | État |
|---|---|---|---|
| `KM-COMM-01-001` | Créer un chat privé par @username | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-01-002` | Trouver un contact sans divulguer le numéro | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-01-003` | Demander l'autorisation pour message d'un inconnu | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-01-004` | Bloquer/débloquer, signaler le spam, masquer contact | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-01-005` | Épingler une discussion, désépingler, ordonner | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-01-006` | Archiver/désarchiver, conserver archivé | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-01-007` | Dossiers et filtres de discussions personnalisés | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-01-008` | Filtres Tous/Non lus/Groupes/Privés/Bots/Canaux | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-01-009` | Favoris et favoris synchronisés | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-01-010` | Plusieurs comptes et commutation rapide | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-01-011` | Appareils connectés et révocation par appareil | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-01-012` | Reprendre historique de plusieurs appareils | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-01-013` | Discussion Mes messages enregistrés | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-01-014` | Enregistrer un message, tags et dossiers de favoris | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-01-015` | Importer/exporter discussion et média avec consentement | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-01-016` | Supprimer le chat local et choisir suppression partagée | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-01-017` | Effacer l'historique et choisir portée exacte | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-01-018` | Verrouiller une discussion par code/biométrie | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-01-019` | Masquer une discussion verrouillée via code secret | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-01-020` | Réinitialiser les discussions sans supprimer le compte | API+Web+APK+tests+CI+déploiement | À auditer |

### 02. Historique et lecture
**Portée par défaut :** P/G. **Domaine responsable :** messaging.

| ID | Capacité à livrer | Preuve attendue | État |
|---|---|---|---|
| `KM-COMM-02-001` | Historique paginé en arrière sans doublons | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-02-002` | Aller à une date dans une conversation | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-02-003` | Rechercher par texte, participant, date, type de média | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-02-004` | Afficher les résultats triés sans faux positifs | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-02-005` | Recherche globale inter-conversations respectant permissions | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-02-006` | Recherche dans les messages épinglés/sauvegardés | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-02-007` | Filtrer liens/fichiers/photos/vidéos/audio/GIF/stickers | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-02-008` | Aller au message original via deep-link avec surlignage | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-02-009` | État envoyé/reçu/lu avec horodatage réel | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-02-010` | Confidentialité des accusés et exceptions de groupe | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-02-011` | Heure de lecture et statut livré sur chaque appareil | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-02-012` | Indicateur d'écriture et d'enregistrement audio/vidéo | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-02-013` | Présence en ligne / dernière connexion selon visibilité | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-02-014` | Participants lisant un message de groupe, selon droits | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-02-015` | Messages masqués/supprimés sans fuite dans recherche/cache | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-02-016` | Historique des nouveaux membres selon permission | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-02-017` | Téléchargement progressif et cache hors ligne | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-02-018` | Brouillons persistés, séparés par compte et discussion | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-02-019` | Navigation par clavier, lecteur écran et recherche | API+Web+APK+tests+CI+déploiement | À auditer |

### 03. Composition du texte
**Portée par défaut :** P/G. **Domaine responsable :** messaging.

| ID | Capacité à livrer | Preuve attendue | État |
|---|---|---|---|
| `KM-COMM-03-001` | Composer extensible qui suit le clavier Android | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-03-002` | Texte Unicode, lignes, emoji et longues publications | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-03-003` | Gras/italique/souligné/barré/monospace/spoiler | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-03-004` | Citation, blocs de code, liens cliquables sûrs | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-03-005` | Éditeur riche avec titres, tableaux, listes | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-03-006` | Texte enrichi avec images et documents inline | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-03-007` | Mentions @username avec suggestion et autorisation | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-03-008` | Hashtags et autocollants de texte | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-03-009` | Aperçu du lien avec option de désactivation | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-03-010` | Prévisualiser/modifier le brouillon avant envoi | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-03-011` | Envoyer par Entrée optionnel, Shift+Entrée pour saut | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-03-012` | Messages silencieux sans notification | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-03-013` | Message programmé avec date/fuseau | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-03-014` | Message répété ou périodique autorisé | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-03-015` | Rappel sur message et rendez-vous | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-03-016` | Envoyer quand destinataire en ligne avec confidentialité | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-03-017` | Corriger orthographe/traduire avant envoi (opt-in) | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-03-018` | Réponses automatiques et raccourcis personnalisés | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-03-019` | Mode lent sur groupe appliqué au serveur | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-03-020` | Brouillon hors ligne avec envoi différé explicite | API+Web+APK+tests+CI+déploiement | À auditer |

### 04. Actions sur messages
**Portée par défaut :** P/G. **Domaine responsable :** messaging.

| ID | Capacité à livrer | Preuve attendue | État |
|---|---|---|---|
| `KM-COMM-04-001` | Répondre avec citation et aperçu | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-04-002` | Répondre à plusieurs messages | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-04-003` | Répondre en privé depuis un groupe | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-04-004` | Modifier dans la fenêtre de validité | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-04-005` | Afficher étiquette et historique de modification selon politique | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-04-006` | Supprimer pour moi | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-04-007` | Supprimer pour tous avec droits/délais serveur | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-04-008` | Sélection multiple, supprimer ou transférer en lot | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-04-009` | Copier texte, lien permanent ou ID contextualisé | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-04-010` | Partager dans autre chat, canal, Story, publication KnowMe | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-04-011` | Transférer avec/sans attribution selon droits | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-04-012` | Restreindre téléchargement et transfert à la source | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-04-013` | Épingler et gérer plusieurs messages épinglés | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-04-014` | Traduire un message en respectant confidentialité | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-04-015` | Transcription vocale/audio/vidéo | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-04-016` | Réagir par emoji, changer ou retirer une réaction | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-04-017` | Double-taper pour réaction rapide configurable | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-04-018` | Animations/effets de message avec option réduire animations | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-04-019` | Sondages liés au message et résultat | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-04-020` | Signaler un message sans divulgation du plaignant | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-04-021` | Marquer non lu, aller au prochain non lu | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-04-022` | Favoris, étiquettes, rappel personnel sur message | API+Web+APK+tests+CI+déploiement | À auditer |

### 05. Médias et fichiers
**Portée par défaut :** P/G. **Domaine responsable :** messaging.

| ID | Capacité à livrer | Preuve attendue | État |
|---|---|---|---|
| `KM-COMM-05-001` | Envoyer images, vidéos et albums multi-sélection | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-05-002` | Composition collage, ordre, légendes par média | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-05-003` | Photo HD et fichier original sans réencodage forcé | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-05-004` | Photos animées (Live/Motion) lorsque prise en charge | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-05-005` | Partager photo/vidéo instantanée depuis caméra | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-05-006` | Éditeur image/vidéo (crop, rotation, dessin, texte) | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-05-007` | Documents tout format avec validation MIME | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-05-008` | Documents volumineux avec upload découpé et reprise | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-05-009` | Annuler/reprendre téléchargement et indicateur téléchargé | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-05-010` | Gestionnaire de cache quota et nettoyage ciblé | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-05-011` | Visionneuse médias plein écran avec galerie et balayage | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-05-012` | Afficher le média une seule fois puis le supprimer selon contrat | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-05-013` | Empêcher le partage si autorisé (limites OS explicites) | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-05-014` | Document scanning Android et export PDF | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-05-015` | Prévisualisation PDF/audio/video/archives autorisée | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-05-016` | Liens publics filtrés anti-redirection/anti-malware | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-05-017` | Localisation actuelle et partage temps réel révocable | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-05-018` | Cartes de contact/vCard avec consentement | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-05-019` | Envoyer musique, voix et pièces jointes multiples | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-05-020` | Diffusion média écran/TV et PiP si compatible | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-05-021` | Lecture vidéo longue et changement de vitesse | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-05-022` | Sous-titres/captions et traduction à la demande | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-05-023` | Nom de fichier, taille, progression et statut exact | API+Web+APK+tests+CI+déploiement | À auditer |

### 06. Audios et vidéos courts
**Portée par défaut :** P/G. **Domaine responsable :** messaging.

| ID | Capacité à livrer | Preuve attendue | État |
|---|---|---|---|
| `KM-COMM-06-001` | Enregistrer vocal avec glissement verrouiller/annuler | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-06-002` | Écoute pré-envoi avec forme d'onde | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-06-003` | Pause/reprise enregistrement et couper segment | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-06-004` | Trimmer et couper un vocal avant envoi | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-06-005` | Envoyer note vidéo circulaire | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-06-006` | Modifier vitesse de lecture 0.5× à 2× | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-06-007` | Reprendre l'audio pendant navigation globale | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-06-008` | Mini-lecteur audio persistant avec origine/progression/fermer | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-06-009` | Transcription locale/serveur selon confidentialité | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-06-010` | Changement voix/effets avec consentement | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-06-011` | Audio à lecture unique | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-06-012` | Afficher téléchargement de l'audio hors réseau | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-06-013` | Écouter audio avec sortie oreillette ou haut-parleur | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-06-014` | Éliminer double action envoyer/annuler/confusion tactile | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-06-015` | Lecture continue dans discussion avec commandes média OS | API+Web+APK+tests+CI+déploiement | À auditer |

### 07. Emojis, GIF, stickers et réactions
**Portée par défaut :** P/G. **Domaine responsable :** messaging.

| ID | Capacité à livrer | Preuve attendue | État |
|---|---|---|---|
| `KM-COMM-07-001` | Clavier emoji Unicode complet et recherche | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-07-002` | Emojis fréquents, favoris, teint de peau, variantes | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-07-003` | Emojis et stickers animés propres à KnowMe | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-07-004` | Panneau emoji/sticker/GIF attaché au composer | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-07-005` | GIF rechercher, prévisualiser, envoyer, favoris | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-07-006` | Créer sticker image/vidéo/animé depuis photo ou texte | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-07-007` | Retirer fond, recadrer et nommer stickers | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-07-008` | Créer/renommer/supprimer/partager packs KnowSticker | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-07-009` | Import Telegram TGS/WebM/WebP vers format KnowSticker | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-07-010` | Pack personnel synchronisé sur tous appareils | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-07-011` | Partage de pack dans une conversation | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-07-012` | Étoiles/commandes de stickers via bots autorisés | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-07-013` | Réactions multiples avec comptages et liste participants | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-07-014` | Retrait réaction par second appui et état persistant | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-07-015` | Préférences d'animations et mouvement réduit | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-07-016` | Prise en charge de stickers/d'emoji personnalisés dans bio/profil | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-07-017` | Recherche et index de milliers de packs | API+Web+APK+tests+CI+déploiement | À auditer |

### 08. Notifications
**Portée par défaut :** P/G. **Domaine responsable :** infra.

| ID | Capacité à livrer | Preuve attendue | État |
|---|---|---|---|
| `KM-COMM-08-001` | Notification en application et push système Android | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-08-002` | Compteurs exacts non lus par chat et total | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-08-003` | Son, vibration, bannière et badge par conversation | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-08-004` | Sourdine de groupe, durée personnalisée, silence permanent | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-08-005` | Notifications mentions et réponses même si le groupe est muet selon choix | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-08-006` | Réglages de notifications @all distinctes | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-08-007` | Heures silencieuses et fuseaux | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-08-008` | Périodes résumé horaire/journalier sans heads-up | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-08-009` | Messages de contacts favoris prioritaires avec consentement | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-08-010` | Aperçu masqué sur écran verrouillé | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-08-011` | Sons personnalisés et exceptions par type de contenu | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-08-012` | Silence des appels d'inconnus et demandes spam | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-08-013` | Notification publication de créateur suivi | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-08-014` | Synchronisation état lu entre appareils | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-08-015` | Effacement exact d'une notification sans perdre le compteur | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-08-016` | Notifications de sécurité, connexion, appareils, changement de rôles | API+Web+APK+tests+CI+déploiement | À auditer |

### 09. Vie privée et sécurité
**Portée par défaut :** P/G. **Domaine responsable :** infra.

| ID | Capacité à livrer | Preuve attendue | État |
|---|---|---|---|
| `KM-COMM-09-001` | Authentification passkey et biométrie optionnelle | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-09-002` | Chiffrement en transit et au repos démontré | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-09-003` | E2EE réel avec protocole audité, rotation clés et vérification | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-09-004` | Distinguer Cloud chats et chats secrets si architectures diffèrent | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-09-005` | Messages privés E2EE par défaut seulement si effectivement implémenté | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-09-006` | Sauvegarde chiffrée bout à bout avec clés sous contrôle de l'utilisateur | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-09-007` | Export/portabilité cryptographiquement protégés | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-09-008` | Messages éphémères 24h/7j/90j et plages personnalisées | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-09-009` | Photos, vidéos et audios à vue/écoute unique | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-09-010` | Blocage captures pour médias sensibles si OS le permet | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-09-011` | Vérification d'empreinte/safety number et alertes clés | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-09-012` | Suppression appareil à distance et purge des clés locales | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-09-013` | Limiter téléchargement auto venant d'inconnus | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-09-014` | Paramètres confidentialité renforcés et protection anti-hameçonnage | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-09-015` | Visibilité avatar/about/presence/statut/lectures contrôlée | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-09-016` | Désactiver prévisualisation liens et collecte métadonnées | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-09-017` | Secret code/Chat lock et notifications neutres | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-09-018` | Filtrage contre tracking via URLs externes | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-09-019` | Détection de groupes inconnus et consentement à l'ajout | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-09-020` | Rapports abus avec collecte minimale | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-09-021` | Protection jeunes utilisateurs, contenu et signalement | API+Web+APK+tests+CI+déploiement | À auditer |

### 10. Appels privés et groupe
**Portée par défaut :** P/G. **Domaine responsable :** messaging.

| ID | Capacité à livrer | Preuve attendue | État |
|---|---|---|---|
| `KM-COMM-10-001` | Appels audio privés | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-10-002` | Appels vidéo privés | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-10-003` | Appels de groupe audio et vidéo | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-10-004` | Inviter et retirer de la salle avec permissions | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-10-005` | Liens d'appel révocables et salles d'attente | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-10-006` | Transfert d'appel en direct mobile vers desktop/Web | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-10-007` | Partage d'écran avec sélection et autorisation OS | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-10-008` | Mosaïque des participants et orateur actif | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-10-009` | Lever la main et demande de parole | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-10-010` | Mute audio/vidéo, caméra avant/arrière, haut-parleur | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-10-011` | Participants rejoignent/quittent sans couper l'appel | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-10-012` | Réseau instable, reconnexion, écho/suppression de bruit | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-10-013` | Arrière-plans vidéo et effets consentis | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-10-014` | Réactions/commentaires en direct dans appel | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-10-015` | Enregistrement avec avertissement explicite et consentement | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-10-016` | Transcription et résumé opt-in, politique de rétention | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-10-017` | Appels programmés et rappels | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-10-018` | Chiffrement des appels/gestion clés audités | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-10-019` | Historique des appels et blocage numéros inconnus | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-10-020` | PiP pendant navigation/usage d'autres écrans | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-10-021` | Modération, fin pour tous, expulsions en appel | API+Web+APK+tests+CI+déploiement | À auditer |

### 11. Groupes et administration
**Portée par défaut :** G. **Domaine responsable :** messaging.

| ID | Capacité à livrer | Preuve attendue | État |
|---|---|---|---|
| `KM-COMM-11-001` | Créer groupe depuis contacts/amitiés autorisés | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-002` | Rôles propriétaire/admin/membre et titres individuels | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-003` | Transfert atomique de propriété | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-004` | Promouvoir/dégrader admins avec droits granulaires | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-005` | Ajouter/retirer/bannir/débannir membre avec audit | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-006` | Permissions par type de message et de média | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-007` | Restreindre un membre temporairement ou définitivement | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-008` | Mode annonces seuls admins publient | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-009` | Paramétrer qui peut éditer nom, photo, description | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-010` | Liens d'invitation revocables avec expiration/quota | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-011` | QR d'invitation et approbation d'accès | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-012` | Demande d'adhésion avec file acceptée/refusée | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-013` | Choix visibilité publique/privée et découverte | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-014` | Liste membres paginée et recherche filtrée | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-015` | Historique visible selon date d'entrée et réglages | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-016` | Limiter ajouts par inconnus avec écran sécurité | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-017` | Actions admin récentes et annulation quand permise | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-018` | Mode lent et contrôle flood/rate-limit par utilisateur | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-019` | Anti-spam, règles de langue/liens/bots, liste mots interdits | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-020` | Signalements, sanctions, délai appel de sanction | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-021` | Messages épinglés multiples et annonces | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-022` | Mentions @tous avec droits et option mute | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-023` | Tag auto-personnalisable membre et administration tags | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-024` | Sujets distincts, lecture, médias, épingles et notific par sujet | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-025` | Message de bienvenue nouveau membre uniquement | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-026` | Personnalisation groupe fond/logo/emoji pack | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-027` | Recherche groupe et export participants sous consentement | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-028` | Journaux d'accès et audit protégés | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-029` | Échelle grands groupes au-delà de limite actuelle de 100 | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-030` | Départ silencieux et restrictions du propriétaire | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-031` | Photos/video de groupe, descriptions, liens externes | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-11-032` | Automatisation bots avec limitation accès messages | API+Web+APK+tests+CI+déploiement | À auditer |

### 12. Sondages, événements, interactions
**Portée par défaut :** G. **Domaine responsable :** messaging.

| ID | Capacité à livrer | Preuve attendue | État |
|---|---|---|---|
| `KM-COMM-12-001` | Sondage simple, multichoix et quiz | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-12-002` | Date clôture du vote côté serveur | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-12-003` | Vote anonyme et présentation des résultats | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-12-004` | Éditer question dans une fenêtre limitée et auditée | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-12-005` | Vote horodaté quand option activée | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-12-006` | Recompter résultats sans double vote (concurrence) | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-12-007` | Créer événement avec heure/fuseau et emplacement | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-12-008` | RSVP Oui/Non/Peut-être, suivi des réponses | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-12-009` | Rappel événement configurable | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-12-010` | Ajouter événement de groupe à calendrier avec permission | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-12-011` | Notes de réunion et liste de tâches collaborative | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-12-012` | Création de sous-groupe à partir de membres avec consentement | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-12-013` | Rejoindre salon vocal événementiel temporaire | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-12-014` | Interaction boutons inline avec callbacks idempotents | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-12-015` | Bots silencieux avec réponses visibles seulement par demandeur | API+Web+APK+tests+CI+déploiement | À auditer |

### 13. Communautés, canaux et diffusion
**Portée par défaut :** G/C. **Domaine responsable :** social.

| ID | Capacité à livrer | Preuve attendue | État |
|---|---|---|---|
| `KM-COMM-13-001` | Créer communauté parent avec groupes/chaînes/bots | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-13-002` | Associer/dissocier plusieurs groupes à communauté | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-13-003` | Espaces visibles / cachés selon rôle | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-13-004` | Flux d'annonces inter-groupes opt-in | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-13-005` | Gestion des administrateurs à chaque niveau | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-13-006` | Flux de messages directs pour créateurs/canaux | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-13-007` | Rejoindre des espaces enfants depuis la communauté | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-13-008` | Groupes de discussion reliés aux canaux | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-13-009` | Stories/status de groupes et de canaux | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-13-010` | Notifications groupées par communauté | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-13-011` | Listes de diffusion privées avec destinataires consentants | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-13-012` | Commenter publications de canal avec modération | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-13-013` | Bot de communauté sous confidentialité par défaut | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-13-014` | Recherche dans canaux publics / tags | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-13-015` | Intégration KnowMe publications, marketplace, réels et stories | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-13-016` | Paramètres de monetisation/contributions sans bloquer protections | API+Web+APK+tests+CI+déploiement | À auditer |

### 14. Bots, IA et mini-apps
**Portée par défaut :** P/G. **Domaine responsable :** messaging.

| ID | Capacité à livrer | Preuve attendue | État |
|---|---|---|---|
| `KM-COMM-14-001` | Bot public/privé avec commandes contextuelles | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-14-002` | Mode confidentialité bot groupe par défaut | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-14-003` | Permissions et consentement granularisés par bot | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-14-004` | Boutons inline et menus claviers de bot | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-14-005` | Réponse éphémère visible uniquement au demandeur | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-14-006` | AI admin assistants sous supervision humaine | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-14-007` | Mini-app Web sécurisée ouverte depuis chat | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-14-008` | Droits mini-app caméra/photos/contact avec permission | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-14-009` | Bots appels API et stockage par scopé et quotas | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-14-010` | Bot de traduction et résumé opt-in | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-14-011` | IA mentionnable dans groupe, réponse contextualisée consentie | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-14-012` | AI sidechat/incognito à données éphémères sans surpromesse | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-14-013` | Webhook signatures, replay protection, idempotence | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-14-014` | Gestion liste bots et déconnexion/revocation | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-14-015` | Export/prompts partageables sans exposer données privées | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-14-016` | Automatisations welcome/goodbye, rappels, auto-modération | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-14-017` | Agents IA invités et contrôle de confidentialité | API+Web+APK+tests+CI+déploiement | À auditer |

### 15. Organisation, apparence et accessibilité
**Portée par défaut :** P/G. **Domaine responsable :** design.

| ID | Capacité à livrer | Preuve attendue | État |
|---|---|---|---|
| `KM-COMM-15-001` | Navigation mobile split master/detail desktop | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-15-002` | Liste compacte avatar nom extrait heure non lus | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-15-003` | Swipe actions archiver/mute/pin/supprimer | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-15-004` | Gestes appui long sélections et context menus | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-15-005` | Réglage fond/theme par chat et synchronisation | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-15-006` | Light/Dark/AMOLED, contraste et réduction flou | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-15-007` | Reduce Motion sur stickers/animations et appels | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-15-008` | Animations 60fps sans gêner lecture | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-15-009` | Accessibilité claviers externe/lecteurs d'écran | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-15-010` | Sélecteur média natif Android photos/vidéos multi | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-15-011` | Envoi/annuler avec cibles 44–48dp distinctes | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-15-012` | Navigation focus stable après dialog/popup | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-15-013` | FR/EN y compris infobulles et erreurs | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-15-014` | Adaptation tablette et landscape | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-15-015` | Notifications discrètes sans masquer composer | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-15-016` | Sans gros boutons ni fausses actions marketing | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-15-017` | Skeleton chargement, états vides/hors ligne/perdu | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-15-018` | Galerie intégrée, téléchargement et progression | API+Web+APK+tests+CI+déploiement | À auditer |

### 16. Sauvegarde, stockage et synchronisation
**Portée par défaut :** P/G. **Domaine responsable :** infra.

| ID | Capacité à livrer | Preuve attendue | État |
|---|---|---|---|
| `KM-COMM-16-001` | Stockage médias privé avec grants courts et audit | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-16-002` | Téléchargement en arrière-plan/reprise après interruption | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-16-003` | Protection antimalware sur documents et ZIP | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-16-004` | Effacer médias sélectionnés sans supprimer le chat | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-16-005` | Synchronisation multi-appareils cohérente avec idempotence | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-16-006` | Sauvegarde chiffrée avec rétention/rotation et récupération | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-16-007` | Synchroniser brouillons, médias téléchargés et recherches | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-16-008` | Expirer/fixer TTL par chat et conforme au droit | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-16-009` | Optimiser usage batterie/réseau mobile faible | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-16-010` | Messages vus hors ligne puis états lus synchronisés | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-16-011` | Web push, FCM optionnel, alternative VPS selon choix | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-16-012` | OTA code/polices/config sans contournement sécurité store | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-16-013` | Export historique format ouvert sans leak d'autres membres | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-16-014` | Importer WhatsApp/Telegram via données légalement obtenues avec consentement | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-16-015` | Droit à l'effacement et purge caches/backups selon politique | API+Web+APK+tests+CI+déploiement | À auditer |
| `KM-COMM-16-016` | Médias de plusieurs Go avec streaming/résumable réel | API+Web+APK+tests+CI+déploiement | À auditer |

## Tranches d'exécution et dépendances
**Lot 0 — fiabilité/permissions :** réparer la CI des PR #762 et #754, maintenir les contrôles anti-chevauchement, vérifier le centre de notifications et déployer seulement sur checks verts.
**Lot 1 — cœur privé et groupe :** composer, états, réponses/édition/suppression/transfert, albums médias, fichiers, recherche, informations privées et groupes, accès « Voir message », claviers emoji/stickers et vocal.
**Lot 2 — sécurité des conversations :** blocages/spam, vie privée, E2EE auditée, sauvegardes chiffrées et protections « vue unique ». **Ne jamais activer un label E2EE sans implémentation cryptographique prouvée.**
**Lot 3 — gouvernance :** liens d'invitation, approbation, transfert propriétaire, profils admins/droits, sanctions, journal, sujets, épingles, sondages, événements, @all/mentions.
**Lot 4 — communications synchrones :** appels audio/vidéo, conférences, écrans partagés, attente, transfert appareils, voice chats, enregistrement consentant.
**Lot 5 — expansion :** bots, mini-apps, communautés, canaux, replies éphémères privées, packs de stickers, AI, automatisations, sauvegardes et archives.

## Contrats productivité/ergonomie à contrôler transversalement
- Le titre/avatar/header d'une conversation mène à ses informations complètes, même si la conversation n'est pas encore consultée.
- Un « ⋯ » regroupe les actions à faible fréquence ; les actions dangereuses demandent une confirmation et respectent les droits.
- Le composeur reste visible avec le clavier natif et le picker KnowSticker, sans superposition de boutons ou barre flottante ; la galerie gère plus d'un média à la fois.
- Une action d'IA dans un groupe ne lit pas les messages privés de membres sans consentement. Les données d'un chat chiffré de bout en bout ne sont pas lisibles côté serveur.
- Groupes >100 : actuellement le code d'administration impose un plafond de 100. **Ne pas juste supprimer cette constante** ; migrations, comptes et pagination des membres, fanout, anti-flood et tests de charge sont obligatoires.
- Non-membre/banni/revocation de droits : UI cache les actions mais **API refuse aussi**, y compris les vieux jetons médias, websocket et liens d'invitation.
- Nouveaux membres : historique privé/public suivant réglages ; une invitation ou recherche ne doit pas divulguer historique, photos ou listes de membres.
- Les réactions restent persistantes et sans ambiguïté (cœur rouge plein, retap pour retirer, appui long pour changer), conformément au cahier KnowMe.

## Étapes GitHub concrètes
- **Design #699 — PR #762 :** authentifier et afficher Media/Fichiers/Liens/Recherche dans les informations des groupes ET conversations privées ; chargement paginé, téléchargements par grants courts, départ sécurisé groupe, filtres admin/membres. Ceci ne vaut pas validation d'autres capacités.
- **Design #699 — PR #743 :** notifications in-app/badges et densité visuelle Web/Android partielle, PR toujours ouverte.
- **Messaging #693 — PR #754 :** droits de groupe serveur en chantier avec collisions et tests à corriger. Ne pas fusionner sur CI rouge.
- **Infra #698 :** services de push/synchronisation, stockage, appels WebRTC, sécurité, messages programmés, schémas et événements persistés.
- **Profiles #696 :** identités et confidentialité, blocages, préférences par utilisateur.
- **Social #694 :** notifications follow/mention, communautés et cross-posting.
- Ce catalogue sert de base aux issues **atomiques** par lot ; inscrire `ID`, preuve CI et statut de chaque fonctionnalité sans déclarer faussement les `308` vérifiées.

## Références officielles vérifiées (consultation 18/10/2026)
- https://telegram.org/evolution (historique des changements, 2026 inclus)
- https://telegram.org/blog/communities-editor-invisible-messages (éditeur riche, communautés, messages bots éphémères)
- https://telegram.org/blog/topics-in-groups-collectible-usernames (sujets et sous-historiques)
- https://telegram.org/faq (dossiers, permissions, groupe, confidentialité, secrets)
- https://core.telegram.org/bots/features (privacy mode et bot group access)
- https://about.fb.com/news/2026/08/were-upgrading-your-whatsapp-group-chats/ (sondages, @all, sous-groupes)
- https://about.fb.com/news/2026/01/whatsapp-group-chats-member-tags-text-stickers-event-reminders/ (tags, stickers, événements)
- https://about.fb.com/news/2026/07/whatsapp-web-calling-new-features/ (transfert appel, attente, suppression de bruit, Web)
- https://about.fb.com/news/2026/03/whatsapp-new-features-simplify-storage-switch-accounts/ (comptes, stockage, migration)
- https://about.fb.com/news/2025/09/introducing-message-translations-whatsapp/ (traduction locale des messages)
- https://about.fb.com/news/2025/10/making-it-easier-to-encrypt-whatsapp-chat-backups/ (sauvegardes E2EE)
- https://about.fb.com/news/2026/01/whatsapp-strict-account-settings-safeguarding-against-cyber-attacks/ (privacy lockdown)
- https://about.fb.com/news/2025/01/introducing-fun-new-ways-to-chat-on-whatsapp/ (sticker packs, réactions, photos)
- https://about.fb.com/news/2026/06/its-time-to-reserve-your-whatsapp-username/ (usernames, statut de lancement à revérifier)
- https://about.fb.com/news/2025/08/new-whatsapp-tools-tips-beat-messaging-scams/ (protection arnaques)
- https://about.fb.com/news/2026/05/incognito-chat-whatsapp-meta-ai/ (IA incognito)
- https://about.fb.com/news/2026/08/new-account-security-features-for-whatsapp/ (sécurité et passkeys)

**Nombre de lignes de capacité : 308.** Chaque ligne correspond à une obligation de développement et de test, **pas à une disponibilité prouvée**.
