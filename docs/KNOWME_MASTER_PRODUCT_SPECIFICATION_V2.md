# KNOWME MASTER PRODUCT SPECIFICATION

## Vision long terme, architecture produit et roadmap

**Version :** 2.0  
**Statut :** Référence produit officielle  
**Portée :** API, Web, Mobile et futurs clients KnowMe  
**Public :** produit, design, développement, sécurité, modération, juridique et partenaires

---

## 1. Rôle de ce document

Ce document transforme la vision long terme de KnowMe en une référence exploitable. Il ne demande pas de développer immédiatement toutes les idées décrites. Il fixe :

- la promesse centrale du produit ;
- les principes qui ne doivent jamais être sacrifiés ;
- les grands systèmes fonctionnels ;
- les fondations techniques attendues ;
- les limites juridiques et commerciales ;
- la séquence recommandée de livraison.

Les documents historiques des Concepts A à J restent applicables tant qu’ils ne contredisent pas cette version. Le **Concept K — KnowMe Live Experience** devient un concept officiel et transversal.

Toute fonctionnalité majeure doit désormais répondre à trois questions avant son développement :

1. Renforce-t-elle la mission de KnowMe ?
2. Peut-elle être intégrée sans dupliquer un système existant ?
3. À quelle phase de la roadmap appartient-elle ?

---

## 2. Mission et promesse produit

KnowMe est une plateforme sociale conçue pour aider les personnes à mieux se connaître grâce aux défis, aux jeux, aux conversations, aux expériences partagées et à une progression commune.

KnowMe n’est pas :

- un clone de réseau social centré sur la consommation passive ;
- une messagerie générique à laquelle des jeux ont été ajoutés ;
- un casino social ;
- une boutique de cosmétiques sans expérience humaine forte ;
- un assemblage de fonctionnalités indépendantes.

La promesse fondamentale est :

> **Créer des interactions qui révèlent les personnes, rapprochent les relations et donnent envie de construire des souvenirs ensemble.**

Chaque système secondaire — Premium, avatars, cadeaux, IA, communautés, saisons, classements ou effets visuels — doit soutenir cette promesse.

---

## 3. Principes produit non négociables

### 3.1 Une expérience relationnelle avant l’engagement artificiel

La rétention doit venir de relations utiles, de progression saine, de curiosité et de plaisir. Les mécanismes de fidélisation ne doivent pas exploiter la peur, l’humiliation, la perte financière ou la pression sociale excessive.

### 3.2 Une identité visuelle cohérente

Tous les domaines doivent sembler appartenir au même univers. Les défis, messages, cadeaux, avatars, jeux, animations et communautés partagent les mêmes principes de mouvement, de son, de rareté, de couleur et d’accessibilité.

### 3.3 Une architecture modulaire

Les droits Premium, les objets numériques, les animations, les récompenses, les notifications, les médias et les traductions doivent être centralisés. Une fonctionnalité ne doit pas réinventer ces systèmes localement.

### 3.4 Sécurité par défaut

Les autorisations sont vérifiées côté serveur. Les actions économiques et compétitives sont rejouables et auditables. Les données sensibles sont minimisées. La modération humaine reste possible.

### 3.5 Accessibilité et contrôle utilisateur

L’utilisateur peut réduire ou désactiver les animations, sons, téléchargements automatiques, recommandations et fonctions IA non essentielles. Les contrastes, lecteurs d’écran et tailles de police doivent être pris en charge.

### 3.6 Livraison progressive

Les systèmes complexes sont développés par niveaux : fondation, parcours minimum, observabilité, tests, puis enrichissements. Aucun système spectaculaire ne doit fragiliser le cœur du produit.

---

## 4. Modèle d’identité, de confiance et de rôles

Les statuts suivants sont indépendants :

- membre standard ;
- membre Premium ;
- créateur ou influenceur ;
- identité vérifiée ;
- membre de l’Équipe KnowMe ;
- modérateur ;
- administrateur ;
- propriétaire ou modérateur d’une communauté.

### 4.1 Comptes Équipe KnowMe

Les comptes officiels ne doivent jamais être reconnus par une liste d’e-mails codée en dur dans l’application.

