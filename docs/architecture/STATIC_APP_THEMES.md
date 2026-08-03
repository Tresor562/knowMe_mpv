# KMD-031 — Moteur de thèmes et d’identité visuelle KnowMe

## Vision

KMD-031 ne traite plus le thème comme une simple couleur de fond. Il introduit une couche de personnalisation autoritaire, synchronisée et accessible capable de transformer l’identité visuelle de KnowMe tout en conservant la même architecture d’information et les mêmes règles fonctionnelles.

Deux utilisateurs peuvent ainsi percevoir des univers très différents — minimaliste, anime, gaming, nature, fantasy ou science-fiction — sans qu’un thème ne modifie les scores, les récompenses, la priorité sociale, la sécurité ou les performances du compte.

## Catalogue canonique

Le catalogue est défini une seule fois dans `apps/api/src/appearance/theme-catalog.ts` et validé au démarrage.

Invariants :

- exactement `100` thèmes ;
- exactement `40` thèmes gratuits ;
- exactement `60` thèmes Premium ;
- ordre public stable de `1` à `100` ;
- clés uniques ;
- pack d’icônes et icône d’application référencés obligatoirement connus ;
- palettes déterministes et lisibles ;
- aucun code distant ou comportement fonctionnel fourni par un thème.

`Classique KnowMe` est le thème numéro 1, utilise la clé `system` et constitue le fallback sûr. Il suit le mode clair ou sombre de l’appareil.

### Thèmes gratuits 1–40

Classique KnowMe, Clair Minimal, Sombre Élégant, Bleu Océan, Rose Sakura, Vert Nature, Violet Galaxy, Orange Sunset, Rouge Passion, Cyan Crystal, Blanc Glass, Noir Carbone, Ciel Bleu, Lavande, Menthe Fraîche, Café, Chocolat, Sable, Forêt, Tropical, Automne, Printemps, Été, Hiver, Pluie, Neige, Étoiles, Aurores Boréales, Arc-en-ciel, Pixel, Papier, Carnet, Livre, Vintage, Rétro, Néon Simple, Soft Pastel, Aqua, Minimal Glass et Classique Animé.

### Thèmes Premium 41–100

- Univers : Galaxy Ultra, Voie Lactée, Trou Noir, Univers Cosmique, Planètes, Nébuleuses, Station Spatiale, Cyber Galaxy, Étoiles Filantes et Constellations.
- Futuristes : Cyberpunk, Matrix, IA Futuriste, Hologramme, Métal Chromé, Digital World, Quantum, Neon City, Robotique et Tech Blue.
- Anime & Manga : Sakura Dream, Kawaii, Shōnen, Shōjo, Isekai, Fantasy Anime, Ninja, Samouraï, Yokai et Spirit World.
- Gaming : RPG Fantasy, MMORPG, Pixel Deluxe, Dungeon, Boss Battle, Arcade, Battle Royale, Speed Run, Esport et Loot Box.
- Fantasy : Royaume Magique, Dragon, Magicien, Elfes, Château, Pirate, Viking, Mythologie, Royaume Céleste et Enfers.
- Artistiques : Aquarelle, Peinture à l’huile, Origami, Calligraphie, Graffiti, Cristal, Marbre, Diamant, Or Royal et Prestige KnowMe.

## Composition d’un thème

Chaque définition fournit :

- palette complète : fond, accent de fond, surfaces, texte, texte secondaire, accent principal, accent secondaire, bordure, danger et contraste sur accent ;
- mode clair, sombre ou système ;
- catégorie et niveau gratuit/Premium ;
- pack d’icônes par défaut ;
- style de bulles, cartes et transitions ;
- preset d’animation et preset sonore ;
- liste d’effets visuels ;
- icône d’application alternative éventuelle ;
- capacités déclarées pour navigation, messagerie, réactions, profils, badges, progression, KnowCoins, défis, classements, coffres et widgets.

Les effets possibles comprennent notamment pluie, neige, pétales, étoiles filantes, galaxie en mouvement, aurore, vagues, flammes, lucioles, feuilles, éclairs, poussière magique, particules lumineuses, brouillard et confettis.

## Packs d’icônes

Le moteur contient 25 familles :

### Gratuits

- Rounded ;
- Filled ;
- Outline ;
- Soft Glass ;
- Material Plus.

### Premium

Crystal, Neon, Cyber, Anime, Pixel, Fantasy, Gold, Diamond, Cosmic, Liquid, Glass Ultra, Matte Black, White Pearl, Chrome, Gradient Dynamic, RGB Gaming, Holographic, Frost, Fire et Lightning.

