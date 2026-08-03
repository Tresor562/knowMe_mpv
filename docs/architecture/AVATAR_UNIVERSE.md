# KMD-037 — Avatar Universe

## Décision

Le studio KMD-035 reste la fondation d’inventaire, d’équipement et de confidentialité. KMD-037 étend cette fondation vers un véritable univers d’avatars personnalisables.

L’objectif n’est plus seulement de superposer six images. L’objectif produit est de permettre à chaque personne de créer un personnage reconnaissable, expressif et cohérent avec sa personnalité, tout en conservant un parcours gratuit complet.

## Principe essentiel

KnowMe ne doit jamais obliger un utilisateur à payer pour posséder un avatar normal, propre et complet.

Un kit gratuit permanent fournit au minimum :

- une base de peau ;
- plusieurs formes de visage ;
- plusieurs coiffures ;
- une tenue quotidienne ;
- des chaussures ;
- des couleurs naturelles ;
- des poses et expressions simples ;
- une personnalité de base modifiable.

Les KnowCoins servent à acheter du style, de la rareté, des animations, des matériaux plus travaillés et des collections spéciales. Ils ne servent pas à rendre l’avatar fonctionnel.

## Personnalité de l’avatar

Un avatar possède une personnalité visuelle indépendante de la personnalité réelle de l’utilisateur.

Les archétypes initiaux sont :

- calme ;
- confiant ;
- élégant ;
- héroïque ;
- mystérieux ;
- joueur ;
- rebelle ;
- futuriste.

L’utilisateur peut ensuite ajuster des intensités de 0 à 100 :

- confiance ;
- expressivité ;
- énergie ;
- chaleur ;
- humour ;
- mystère.

Ces valeurs influencent uniquement la présentation :

- animation d’attente ;
- posture ;
- démarche ;
- expressions du visage ;
- salutations ;
- emotes ;
- pose de profil ;
- animation lors de la réception d’un cadeau ;
- réaction visuelle dans certains défis sociaux.

Aucun trait de personnalité ne donne de bonus de score, de priorité, de pouvoir de modération ou d’avantage compétitif.

## Personnalisation morphologique

Le futur studio 3D doit proposer des curseurs graduels, avec presets et bouton de réinitialisation :

- taille ;
- largeur des épaules ;
- longueur du torse ;
- masse corporelle ;
- définition musculaire ;
- proportion de la tête ;
- largeur de la mâchoire ;
- hauteur des pommettes ;
- largeur et longueur du nez ;
- taille et espacement des yeux ;
- hauteur des sourcils ;
- volume des lèvres ;
- taille des oreilles.

Le studio ajoute aussi :

- formes de visage ;
- teintes de peau inclusives ;
- détails de peau non biométriques ;
- couleurs d’yeux ;
- coiffures, longueurs et textures ;
- pilosité faciale ;
- maquillage ;
- cicatrices et marques fictives ;
- tatouages originaux ;
- couleurs et matériaux personnalisables.

Les réglages sont des paramètres de création, pas une analyse du visage réel. Aucun scan biométrique ou reconnaissance faciale n’est requis.

## Slots d’équipement

Les slots du studio deviennent :

1. peau ;
2. cheveux ;
3. visage ;
4. tenue ;
5. chaussures ;
6. couvre-chef ;
7. accessoire ;
8. objet dorsal ;
9. objet tenu en main ;
10. arme visuelle ;
11. aura ;
12. compagnon ;
13. cadre de profil.

Tous les slots restent autoritaires côté serveur. Un client ne peut jamais équiper un objet non possédé ou forger un accès Premium.

## Armes et objets inspirés de cultures populaires

KnowMe peut proposer des armes fictives et stylisées inspirées de genres populaires : cyber-ninja, fantasy urbaine, science-fiction, mecha, magie, arcade rétro ou guerrier céleste.

KnowMe ne doit pas copier directement :

- un modèle 3D reconnaissable d’un jeu ;
- le nom d’une arme protégée ;
- un logo ;
- un uniforme identifiable ;
- le design exact d’un personnage ;
- une tenue précise d’un anime.

Une référence directe à une œuvre existante exige une collaboration sous licence identifiée côté serveur. Sans licence, l’objet doit être une création originale combinant plusieurs influences générales.

Les armes sont exclusivement visuelles :

- aucune statistique de dégâts ;
- aucune simulation balistique ;
- aucun avantage dans les défis ;
- aucun bonus Premium ;
- aucune fonctionnalité de combat réel.

## Collections de vêtements

Les collections peuvent reprendre des familles esthétiques originales :

- quotidien ;
- urban future ;
- neon ronin ;
- arcane academy ;
- cosmic guardian ;
- shadow operative ;
- royal street ;
- mecha pilot ;
- celestial warrior ;
- retro arcade.

Chaque collection peut comprendre tenue, chaussures, accessoires, coiffure, aura, pose et objet visuel coordonnés.

## Modes d’obtention