Une source de vérité administrable doit gérer :

- l’identité du membre du personnel ;
- son utilisateur lié ;
- son rôle ;
- son statut actif ou révoqué ;
- les dates d’activation et de révocation ;
- l’administrateur ayant effectué la modification ;
- une justification et une trace d’audit.

Un compte actif peut recevoir :

- un badge **Équipe KnowMe** distinct du badge vérifié ;
- un bouclier doré ;
- des permissions attribuées par rôle ;
- une visibilité officielle contrôlée.

### 4.2 Vérification d’identité

Le badge vérifié n’est pas un simple achat. Le futur programme peut combiner :

- un abonnement indicatif de 25 USD par mois ;
- une vérification d’identité obligatoire ;
- un examen manuel ;
- une date d’expiration ;
- une révision en cas de changement d’identité publique ;
- une révocation documentée.

Le paiement ne garantit jamais l’approbation.

### 4.3 Autorisations

Les autorisations doivent être exprimées sous forme de capacités explicites, par exemple :

- `users.suspend` ;
- `reports.resolve` ;
- `staff.manage` ;
- `verification.review` ;
- `catalog.manage` ;
- `events.publish` ;
- `communities.moderate`.

Les interfaces masquent les actions interdites, mais le serveur reste la source d’autorité.

---

## 5. Premium, abonnements et droits d’accès

### 5.1 Offre Premium

Le prix cible initial est de **20 USD par mois**, adapté localement selon les marchés, taxes, canaux de distribution et politiques des boutiques.

Les avantages possibles comprennent :

- catégories de défis et jeux Premium ;
- thèmes et icônes Premium ;
- avatars, cadres, effets et réactions exclusifs ;
- stockage cloud étendu ;
- fonctions IA avancées ;
- personnalisation renforcée ;
- réduction contrôlée de certaines publicités récompensées ;
- sélection de personnages du Concept K.

### 5.2 Architecture des droits

Un abonnement ne doit pas être représenté par un unique booléen `isPremium`. Le modèle cible comprend :

- plans ;
- produits et prix ;
- abonnements ;
- droits ou `entitlements` ;
- transactions ;
- factures ;
- remboursements ;
- périodes d’essai ;
- état de grâce ;
- historique des événements du prestataire.

Exemples de droits :

- `themes.premium` ;
- `icons.premium` ;
- `ai.advanced` ;
- `storage.extended` ;
- `reactions.animated` ;
- `games.premium`.

### 5.3 Prestataires de paiement

Les cartes, Apple Pay, Google Pay et Mobile Money doivent passer par des prestataires spécialisés. KnowMe ne stocke pas directement les données complètes de carte.

L’intégration doit gérer :

- renouvellements automatiques ;
- annulations ;
- échecs et relances ;
- remboursements ;
- taxes ;
- reçus ;
- événements idempotents ;
- différences entre Web, App Store et Play Store.

---

## 6. KnowCoins et économie virtuelle

Les KnowCoins utilisent un **registre comptable immuable**. Le solde affiché est une projection vérifiable, pas l’unique source de vérité.

Chaque écriture enregistre au minimum :

- propriétaire ;
- montant signé ;
- type d’opération ;
- référence métier unique ;
- origine ;
- statut ;
- date ;
- métadonnées ;
- éventuelle écriture de compensation.

Cas couverts :

- quêtes et séries ;
- achats cosmétiques ;
- cadeaux ;
- objets d’avatar ;
- publicités récompensées ;
- coffres ;
- ventes de créateurs ;
- remboursements ;
- commissions ;
- futures mises de l’Arena.

Toute attribution doit être idempotente afin qu’un rafraîchissement, une reconnexion ou un webhook répété ne crédite jamais deux fois la même récompense.

Les achats cosmétiques ne procurent pas d’avantage compétitif injuste.

---

## 7. Défis versionnés

Les défis constituent le cœur de KnowMe. Leur évolution doit préserver les anciennes parties.

Le modèle cible sépare :

- l’identité publique du défi ;
- les versions publiées ;
- les questions d’une version ;
- les sessions ou parties ;
- les participants ;
- les réponses ;
- les résultats.