Le thème choisit un pack par défaut. Un compte autorisé peut sélectionner un pack indépendant. Le serveur valide toujours le droit `icon-pack.<clé>` ou l’abonnement `subscription.premium` ; le client ne peut pas déverrouiller un pack lui-même.

Les animations d’icônes sont discrètes et désactivables séparément. Le mode système de réduction des mouvements reste prioritaire.

## Icônes d’application

Le catalogue expose cinq icônes gratuites et quinze icônes Premium. La préférence et les droits sont synchronisés par le serveur.

Le changement effectif dépend d’un adaptateur de plateforme :

- Android et iOS appliquent une icône alternative uniquement lorsque le build natif contient l’asset et que la plateforme le permet ;
- le Web/PWA utilise son manifeste et ses assets installables ;
- aucune URL distante non validée ne peut devenir l’icône de l’application ;
- l’absence d’adaptateur conserve l’icône de plateforme sans perdre la préférence du compte.

## Préférence autoritaire

`UserAppearancePreference` conserve :

- thème principal ;
- thème secondaire et mode de fusion ;
- pack d’icônes indépendant ;
- icône d’application ;
- contraste et réduction de transparence ;
- activation globale des animations ;
- activation des icônes animées ;
- sons d’interface ;
- effets météo ;
- intensité des effets ;
- rotation automatique ;
- version monotone et horodatages.

`GET /appearance` renvoie la préférence, les choix effectifs, les catalogues et la politique. `PATCH /appearance` exige une version attendue facultative ; une écriture obsolète produit `APPEARANCE_VERSION_CONFLICT`.

## Choix sélectionné et choix effectif

Chaque élément distingue la préférence conservée de l’élément réellement applicable :

- `selectedThemeKey` / `effectiveThemeKey` ;
- `secondaryThemeKey` / `effectiveSecondaryThemeKey` ;
- `selectedIconPackKey` / `effectiveIconPackKey` ;
- `selectedAppIconKey` / `effectiveAppIconKey` ;
- `themeBlendMode` / `effectiveThemeBlendMode`.

Si un droit expire, le choix n’est pas détruit. Le serveur renvoie `ENTITLEMENT_MISSING`, applique `system`, désactive la fusion, revient au pack du thème effectif et coupe les fonctions Premium dépendantes.

## Déblocage Premium et possession individuelle

Un thème Premium est utilisable lorsque l’un des droits suivants est actif :

- `subscription.premium` ;
- `theme.<clé>` pour une possession individuelle.

Ce contrat prépare trois voies légitimes sans modifier le moteur : abonnement, achat KnowCoins ou récompense de défi. Les systèmes commerciaux attribuent un entitlement ; ils ne modifient jamais directement la préférence visuelle.

Les packs et icônes d’application suivent la même règle avec `icon-pack.<clé>` et `app-icon.<clé>`.

## Combinaison de thèmes

Un abonnement Premium peut combiner un thème principal et un thème secondaire selon quatre modes :

- `OFF` ;
- `ACCENT` : couleurs d’accent du thème secondaire ;
- `EFFECTS` : effets du thème secondaire ;
- `BALANCED` : surfaces secondaires, accents et effets.

Les deux thèmes doivent être autorisés. La fusion reste limitée aux tokens visuels ; elle ne combine aucun comportement métier.

## Animations, sons et batterie

Les préférences synchronisées permettent :

- coupure globale de toutes les animations ;
- coupure séparée des icônes animées ;
- intensité `LOW`, `BALANCED` ou `HIGH` ;
- sons d’interface optionnels, désactivés par défaut ;
- réduction de transparence ;
- priorité aux préférences système de mouvement réduit.

Les presets sonores ne contiennent pas encore d’audio distant. Un adaptateur client doit utiliser des assets locaux contrôlés, respecter le volume système et ne jamais lire un son lorsque `uiSoundsEnabled` est faux.

## Effets météo

La préférence météo nécessite :

- un abonnement Premium actif ;
- une permission explicite de l’utilisateur ;
- un adaptateur météo/localisation de plateforme ;
- un mode sans localisation précise lorsque possible ;
- un fallback silencieux sans animation lorsque les données sont indisponibles.

Le serveur stocke la volonté de l’utilisateur mais ne considère jamais la permission locale comme acquise.

## Saisons et événements

