# KMD-040 — Livraison Concept K Profils

## Livré

- profil vivant serveur ;
- modèle de statistiques extensible ;
- visibilité indépendante pour 17 sections ;
- profil verrouillé et déverrouillage relationnel ;
- Duo, Équipe, Famille et Guilde avec consentement ;
- mur public, amis ou désactivé ;
- galerie de cadeaux ;
- frise de souvenirs ;
- coffre privé ;
- carte partageable et code court ;
- snapshot de compatibilité sans signaux privés ;
- mode Influenceur préparé ;
- progression visuelle non achetable ;
- Profile Guard par zone ;
- sécurité essentielle non payante ;
- distinctions Android, iOS, Web et bureau ;
- stockage d’événements de capture sans contenu capturé ;
- refus de notifier depuis un signal client non attesté ;
- Studio de profil Web ;
- nouveau profil public Web ;
- contrat mobile par écran ;
- tests des invariants.

## Modèles Prisma

- `ProfileExperience` ;
- `ProfileSectionVisibility` ;
- `ProfileStatSnapshot` ;
- `ProfileCircle` ;
- `ProfileCircleMember` ;
- `ProfileTimelineEvent` ;
- `ProfileMemoryVaultItem` ;
- `ProfileWallPost` ;
- `ProfileGiftShowcaseItem` ;
- `ProfileGuardPreference` ;
- `ProfileCaptureSecurityEvent` ;
- `ProfileShareCard` ;
- `ProfileCompatibilitySnapshot`.

## Garanties

- le client ne choisit pas sa relation avec le propriétaire ;
- les sections masquées sont omises de la réponse ;
- le coffre est accessible uniquement au propriétaire ;
- une relation n’est pas active sans les consentements requis ;
- Premium ne débloque aucun niveau de profil ;
- les paiements et écrans administratifs ne perdent pas leur protection sans Premium ;
- iOS n’est jamais présenté comme garantissant un blocage absolu ;
- le Web n’est jamais présenté comme capable d’empêcher toutes les captures ;
- un événement forgé par le client ne déclenche pas d’alerte propriétaire.

## KMD-040A — Statistiques et événements

- agrégateurs pour défis, jeux, amitiés, followers, messages, streaks, cadeaux et KnowCoins ;
- snapshots versionnés ;
- recalcul asynchrone ;
- protection contre le spam et les compteurs forgés ;
- historique de progression.

## KMD-040B — Relations visuelles

- invitations et refus complets ;
- transfert de propriété ;
- fin et pause ;
- couverture Duo fractionnée ;
- transition horizontale ;
- bio complémentaire ;
- pages Équipe, Famille et Guilde ;
- arbre familial ;
- classements et progression collective.

## KMD-040C — Profil créatif

- éditeur de couverture ;
- widgets de bio ;
- lecteur musical ;
- thèmes et effets ;
- avatar 3D ;
- météo respectueuse de la vie privée ;
- événements saisonniers ;
- export de carte en image ;
- génération QR réelle.

## KMD-040D — Profile Guard natif

- installation d’`expo-screen-capture` par `expo install` pour correspondre au SDK ;
- activation par route et clé ;
- protection de l’aperçu du sélecteur d’applications ;
- écoute des captures compatibles ;
- masquage pendant enregistrement/recopie sur iOS ;
- attestation native ;
- politique d’alertes ;
- tests Android/iOS réels ;
- matrice appareils et versions.

## KMD-040E — IA, compatibilité et modération

- consentement IA ;
- bios et thèmes proposés ;
- explications de compatibilité agrégées ;
- seuils minimums ;
- modération du mur ;
- signalements ;
- sécurité des mineurs ;
- export et suppression des données.