Lorsqu’un créateur modifie un défi :

- une nouvelle version est créée ;
- les anciennes sessions restent liées à leur version d’origine ;
- les nouvelles sessions utilisent la nouvelle version ;
- les scores historiques restent reproductibles ;
- les questions retirées ne détruisent aucune ancienne réponse.

Les paramètres versionnés incluent notamment :

- questions et réponses attendues ;
- ordre ;
- visibilité ;
- limites de participants ;
- durée ;
- règles de score ;
- médias ;
- niveau de difficulté.

### 7.1 Retour immédiat pendant une partie

Le moteur peut afficher :

- bonne réponse : vibration légère, halo vert, animation positive et son discret ;
- mauvaise réponse : onde rouge, fissure visuelle légère, vibration et encouragement.

Le score total peut rester caché jusqu’à la fin. Les effets négatifs ne doivent jamais humilier l’utilisateur.

### 7.2 Jeu d’affinité

Le jeu d’affinité est une expérience phare possible :

- jauge de synchronisation ;
- compatibilité progressive ;
- particules, cœurs et éclairs ;
- résultat final scénarisé ;
- catégories de résultat ;
- carte partageable ;
- paramètres de confidentialité.

Le calcul doit être explicable, non discriminatoire et présenté comme un jeu, pas comme une vérité scientifique.

---

## 8. Jeux et KnowMe Arena

Le moteur de jeux commun doit prendre en charge :

- solo contre IA ;
- duel ;
- équipes ;
- groupes ;
- tournois ;
- matchmaking ;
- spectateurs ;
- classement ;
- replay ;
- validation serveur.

Catalogue possible : quiz, morpion, puissance 4, mémoire, rythme, cartes originales, bataille navale, rapidité, dessin, escape game coopératif, mini-golf et autres mini-jeux originaux.

Les noms, règles protégées, contenus, personnages et visuels de licences tierces ne doivent pas être copiés sans autorisation.

### 8.1 Paris en KnowCoins

Les mises sont une phase séparée. Avant activation, elles nécessitent :

- étude juridique par pays ;
- restrictions d’âge ;
- géoblocage ;
- limites de mise ;
- prévention de l’endettement et des transferts détournés ;
- anti-collusion ;
- détection des multi-comptes ;
- journal d’audit ;
- mécanisme de litige.

Aucune mise ne doit être activée dans le MVP ou la première Alpha.

### 8.2 Anti-triche

Les actions compétitives sont validées côté serveur. Le système doit pouvoir détecter :

- actions impossibles ;
- cadence anormale ;
- modification du client ;
- bots ;
- collusion ;
- multi-comptes ;
- fraude répétée.

Les sanctions automatiques graves doivent être révisables.

---

## 9. Messagerie immersive et sûre

La messagerie évolue progressivement vers :

- texte, voix, photo, vidéo et fichiers ;
- réponses, transferts, épinglage et modification ;
- réactions et émojis animés ;
- stickers statiques, animés, vidéo et interactifs ;
- dossiers et messages enregistrés ;
- brouillons synchronisés ;
- recherche universelle ;
- appels, partage d’écran et salons vocaux ;
- traduction automatique ;
- sauvegarde et restauration.

### 9.1 Effets de messagerie

Les animations restent courtes et contrôlables :

- envoi : bulle qui glisse ;
- réception : léger rebond ;
- transfert : avion en papier ;
- épinglage : punaise ;
- réaction : effet lumineux ;
- modification : texte qui se réécrit ;
- lecture : coches animées ;
- vocal : onde sonore ;
- suppression : fragmentation puis particules emportées par le vent.

La suppression visuelle ne remplace pas les règles serveur, les délais éventuels, les obligations de conservation légale ou les journaux de sécurité.

### 9.2 Téléchargement des médias

L’utilisateur choisit séparément pour Wi-Fi et données mobiles :

- aucun téléchargement automatique ;
- photos ;
- vidéos ;
- audio ;
- fichiers.

Il peut supprimer une copie locale sans supprimer le message distant. KnowMe fournit un aperçu, un cache nettoyable et une vue de l’espace utilisé.