Dix définitions sont cataloguées : Noël, Halloween, Saint-Valentin, Nouvel An, Ramadan, Pâques, Fête nationale, Festival Sakura, Summer Vibes et Winter Magic.

La disponibilité est pilotée côté serveur via `KNOWME_ACTIVE_THEME_SEASONS`. Aucun client ne calcule seul Ramadan, les fêtes nationales ou les fenêtres commerciales. Chaque saison annonce ses effets et ses méthodes de déblocage possibles : Premium, KnowCoins ou défi.

Des packs d’icônes événementiels sont également réservés pour Noël, Halloween, Nouvel An, Saint-Valentin, Festival Anime, Coupe du Monde, Jeux Olympiques et KnowMe Seasons.

## Rotation automatique

Les modes synchronisés sont :

- `OFF` ;
- `TIME` ;
- `SEASON`.

La préférence nécessite Premium. La sélection finale doit rester déterministe et auditable : le client ne peut choisir que des thèmes autorisés, et une rotation saisonnière dépend du calendrier serveur.

## Web

Le Web :

- met en cache la réponse complète ;
- applique les tokens avant l’hydratation pour supprimer le flash ;
- resynchronise après authentification ;
- suit le mode système ;
- applique palette, fusion, pack d’icônes, style de bulles, effets et intensité ;
- fournit un studio avec recherche, filtres, aperçu, packs, icônes, accessibilité, animations, sons, météo, fusion, rotation et saisons.

Les pages existantes héritent des tokens globaux. Les hooks CSS de bulles et d’icônes permettent une adoption progressive sans réécrire toute l’application en une mutation risquée.

## Mobile

Le Mobile :

- utilise `AsyncStorage` avant authentification ;
- reçoit les palettes du serveur au lieu de dupliquer 100 thèmes ;
- résout localement uniquement le mode système ;
- applique la fusion et le contraste élevé ;
- partage la palette avec le shell, l’authentification, l’accueil, la navigation et la barre d’état ;
- affiche le catalogue avec recherche, catégories et rendu progressif ;
- synchronise packs, icône, animations, sons, météo, accessibilité, combinaison, rotation et saisons.

Les fonctions dépendantes du système d’exploitation restent des adaptateurs séparés : préférence synchronisée ne signifie pas permission locale acquise.

## Accessibilité

Tous les thèmes doivent conserver :

- contraste suffisant ;
- formes d’icônes reconnaissables ;
- tailles adaptatives ;
- focus visible sur le Web ;
- compatibilité clair, sombre et contraste élevé ;
- réduction de transparence ;
- animations désactivables ;
- respect de `prefers-reduced-motion` et des réglages natifs équivalents.

Un thème inaccessible doit être corrigé dans le catalogue ; le client ne doit pas masquer le défaut par une logique spéciale non partagée.

## Personnalisation Premium avancée

Le moteur possède les fondations pour :

### Déjà synchronisé

- pack d’icônes indépendant ;
- combinaison de thèmes ;
- rotation selon l’heure ou la saison ;
- préférence d’icône d’application ;
- intensité, sons et effets météo.

### Adaptateur de plateforme requis

- changement natif d’icône ;
- lecture des sons locaux ;
- météo en temps réel et permission ;
- rendu avancé des animations et transitions sur chaque surface.

### Éditeur futur, non prétendu comme livré

- couleurs et fonds entièrement personnalisés ;
- import de fond personnel avec modération et stockage ;
- taille, arrondi, transparence et épaisseur des icônes ;
- pack différent par onglet ;
- écran de chargement importé ;
- compositions libres au-delà des modes de fusion contrôlés.

Ces futurs objets devront être versionnés, validés, exportables, supprimables et incapables d’injecter du code, du CSS arbitraire ou une URL non approuvée.

## Cycle de vie du compte

L’export reste rétrocompatible :

- format `6` lorsqu’aucune préférence d’apparence n’est persistée ;
- format `7` avec bloc `appearance` dès que le compte possède une personnalisation.

La suppression efface `UserAppearancePreference` dans la transaction du compte. Chaque modification produit `APPEARANCE_PREFERENCE_UPDATED` avec les choix et la version, sans enregistrer de permission locale sensible.

## Garanties finales

- Aucun thème ne modifie un score, une récompense, un solde ou une priorité.
- Aucun client ne déverrouille lui-même Premium.
- Aucun thème n’exécute de code ou de CSS utilisateur.
- Les animations et sons sont désactivables.
- Le fallback conserve la préférence sans exposer un contenu verrouillé.
- Web et Mobile partagent la même source de vérité.