Chaque objet utilise un mode d’obtention explicite :

- `FREE` : gratuit et permanent ;
- `KNOWCOINS` : achat en KnowCoins accessible à tous ;
- `PREMIUM_KNOWCOINS` : Premium actif obligatoire, puis paiement en KnowCoins ;
- `ACHIEVEMENT` : récompense d’accomplissement ;
- `EVENT` : événement limité ;
- `CREATOR_DROP` : collection officielle d’un créateur.

Premium n’accorde jamais automatiquement un objet payant. Le serveur vérifie l’entitlement actif, puis débite les KnowCoins dans une transaction séparée et idempotente.

## Avatars prêts à utiliser

Un avatar prêt à utiliser est un bundle composé de :

- morphologie prédéfinie ;
- personnalité ;
- coiffure ;
- visage ;
- tenue ;
- chaussures ;
- accessoires ;
- arme ou objet visuel facultatif ;
- aura ;
- pose et animation d’attente.

Le prix est calculé depuis les objets contenus, puis une remise de bundle plafonnée est appliquée. Le client ne fournit jamais le prix final.

L’achat d’un bundle accorde chaque objet séparément dans l’inventaire. L’utilisateur peut ensuite modifier librement le personnage, remplacer des objets ou sauvegarder le résultat comme preset.

## Prix des objets

Le prix serveur dépend de :

- rareté ;
- score de style ;
- niveau de finition ;
- complexité d’animation ;
- rareté de diffusion ;
- statut de collection limitée.

Plus un objet est sophistiqué, animé, rare et visuellement marquant, plus son prix peut être élevé.

Des limites empêchent toutefois une inflation arbitraire :

- prix maximal par objet ;
- remise maximale par bundle ;
- formule versionnée ;
- historique des changements de prix ;
- impossibilité pour le client de modifier les scores ;
- audit administratif ;
- remboursement contrôlé lors du retrait définitif d’un asset défectueux.

## Rendu 3D

La cible est un rendu de personnage 3D haut de gamme, mais la promesse ne doit pas être formulée comme une égalité garantie avec un jeu AAA tel que GTA 6.

KnowMe utilise plusieurs niveaux :

- `LAYERED_2D` : fallback universel ;
- `REALTIME_3D_BALANCED` : rendu mobile standard ;
- `REALTIME_3D_HIGH` : appareils puissants ;
- `CINEMATIC_PREVIEW` : aperçu précalculé de meilleure qualité.

La chaîne graphique cible :

- modèles glTF/GLB ;
- matériaux PBR ;
- squelette commun ;
- blend shapes faciaux ;
- animations retargetables ;
- simulation de tissu adaptée à l’appareil ;
- niveaux de détail ;
- compression des textures ;
- éclairage studio ;
- rendu différé des miniatures ;
- cache CDN versionné.

Le rendu temps réel doit viser la fluidité avant le photoréalisme. L’aperçu cinématique peut utiliser davantage de détails sans ralentir l’application principale.

## Fonctionnalités supplémentaires

### Presets intelligents

- sauvegarde de plusieurs looks ;
- duplication ;
- comparaison avant/après ;
- annuler et rétablir ;
- mélange aléatoire limité aux objets possédés ;
- tenue automatique selon un thème choisi.

### Teintures et matériaux

- palettes autorisées par objet ;
- matériaux mat, brillant, métal, tissu et holographique ;
- motifs secondaires ;
- usure visuelle facultative ;
- couleurs enregistrées dans le preset.

### Photo mode

- arrière-plans ;
- poses ;
- profondeur de champ ;
- éclairage ;
- stickers KnowMe ;
- export d’une image sans exposer les assets sources.

### Dressing social

- essayer visuellement un objet avant achat ;
- wishlist ;
- partage d’un look ;
- vote privé entre amis ;
- recommandations à partir des objets déjà possédés ;
- cadeaux cosmétiques autorisés par le système Gift Exchange.

### Accessibilité

- navigation clavier ;
- contrôle tactile simplifié ;
- descriptions textuelles ;
- réduction des animations ;
- contraste élevé ;
- fallback 2D sur appareils faibles.

## Sécurité et économie

Toute mutation d’achat ou d’équipement doit :

- être authentifiée ;
- vérifier l’entitlement Premium côté serveur ;
- utiliser le portefeuille autoritaire ;
- être idempotente ;
- être transactionnelle ;
- vérifier l’objet actif et sa fenêtre de vente ;
- empêcher les doubles achats ;
- produire une entrée de ledger ;
- produire un audit pour les opérations sensibles.

## API fondation livrée

KMD-037 ajoute :

- `GET /avatar-universe/policy` ;
- `GET /avatar-universe/starter-kit` ;
- `POST /avatar-universe/quotes/item` ;
- `POST /avatar-universe/quotes/bundle`.

Ces routes exposent la politique et les devis autoritaires. Les écritures persistantes, les nouveaux modèles Prisma et le moteur 3D complet constituent les blocs transactionnels suivants.