### 9.3 Protection

Le système doit lutter contre spam, flood, bots, phishing, liens malveillants, fichiers dangereux, usurpation et harcèlement par :

- limitation de débit ;
- blocage et restriction ;
- mode silencieux ;
- analyse de liens et pièces jointes ;
- signalement ;
- réputation comportementale ;
- assistance IA supervisée.

---

## 10. Communautés, créateurs et influenceurs

Le modèle social long terme comprend :

- groupes ;
- communautés publiques et privées ;
- chaînes de diffusion ;
- événements ;
- salons vocaux ;
- albums collaboratifs ;
- lives futurs.

Le mode Créateur ou Influenceur peut ajouter :

- followers et abonnements ;
- statistiques ;
- portée ;
- publications épinglées ;
- page publique ;
- communauté officielle ;
- événements ;
- monétisation future.

Les permissions communautaires utilisent le même moteur d’autorisations que l’administration, avec une portée limitée à la communauté.

---

## 11. Catalogue numérique unifié

Les thèmes, icônes, avatars, stickers, cadeaux, émojis, cadres, animaux virtuels et effets partagent un catalogue commun.

Un objet numérique possède notamment :

- type ;
- catégorie ;
- rareté ;
- collection ;
- disponibilité ;
- prix ;
- droits requis ;
- période de vente ;
- auteur et licence ;
- ressources visuelles ;
- métadonnées de performance ;
- état de modération.

Raretés :

- Commun ;
- Rare ;
- Épique ;
- Légendaire ;
- Mythique ;
- Édition limitée.

Les acquisitions sont représentées par des droits de propriété séparés du catalogue. Un objet peut être acheté, offert, gagné, loué temporairement ou débloqué par abonnement.

---

## 12. Cadeaux, collections et vitrines

KnowMe Gifts permet d’envoyer des cadeaux depuis un profil, une conversation, un groupe ou une communauté.

Un cadeau peut être :

- gratuit lors d’un événement ;
- acheté avec des KnowCoins ;
- Premium ;
- saisonnier ;
- limité ;
- anonyme si les règles le permettent.

Les profils peuvent afficher :

- total reçu ;
- cadeaux rares ;
- derniers cadeaux ;
- expéditeur visible ou anonyme ;
- date ;
- vitrine sélectionnée.

Les collections peuvent débloquer des récompenses cosmétiques. Les cadeaux n’accordent pas d’avantage compétitif.

---

## 13. Avatars et identité évolutive

L’éditeur d’avatar peut comprendre : visage, peau, yeux, coiffures, barbe, vêtements, accessoires, ailes, halos, animaux, auras et effets.

L’Identity Evolution permet au profil d’évoluer selon :

- niveau ;
- badges ;
- saisons ;
- collections ;
- ancienneté ;
- accomplissements.

Les profils peuvent adopter des univers tels que Galaxy, Nature, Cyber, Anime original ou Midnight, sans copier de licences protégées.

---

## 14. Gamification saine

Le système de progression peut inclure :

- XP et niveaux ;
- séries quotidiennes ;
- missions quotidiennes et hebdomadaires ;
- succès ;
- collections ;
- trophées ;
- titres ;
- classements entre amis, communautés et monde ;
- saisons ;
- coffre quotidien ;
- roue de récompenses ;
- objectifs personnels.

Les récompenses doivent rester compréhensibles. Les taux, probabilités et conditions sont affichés lorsque nécessaire. Les mécanismes aléatoires payants font l’objet d’une analyse juridique spécifique.

Les **Positive Challenges** encouragent des actions comme faire un compliment, appeler un proche, découvrir quelqu’un ou jouer ensemble.

---

## 15. Concept K — KnowMe Live Experience

Le Concept K est le moteur transversal d’animations gamifiées.

### 15.1 Objectif

Remplacer les retours génériques par des scènes courtes, reconnaissables et agréables, sans ralentir l’application.

### 15.2 Bibliothèque originale

Les personnages doivent être originaux : aventurier, exploratrice, magicien, ninja original, scientifique, pirate, détective, musicienne, hacker, sportif, artiste, astronaute, cuisinier ou chevalier futuriste.

Chaque personnage peut posséder : expressions, poses, animations et émotions. Les personnages Premium ou saisonniers utilisent le catalogue numérique commun.

### 15.3 Architecture

Les écrans émettent un événement métier, par exemple :

```ts
AnimationManager.play('challenge_completed', {
  result: 'victory',
  reward: 50,
  rarity: 'epic'
});
```

Ils ne connaissent pas le fichier Lottie, le personnage ou l’effet réellement joué.

Événements initiaux possibles :

- `account_created` ;
- `login_success` ;
- `password_reset_sent` ;
- `challenge_created` ;
- `link_copied` ;
- `content_shared` ;
- `message_received` ;
- `message_deleted` ;
- `friend_request_accepted` ;
- `answer_correct` ;
- `answer_incorrect` ;
- `level_up` ;
- `knowcoins_received` ;
- `purchase_completed` ;
- `download_completed`.

### 15.4 Accessibilité et performance

Trois préférences minimales : automatique, réduite, désactivée.

Chaque animation doit :

- pouvoir être ignorée ;
- respecter la préférence système de réduction des mouvements ;
- être chargée à la demande ;
- avoir un fallback statique ;
- fonctionner sur appareils d’entrée de gamme ;
- éviter les vidéos lourdes lorsque CSS, SVG ou Lottie suffisent ;
- limiter sons, vibrations et particules.

---

## 16. Internationalisation et traduction

KnowMe est conçu pour être mondial : français, anglais, espagnol, portugais, allemand, arabe, japonais, chinois, coréen, hindi, turc, russe, swahili, yoruba, fon et autres langues prises en charge.

L’architecture doit prévoir :

- détection initiale ;
- choix manuel ;
- formats de date, nombre et devise ;
- langues de droite à gauche ;
- pluriels ;
- chaînes versionnées ;
- contenus traduisibles ;
- traduction automatique facultative des messages, publications, biographies, commentaires, groupes et défis.

Les traductions automatiques sont clairement signalées et le contenu original reste accessible.

---

## 17. IA KnowMe

L’IA peut progressivement :

- suggérer des défis et jeux ;
- résumer des discussions ;
- retrouver un ancien message ou défi ;
- traduire ;
- organiser un tournoi ;
- générer une biographie ;
- proposer des souvenirs ;
- assister la modération ;
- expliquer une recommandation.

Les fonctions IA doivent respecter : consentement, minimisation des données, possibilité de désactivation, transparence, sécurité contre les injections et contrôle humain pour les décisions sensibles.

---

## 18. Memories, Couple, Famille et souvenirs

**KnowMe Memories** peut créer des souvenirs tels qu’un premier défi, une ancienne compatibilité, une série marquante ou une rencontre communautaire.

Le Mode Couple et le Mode Famille nécessitent :

- consentement explicite de chaque membre ;
- contrôle granulaire de visibilité ;
- retrait simple ;
- traitement sensible des dates et souvenirs ;
- aucune déduction automatique sur les relations personnelles.

---

## 19. Plateformes, hors ligne et sauvegardes

Cibles long terme : Android, iPhone, Web, iPad, tablettes Android, Windows et macOS.

Le mode hors ligne peut permettre :

- lecture de messages déjà téléchargés ;
- brouillons ;
- préparation d’un défi ;
- file locale d’actions synchronisées.

La synchronisation doit gérer les conflits, l’idempotence et l’ordre des événements.

Les sauvegardes chiffrées doivent permettre une restauration simple sans exposer les secrets de session ni les données sensibles.

---

## 20. Liens courts et navigation profonde

Les profils, défis, groupes, communautés, événements, cadeaux et packs utilisent des liens courts, par exemple `knowme.app/A92B`.

Le service doit gérer :

- identifiants non séquentiels ;
- expiration facultative ;
- révocation ;
- prévention des collisions ;
- redirection Web, Android et iOS ;
- aperçu sécurisé ;
- lutte contre le phishing ;
- analytics respectueux de la vie privée.

---

## 21. Modération et sûreté des contenus

Les publications et médias peuvent être analysés pour détecter violence, gore, nudité, haine, terrorisme, escroquerie, harcèlement ou contenu dangereux.

Les réponses possibles sont graduées :

- autoriser ;
- avertir ;
- flouter ;
- limiter la diffusion ;
- envoyer en modération ;
- bloquer ;
- sanctionner après examen.

La modération automatisée ne doit pas être la seule décision pour les sanctions graves. Les utilisateurs disposent de mécanismes de signalement et de recours.

---

## 22. Paramètres

Les paramètres cibles sont organisés par domaines :

- compte et profil ;
- confidentialité ;
- notifications ;
- apparence ;
- animations et sons ;
- messagerie et médias ;
- jeux et invitations ;
- KnowCoins et transactions ;
- Premium, paiements et factures ;
- sécurité, 2FA, sessions et appareils ;
- stockage et cache ;
- IA et recommandations ;
- accessibilité ;
- langue et traduction.

Les valeurs sensibles sont synchronisées côté serveur. Les préférences purement locales restent sur l’appareil lorsqu’approprié.

---

## 23. Fondations techniques transversales

Avant les systèmes avancés, la plateforme doit disposer de :

1. rôles, permissions et comptes staff ;
2. plans, abonnements et droits ;
3. registre KnowCoins ;
4. catalogue numérique et possessions ;
5. raretés et collections ;
6. défis versionnés ;
7. événements métier et traitements idempotents ;
8. notifications structurées ;
9. moteur Concept K ;
10. internationalisation ;
11. stockage média abstrait ;
12. feature flags et déploiement progressif ;
13. audit et observabilité ;
14. politiques de rétention et suppression.

---

## 24. Roadmap officielle

### Phase 1 — Alpha fondamentale

- authentification et sessions ;
- profils et centres d’intérêt ;
- amis ;
- messagerie fiable ;
- défis ;
- notifications ;
- blocage, signalement et administration ;
- clients Web et Mobile stables.

### Phase 2 — Confiance et fondations commerciales

- staff administrable ;
- rôles et permissions ;
- vérification d’identité ;
- Premium ;
- paiements, factures et droits ;
- feature flags ;
- registre KnowCoins.

### Phase 3 — Progression et personnalisation

- XP, niveaux, quêtes et badges ;
- thèmes et icônes ;
- avatars simples ;
- Concept K initial ;
- cadeaux et collections ;
- publicité récompensée limitée.

### Phase 4 — Communautés et créateurs

- groupes et communautés ;
- événements ;
- chaînes ;
- mode Créateur ;
- statistiques ;
- marketplace de stickers ;
- boutiques de créateurs.

### Phase 5 — Jeux et Arena

- moteur de jeux ;
- quiz ;
- affinité ;
- tournois ;
- saisons ;
- classements ;
- anti-triche ;
- mises uniquement après validation juridique.

### Phase 6 — IA et plateforme mondiale

- recommandations ;
- traduction ;
- recherche intelligente ;
- Memories ;
- hors ligne ;
- sauvegardes ;
- clients desktop.

---

## 25. Critères de passage entre phases

Une phase n’est considérée terminée que si :

- les parcours critiques sont testés ;
- les autorisations serveur sont couvertes ;
- les opérations économiques sont idempotentes ;
- la télémétrie permet de diagnostiquer les échecs ;
- les paramètres de confidentialité existent ;
- l’accessibilité minimale est vérifiée ;
- le produit fonctionne sur des appareils modestes ;
- les migrations de données et le retour arrière sont documentés ;
- la CI est verte ;
- les risques juridiques de la phase sont examinés.

---

## 26. Règle finale de décision

Lorsqu’une idée est séduisante mais menace la stabilité, la sécurité, la compréhension ou la mission principale, elle est déplacée dans une phase ultérieure plutôt que développée précipitamment.

KnowMe doit d’abord devenir excellent pour :

1. découvrir une personne ;
2. jouer et relever des défis ensemble ;
3. discuter naturellement ;
4. conserver des souvenirs positifs.

Le reste de l’écosystème doit amplifier ces quatre résultats.